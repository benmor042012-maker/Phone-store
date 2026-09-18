/**
 * Writes the icon files the manifest and the favicon link name, from the shipped icon art.
 *   node scripts/build-icons.mjs
 * favicon.ico wraps the 64px PNG: every browser since 2010 reads PNG-in-ICO, and it keeps
 * the file at a few kilobytes instead of a bitmap of every size.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const images = path.resolve(import.meta.dirname, "..", "client", "public", "images");
const source = path.join(images, "apple-touch-icon.png");

for (const size of [192, 512]) {
  await sharp(source).resize(size, size, { fit: "contain", background: "#090909" }).png().toFile(path.join(images, `icon-${size}.png`));
  console.log(`icon-${size}.png`);
}

const png = readFileSync(path.join(images, "favicon-64.png"));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
const entry = Buffer.alloc(16);
entry.writeUInt8(64, 0); // width
entry.writeUInt8(64, 1); // height
entry.writeUInt8(0, 2); // palette
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(header.length + entry.length, 12);
writeFileSync(path.resolve(images, "..", "favicon.ico"), Buffer.concat([header, entry, png]));
console.log("favicon.ico");
