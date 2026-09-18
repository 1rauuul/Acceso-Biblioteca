import sharp from "sharp";
import fs from "node:fs";

const SRC = "www.png";

async function iconFile(size, innerRatio, out) {
  const inner = Math.round(size * innerRatio);
  const offset = Math.round((size - inner) / 2);
  const logo = await sharp(SRC)
    .flatten({ background: "#ffffff" })
    .resize(inner, inner, { fit: "contain", background: "#ffffff" })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: "#ffffff" },
  })
    .composite([{ input: logo, left: offset, top: offset }])
    .png()
    .toFile(out);
  console.log("wrote", out);
}

async function faviconIco(size, out) {
  const png = await sharp(SRC)
    .flatten({ background: "#ffffff" })
    .resize(size, size)
    .ensureAlpha()
    .png()
    .toBuffer();
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  fs.writeFileSync(out, Buffer.concat([header, entry, png]));
  console.log("wrote", out);
}

await iconFile(192, 0.8, "public/icons/icon-192x192.png");
await iconFile(512, 0.8, "public/icons/icon-512x512.png");
await iconFile(180, 0.85, "app/apple-icon.png");
await iconFile(128, 1, "app/icon.png");
await faviconIco(256, "app/favicon.ico");
