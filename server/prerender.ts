/**
 * String-level edits to the built index.html, for the pages the build writes out.
 *
 * The Worker rewrites a document's head with HTMLRewriter as it streams; that API exists
 * only inside workerd. The build runs under Node, so it makes the same edits on the string
 * instead. Both start from `socialMetaTags`, so a static page's card and a product page's
 * card are built from the same list.
 */
import type { StaticPage } from "../shared/pages";
import { socialMetaTags, type SocialMeta } from "./social-meta";

const ROOT = '<div id="root"></div>';

/** Escapes a value for an HTML double-quoted attribute or text node. */
function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Puts `fragment` inside the app's root element. Throws when the root is not the empty
 * one Vite shipped: a build that silently produced an empty page is worse than one that
 * stopped.
 */
export function injectIntoRoot(html: string, fragment: string): string {
  const at = html.indexOf(ROOT);
  if (at === -1) throw new Error(`prerender: ${ROOT} not found in the document`);
  return `${html.slice(0, at)}<div id="root">${fragment}</div>${html.slice(at + ROOT.length)}`;
}

/** The card and canonical for a static page, in the shape the worker uses for products. */
export function buildPageSocialMeta(origin: string, page: Pick<StaticPage, "path" | "title" | "description">, share: { path: string; width: string; height: string; type: string }): SocialMeta {
  const base = origin.replace(/\/+$/, "");
  return {
    title: page.title,
    description: page.description,
    canonical: `${base}${page.path}`,
    image: `${base}${share.path}`,
    imageAlt: page.title,
    imageWidth: share.width,
    imageHeight: share.height,
    imageType: share.type,
    type: "website",
  };
}

/**
 * Rewrites the head of `html` for `meta`: the title, the canonical and hreflang links, and
 * every meta tag in `socialMetaTags`. Tags the document already has are edited in place,
 * tags it lacks are added before </head>, and a tag whose content is null is removed.
 */
export function applyStaticHead(html: string, meta: SocialMeta): string {
  const headEnd = html.indexOf("</head>");
  if (headEnd === -1) throw new Error("prerender: </head> not found in the document");
  let head = html.slice(0, headEnd);
  const rest = html.slice(headEnd);

  head = head.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(meta.title)}</title>`);
  head = head.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${escapeHtml(meta.canonical)}$2`);
  head = head.replace(/(<link rel="alternate" hreflang="[^"]*" href=")[^"]*(")/g, `$1${escapeHtml(meta.canonical)}$2`);

  const missing: string[] = [];
  for (const tag of socialMetaTags(meta)) {
    // Attributes may sit on their own lines, as Prettier lays out the description tag.
    const pattern = new RegExp(`\\s*<meta\\s+${tag.attribute}="${tag.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s+content="[^"]*"\\s*/>`);
    if (pattern.test(head)) {
      const content = tag.content;
      head = head.replace(pattern, (match) => (content === null ? "" : match.replace(/content="[^"]*"/, `content="${escapeHtml(content)}"`)));
    } else if (tag.content !== null) {
      missing.push(`<meta ${tag.attribute}="${tag.key}" content="${escapeHtml(tag.content)}" />`);
    }
  }
  if (missing.length) head += `    ${missing.join("\n    ")}\n  `;
  return head + rest;
}
