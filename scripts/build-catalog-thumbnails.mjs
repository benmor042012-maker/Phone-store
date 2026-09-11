/**
 * Grid-sized copies of the catalogue photos.
 *
 * The shipped photos are 800px squares, and the storefront draws them at about 190px: a
 * page of 24 products was pulling half a megabyte of pixels it had no way to show. This
 * writes a 480px copy of each one next to it, which covers the largest slot on a desktop
 * at twice the pixel density, and the grid offers both through `srcset` so the browser
 * takes the small one on a phone and the original where it is actually worth it.
 *
 * The catalogue ships with the site, so this is run when photos are added, not on every
 * build:  pnpm thumbs
 */
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SOURCE = path.resolve(import.meta.dirname, "..", "client", "public", "images", "catalog");
const OUT = path.join(SOURCE, "sm");
const EDGE = 480;
const QUALITY = 78;

const force = process.argv.includes("--force");

async function sizeOf(file) {
  try {
    return (await stat(file)).size;
  } catch {
    return 0;
  }
}

const entries = (await readdir(SOURCE)).filter((name) => name.endsWith(".webp"));
await mkdir(OUT, { recursive: true });

let written = 0;
let skipped = 0;
let before = 0;
let after = 0;

for (const name of entries) {
  const source = path.join(SOURCE, name);
  const target = path.join(OUT, name);
  const sourceBytes = await sizeOf(source);
  const existing = await sizeOf(target);
  before += sourceBytes;
  if (existing && !force) {
    after += existing;
    skipped += 1;
    continue;
  }
  // `withoutEnlargement` keeps a photo that is already small from being blown up, which
  // would make the "small" copy the larger of the two.
  const buffer = await sharp(source)
    .resize({ width: EDGE, height: EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 6 })
    .toBuffer();
  await writeFile(target, buffer);
  after += buffer.byteLength;
  written += 1;
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
console.log(`${entries.length} photos: ${written} written, ${skipped} already current`);
console.log(`originals ${mb(before)} → grid copies ${mb(after)} (${Math.round(100 - (after / before) * 100)}% smaller)`);
