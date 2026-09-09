#!/usr/bin/env node
/**
 * Reports exactly what a WhatsApp / Facebook link-preview crawler sees for a URL.
 *
 *   node scripts/check-link-preview.mjs https://phonestore.co.il/
 *   node scripts/check-link-preview.mjs http://127.0.0.1:8788/products/33767
 *
 * Crawlers do not run JavaScript, so this fetches the raw HTML the way they do, reads only
 * the tags they read, and then fetches the share image to confirm it is reachable and the
 * right shape. Exits non-zero when the card would come out blank or broken.
 */

// WhatsApp identifies itself as this; some hosts and WAFs treat it differently from a browser.
const CRAWLER_UA = "WhatsApp/2.24.1.78 A";
// Facebook rejects anything past 8MB; past ~300KB WhatsApp is slow to render on a phone.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const COMFORTABLE_IMAGE_BYTES = 300 * 1024;
const REQUIRED = ["og:title", "og:description", "og:image"];

const problems = [];
const notes = [];

function fail(message) {
  problems.push(message);
}

/** Reads a meta tag's content without a DOM: crawlers do the same kind of scan. */
function metaContent(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i");
  const tag = pattern.exec(html)?.[0];
  if (!tag) return null;
  // Match the closing quote to the opening one: a Hebrew product name may contain an
  // apostrophe inside a double-quoted value, and cutting there would misreport the tag.
  return /content=("([^"]*)"|'([^']*)')/i.exec(tag)?.slice(2).find((value) => value !== undefined) ?? null;
}

/** Reads a PNG, JPEG, GIF or WebP header far enough to report the real dimensions. */
function imageSize(buffer) {
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { format: "png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    const kind = buffer.toString("ascii", 12, 16);
    if (kind === "VP8X") return { format: "webp", width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
    if (kind === "VP8L") {
      const bits = buffer.readUInt32LE(21);
      return { format: "webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (kind === "VP8 ") return { format: "webp", width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    return { format: "webp" };
  }
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { format: "jpeg", height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
    return { format: "jpeg" };
  }
  if (buffer.length > 10 && buffer.toString("ascii", 0, 3) === "GIF") {
    return { format: "gif", width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  return { format: "unknown" };
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("usage: node scripts/check-link-preview.mjs <url>");
    process.exit(2);
  }

  console.log(`Scraping ${target} as “${CRAWLER_UA}”\n`);

  let response;
  try {
    response = await fetch(target, { headers: { "user-agent": CRAWLER_UA, accept: "text/html,*/*" }, redirect: "follow" });
  } catch (error) {
    console.error(`unreachable: ${error instanceof Error ? error.message : String(error)}`);
    console.error("\nA crawler that cannot reach the URL shows the bare domain and nothing else.");
    process.exit(1);
  }

  console.log(`status        ${response.status} ${response.statusText}`);
  console.log(`content-type  ${response.headers.get("content-type") ?? "(none)"}`);
  if (response.url !== target) console.log(`redirected to ${response.url}`);
  console.log();

  if (!response.ok) fail(`the page answered ${response.status}, so there is no metadata to read`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) fail(`the page is served as “${contentType}”, and crawlers only parse text/html`);

  const html = await response.text();
  const headEnd = html.toLowerCase().indexOf("</head>");
  if (headEnd === -1) fail("the document has no </head>, so the response is probably not the real page");
  // Crawlers stop reading well before a megabyte; metadata that lands late is metadata lost.
  if (headEnd > 300_000) fail(`the head runs to ${Math.round(headEnd / 1024)}KB, past where crawlers stop reading`);

  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? null;
  const tags = {
    title,
    "og:title": metaContent(html, "og:title"),
    "og:description": metaContent(html, "og:description"),
    "og:image": metaContent(html, "og:image"),
    "og:url": metaContent(html, "og:url"),
    "og:type": metaContent(html, "og:type"),
    "og:site_name": metaContent(html, "og:site_name"),
    description: metaContent(html, "description"),
  };
  for (const [key, value] of Object.entries(tags)) {
    console.log(`${key.padEnd(15)} ${value ?? "— missing —"}`);
  }
  console.log();

  for (const key of REQUIRED) {
    if (!tags[key]) fail(`${key} is missing, so the card has no ${key === "og:image" ? "picture" : key.slice(3)}`);
  }
  const overHttps = new URL(response.url).protocol === "https:";
  if (tags["og:image"] && !/^https?:\/\//.test(tags["og:image"])) {
    fail("og:image must be an absolute URL; crawlers do not resolve a relative path");
  } else if (overHttps && tags["og:image"] && !tags["og:image"].startsWith("https://")) {
    fail("og:image must be served over https; WhatsApp ignores an http image on an https page");
  }

  if (tags["og:image"]?.startsWith("http")) {
    let image;
    try {
      image = await fetch(tags["og:image"], { headers: { "user-agent": CRAWLER_UA } });
    } catch (error) {
      fail(`og:image could not be fetched: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (image) {
      const body = Buffer.from(await image.arrayBuffer());
      const size = imageSize(body);
      const ratio = size.width && size.height ? size.width / size.height : null;
      console.log(`og:image      ${image.status} · ${size.format} · ${size.width ?? "?"}x${size.height ?? "?"} · ${Math.round(body.length / 1024)}KB`);
      console.log();
      if (!image.ok) fail(`og:image answered ${image.status}, so the card renders without a picture`);
      if (body.length > MAX_IMAGE_BYTES) fail(`og:image is ${Math.round(body.length / 1024)}KB, past the 8MB a crawler will fetch`);
      else if (body.length > COMFORTABLE_IMAGE_BYTES) notes.push(`og:image is ${Math.round(body.length / 1024)}KB; under 300KB renders faster on a phone`);
      if (size.format === "unknown") fail("og:image is not a PNG, JPEG, GIF or WebP");
      const declaredWidth = metaContent(html, "og:image:width");
      if (declaredWidth && size.width && Number(declaredWidth) !== size.width) {
        fail(`og:image:width says ${declaredWidth} but the file is ${size.width}px; a mismatch makes WhatsApp drop the image`);
      }
      if (ratio && (ratio < 1.7 || ratio > 2.1)) {
        notes.push(`og:image is ${ratio.toFixed(2)}:1; 1.91:1 (1200x630) is what renders as a large card`);
      }
    }
  }

  for (const note of notes) console.log(`note    ${note}`);
  if (problems.length === 0) {
    console.log("\nThe preview card is complete.");
    console.log("If WhatsApp still shows a bare link, it cached the old scrape: re-scrape the URL at");
    console.log("https://developers.facebook.com/tools/debug/ and share it again.");
    return;
  }
  console.log();
  for (const problem of problems) console.error(`problem ${problem}`);
  process.exitCode = 1;
}

await main();
