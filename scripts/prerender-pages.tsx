/**
 * Writes the crawlable HTML after `vite build`.
 *
 *   1. Fills `#root` of dist/public/index.html with the home page's static sections, so a
 *      crawler that never runs the bundle still reads the heading, the address and the FAQ.
 *   2. Writes one dist/public/<page>.html per landing page in shared/pages.ts, each with its
 *      own title, description, canonical, card and structured data. Cloudflare serves
 *      `repairs.html` at `/repairs`, and the bundle takes over on load exactly as on `/`.
 *
 * Run: tsx scripts/prerender-pages.tsx   (part of `pnpm build:worker`)
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { SHARE_IMAGE } from "../shared/const";
import { STATIC_PAGES } from "../shared/pages";
import { applyStaticHead, buildPageSocialMeta, injectIntoRoot } from "../server/prerender";
import { LandingPage } from "../client/src/components/storefront/LandingPage";
import { StaticHome } from "../client/src/components/storefront/StaticHome";
import { landingContent } from "../client/src/content/landing";
import { buildFaqJsonLd, buildLandingBreadcrumbJsonLd, buildQuestionsJsonLd } from "../client/src/lib/seo";
import { STORE } from "../client/src/lib/storefrontState";

const outDir = path.resolve(import.meta.dirname, "..", "dist", "public");
const indexPath = path.join(outDir, "index.html");
const shipped = readFileSync(indexPath, "utf8");

/** JSON-LD in a script tag; `<` is escaped so a value can never close the tag. */
function jsonLd(id: string, data: unknown) {
  return `<script type="application/ld+json" id="${id}">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

/** Adds structured data before </head>. */
function withJsonLd(html: string, scripts: string[]) {
  return html.replace("</head>", `  ${scripts.join("\n    ")}\n  </head>`);
}

// The home page: the FAQ the static sections show, then the sections themselves.
writeFileSync(indexPath, injectIntoRoot(withJsonLd(shipped, [jsonLd("ld-faq", buildFaqJsonLd())]), renderToString(<StaticHome />)));
console.log(`[prerender] index.html: home sections written into #root`);

for (const page of STATIC_PAGES) {
  const content = landingContent[page.path];
  const meta = buildPageSocialMeta(STORE.site, page, SHARE_IMAGE);
  let html = applyStaticHead(shipped, meta);
  const extra = [
    jsonLd("ld-breadcrumb", buildLandingBreadcrumbJsonLd(STORE.site, page)),
    jsonLd("ld-page-faq", buildQuestionsJsonLd(content.faq)),
  ];
  html = withJsonLd(html, extra);
  html = injectIntoRoot(html, renderToString(<LandingPage page={page} content={content} />));
  writeFileSync(path.join(outDir, page.file), html);
  console.log(`[prerender] ${page.file}: ${page.path} (${page.title})`);
}
