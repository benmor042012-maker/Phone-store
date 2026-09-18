import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SHARE_IMAGE } from "../shared/const";
import { HOME_SEO, STATIC_PAGES } from "../shared/pages";
import { applyStaticHead, buildPageSocialMeta, injectIntoRoot } from "./prerender";

const indexHtml = readFileSync(path.resolve(import.meta.dirname, "..", "client", "index.html"), "utf8");

describe("injectIntoRoot", () => {
  it("puts the fragment inside the empty root and nowhere else", () => {
    const html = '<body><div id="root"></div><noscript>x</noscript></body>';
    expect(injectIntoRoot(html, "<h1>hi</h1>")).toBe('<body><div id="root"><h1>hi</h1></div><noscript>x</noscript></body>');
  });

  it("refuses a document without the empty root", () => {
    expect(() => injectIntoRoot('<div id="root"><p>already</p></div>', "x")).toThrow(/root/);
  });
});

describe("applyStaticHead", () => {
  const page = STATIC_PAGES[0];
  const meta = buildPageSocialMeta("https://phonestore.co.il/", page, SHARE_IMAGE);
  const html = applyStaticHead(indexHtml, meta);

  it("rewrites the title, the canonical, the hreflang links and the cards for the page", () => {
    expect(html).toContain(`<title>${page.title}</title>`);
    expect(html).toContain('<link rel="canonical" href="https://phonestore.co.il/repairs" />');
    expect(html).toContain('<link rel="alternate" hreflang="he-IL" href="https://phonestore.co.il/repairs" />');
    expect(html).toContain(`<meta property="og:title" content="${page.title}" />`);
    // Prettier keeps this tag's attributes on their own lines; the layout is not the point.
    expect(html).toMatch(new RegExp(`<meta\\s+name="description"\\s+content="${page.description}"\\s*/>`));
    expect(html).toContain('<meta property="og:url" content="https://phonestore.co.il/repairs" />');
    expect(html).toContain('<meta property="og:image" content="https://phonestore.co.il/images/og-cover.png" />');
    expect(html).toContain(`<meta name="twitter:title" content="${page.title}" />`);
  });

  it("never leaves two copies of a tag or the home page's title behind", () => {
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html).not.toContain(HOME_SEO.title);
    expect(html.match(/<title>/g)).toHaveLength(1);
  });

  it("leaves the rest of the document as it was", () => {
    expect(html).toContain('<html lang="he" dir="rtl">');
    expect(html).toContain('id="ld-store"');
    expect(html).toContain('<div id="root"></div>');
    expect(html.length).toBeGreaterThan(indexHtml.length - 400);
  });

  it("escapes attribute values", () => {
    const evil = applyStaticHead(indexHtml, { ...meta, title: 'a"b<c>&d' });
    expect(evil).toContain("<title>a&quot;b&lt;c&gt;&amp;d</title>");
    expect(evil).toContain('content="a&quot;b&lt;c&gt;&amp;d"');
  });
});

describe("client/index.html", () => {
  it("carries the home metadata the app applies, so the crawled page and the live page agree", () => {
    expect(indexHtml).toContain(`<title>${HOME_SEO.title}</title>`);
    expect(indexHtml).toContain(`content="${HOME_SEO.description}"`);
    expect(indexHtml).toContain('<link rel="manifest" href="/site.webmanifest" />');
    expect(indexHtml).toContain('href="/favicon.ico"');
    expect(indexHtml).not.toMatch(/name="robots" content="[^"]*noindex/);
  });
});
