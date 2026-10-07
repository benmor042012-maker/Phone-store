/**
 * Proves a deployment is actually serving the pages a search engine needs.
 *
 *   node scripts/check-prerender.mjs https://phonestore.co.il
 *   node scripts/check-prerender.mjs http://127.0.0.1:8788
 *
 * Reading the repository never shows whether the build ran the prerender step, whether the
 * landing pages shipped, or whether the worker is labelling a real file as missing. This
 * asks the server, with no JavaScript, exactly as a crawler would. Exits non-zero on the
 * first real problem, so it can gate a deploy.
 */
const base = (process.argv[2] ?? "http://127.0.0.1:8788").replace(/\/+$/, "");

let failures = 0;
const ok = (label, detail = "") => console.log(`ok   ${label}${detail ? ` — ${detail}` : ""}`);
const fail = (label, detail = "") => {
  failures++;
  console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
};

async function get(path, redirect = "manual") {
  const response = await fetch(`${base}${path}`, { redirect, headers: { "user-agent": "prerender-check" } });
  const body = response.headers.get("content-type")?.includes("text") || response.status === 200 ? await response.text().catch(() => "") : "";
  return { status: response.status, location: response.headers.get("location"), body };
}

function firstHeading(html) {
  return /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1].replace(/<[^>]*>/g, "").trim() ?? "";
}

function title(html) {
  return /<title>([\s\S]*?)<\/title>/.exec(html)?.[1].trim() ?? "";
}

/** The home page must carry its heading and the shop's details before any script runs. */
const home = await get("/");
home.status === 200 ? ok("/ answers 200") : fail("/ answers 200", String(home.status));
firstHeading(home.body).includes("חנות סלולרי בנתניה")
  ? ok("/ heading", firstHeading(home.body))
  : fail("/ heading is prerendered", firstHeading(home.body) || "no h1 in the served HTML — the build skipped the prerender step");
home.body.includes("050-477-7470") ? ok("/ carries the phone number") : fail("/ carries the phone number");
home.body.includes("שדרות בן גוריון 2") || home.body.includes("שד׳ בן גוריון 2") ? ok("/ carries the address") : fail("/ carries the address");
(home.body.match(/<h1/g) ?? []).length === 1 ? ok("/ has exactly one h1") : fail("/ has exactly one h1", String((home.body.match(/<h1/g) ?? []).length));

/** Every landing page must be its own document, not a copy of the home page. */
const pages = ["/repairs", "/repairs/screen", "/repairs/battery", "/iphone", "/samsung", "/accessories", "/about"];
const titles = new Set([title(home.body)]);
for (const path of pages) {
  const page = await get(path);
  if (page.status !== 200) {
    fail(`${path} answers 200`, String(page.status));
    continue;
  }
  const heading = firstHeading(page.body);
  const name = title(page.body);
  if (!heading || heading === firstHeading(home.body)) fail(`${path} has its own heading`, heading || "none");
  else ok(`${path}`, heading);
  if (titles.has(name)) fail(`${path} has its own title`, name);
  titles.add(name);
}

/** A file that exists must never be reported missing, whatever its name. */
const token = await get("/googled545ba7d0fc7b74d.html");
token.status === 200
  ? ok("google verification file answers 200 at its own URL")
  : fail("google verification file answers 200 at its own URL", `${token.status}${token.location ? ` → ${token.location}` : ""}`);
token.body.trim() === "google-site-verification: googled545ba7d0fc7b74d.html"
  ? ok("google verification file content")
  : fail("google verification file content", JSON.stringify(token.body.slice(0, 80)));

/** A path that is not a page must say so, or Google records a soft 404. */
const missing = await get("/this-path-does-not-exist");
missing.status === 404 ? ok("unknown path answers 404") : fail("unknown path answers 404", String(missing.status));

/** A product URL must be about that product, not about the shop's home page. */
const catalog = await fetch(`${base}/catalog.json`).then((response) => response.json()).catch(() => null);
const sample = catalog?.products?.[0];
if (!sample) fail("catalog.json is readable");
else {
  const product = await get(`/products/${encodeURIComponent(sample.id)}`);
  const heading = firstHeading(product.body);
  product.status === 200 ? ok("product page answers 200") : fail("product page answers 200", String(product.status));
  heading.includes(sample.name.slice(0, 20))
    ? ok("product page heading", heading)
    : fail("product page shows the product, not the home page", heading || "none");
  product.body.includes("application/ld+json") && product.body.includes('"Product"')
    ? ok("product page carries Product structured data")
    : fail("product page carries Product structured data");
}

/** The sitemap must list the landing pages the build wrote. */
const sitemap = await get("/sitemap.xml");
for (const path of ["/repairs", "/samsung", "/repairs/screen"]) {
  sitemap.body.includes(`${path}</loc>`) ? ok(`sitemap lists ${path}`) : fail(`sitemap lists ${path}`);
}

console.log(failures ? `\n${failures} check(s) failed against ${base}` : `\nall checks passed against ${base}`);
process.exit(failures ? 1 : 0);
