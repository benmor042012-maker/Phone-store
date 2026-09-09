/**
 * Rewrites the document head so a link-preview crawler scrapes the metadata for the page it
 * asked for. HTMLRewriter streams, so the shipped index.html is never buffered in memory.
 */
import { socialMetaTags, type SocialMeta, type SocialMetaTag } from "../server/social-meta";

/** Escapes a value for an HTML double-quoted attribute. */
function attributeValue(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Applies `meta` to the head of `document`. Tags already in the HTML are updated in place,
 * tags marked for removal are dropped, and anything still missing is appended before
 * </head> — so the result never carries two copies of the same property.
 */
export function rewriteSocialHead(document: Response, meta: SocialMeta): Response {
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
        if (missing.length === 0) return;
        const html = missing
          .map((tag) => `<meta ${tag.attribute}="${attributeValue(tag.key)}" content="${attributeValue(tag.content as string)}" />`)
          .join("\n    ");
        endTag.before(`    ${html}\n  `, { html: true });
      });
    },
  });

  return rewriter.transform(document);
}
