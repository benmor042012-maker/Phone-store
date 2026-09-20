/**
 * Rewrites the document a crawler receives so it describes the page it asked for.
 *
 * The head carries the title, the canonical and the preview card; the body carries the
 * page itself. Both matter: a link-preview crawler reads the head, and a search crawler
 * that does not run JavaScript reads whatever is inside `#root`. HTMLRewriter streams, so
 * the shipped index.html is never buffered in memory.
 */
import { socialMetaTags, type SocialMeta, type SocialMetaTag } from "../server/social-meta";

/** Escapes a value for an HTML double-quoted attribute. */
function attributeValue(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A named JSON-LD block. The id matches the one the app writes, so React replaces it. */
export type JsonLdBlock = { id: string; data: unknown };

/** What the document's body should become, when the caller has a page to put there. */
export type DocumentBody = { html: string; jsonLd?: JsonLdBlock[] };

function jsonLdScript(block: JsonLdBlock) {
  // `<` is escaped so no value in the record can close the script tag.
  return `<script type="application/ld+json" id="${attributeValue(block.id)}">${JSON.stringify(block.data).replace(/</g, "\\u003c")}</script>`;
}

/**
 * Applies `meta` to the head of `document`, and `body` to `#root` when one is given.
 * Tags already in the HTML are updated in place, tags marked for removal are dropped, and
 * anything still missing is appended before </head> — so the result never carries two
 * copies of the same property.
 */
export function rewriteSocialHead(document: Response, meta: SocialMeta, body?: DocumentBody): Response {
  const tags = socialMetaTags(meta);
  const seen = new Set<string>();

  // Scoped to the head so an inline SVG <title> in the body is never touched.
  let rewriter = new HTMLRewriter()
    .on("head title", {
      element(element) {
        element.setInnerContent(meta.title);
      },
    })
    .on('head link[rel="canonical"]', {
      element(element) {
        element.setAttribute("href", meta.canonical);
      },
    });

  for (const tag of tags) {
    rewriter = rewriter.on(`head meta[${tag.attribute}="${tag.key}"]`, {
      element(element) {
        if (tag.content === null) {
          element.remove();
          return;
        }
        seen.add(tag.key);
        element.setAttribute("content", tag.content);
      },
    });
  }

  // The </head> handler runs after every element inside the head, so `seen` is complete by then.
  rewriter = rewriter.on("head", {
    element(element) {
      element.onEndTag((endTag) => {
        const missing = tags.filter((tag: SocialMetaTag) => tag.content !== null && !seen.has(tag.key));
        const blocks = (body?.jsonLd ?? []).map(jsonLdScript);
        const html = [
          ...missing.map((tag) => `<meta ${tag.attribute}="${attributeValue(tag.key)}" content="${attributeValue(tag.content as string)}" />`),
          ...blocks,
        ];
        if (html.length === 0) return;
        endTag.before(`    ${html.join("\n    ")}\n  `, { html: true });
      });
    },
  });

  if (body) {
    // The shipped document carries the home page inside #root. Left alone, every product
    // URL would serve the home page's markup and heading.
    rewriter = rewriter.on("div#root", {
      element(element) {
        element.setInnerContent(body.html, { html: true });
      },
    });
  }

  return rewriter.transform(document);
}
