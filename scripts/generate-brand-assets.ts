import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "opentype.js";
import sharp from "sharp";

const root = join(import.meta.dir, "..");
const sources = join(root, "assets/brand");
const brand = join(root, "apps/web/public/brand");
const app = join(root, "apps/web/src/app");
const icon = join(sources, "icon-master.png");
const artwork = join(sources, "key-art-master.png");
const fonts = await Promise.all(
  ["Archivo.ttf", "Bungee-Regular.ttf"].map(async (file) =>
    parse(await Bun.file(join(sources, "fonts", file)).arrayBuffer()),
  ),
);

await mkdir(brand, { recursive: true });

async function text(
  value: string,
  size: number,
  color: string,
  display = false,
) {
  const path = fonts[display ? 1 : 0].getPath(value, 0, 0, size);
  const box = path.getBoundingBox();
  const width = Math.ceil(box.x2 - box.x1 + 2);
  const height = Math.ceil(box.y2 - box.y1 + 2);
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${box.x1 - 1} ${box.y1 - 1} ${width} ${height}"><path d="${path.toPathData(3)}" fill="${color}"/></svg>`,
    ),
  )
    .png()
    .toBuffer();
}

async function titleCard() {
  return sharp(artwork)
    .resize(1200, 630)
    .composite([
      {
        input: await text("BY CRAFTER STATION", 17, "#8cd5bb"),
        left: 64,
        top: 64,
      },
      {
        input: await text("CRAFT", 104, "#fff1d6", true),
        left: 56,
        top: 158,
      },
      {
        input: await text("ONES", 104, "#f3c677", true),
        left: 56,
        top: 270,
      },
      {
        input: await text("Small paws. Big trouble.", 30, "#fff1d6"),
        left: 64,
        top: 405,
      },
      {
        input: await text(
          "Free 1v1 artillery · Browser + Discord",
          19,
          "#a9b7a5",
        ),
        left: 64,
        top: 458,
      },
      {
        input: await text("craft-ones.crafter.run", 18, "#8cd5bb"),
        left: 64,
        top: 554,
      },
    ])
    .png()
    .toBuffer();
}

await sharp(icon)
  .resize(160, 160)
  .webp({ quality: 92 })
  .toFile(join(brand, "craft-ones-icon.webp"));
for (const size of [192, 512]) {
  await sharp(icon)
    .resize(size, size)
    .png()
    .toFile(join(brand, `craft-ones-icon-${size}.png`));
}
await sharp(icon).resize(48, 48).png().toFile(join(app, "icon.png"));
await sharp(icon).resize(180, 180).png().toFile(join(app, "apple-icon.png"));

const sizes = [16, 32, 48];
const frames = await Promise.all(
  sizes.map((size) =>
    sharp(icon).resize(size, size).ensureAlpha().png().toBuffer(),
  ),
);
const directory = Buffer.alloc(6 + 16 * sizes.length);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
frames.forEach((frame, index) => {
  const start = 6 + index * 16;
  directory[start] = sizes[index];
  directory[start + 1] = sizes[index];
  directory.writeUInt16LE(1, start + 4);
  directory.writeUInt16LE(32, start + 6);
  directory.writeUInt32LE(frame.length, start + 8);
  directory.writeUInt32LE(offset, start + 12);
  offset += frame.length;
});
await Bun.write(
  join(app, "favicon.ico"),
  Buffer.concat([directory, ...frames]),
);

const card = await titleCard();
await sharp(card)
  .jpeg({ quality: 92, mozjpeg: true })
  .toFile(join(brand, "craft-ones-og.jpg"));
await sharp(card)
  .resize(1920, 1008)
  .extend({ top: 36, bottom: 36, left: 0, right: 0, background: "#0a291f" })
  .jpeg({ quality: 94, mozjpeg: true })
  .toFile(join(brand, "craft-ones-discord-cover.jpg"));

const squareTitle = await text("CRAFT ONES", 76, "#fff1d6", true);
const squareSubtitle = await text("Small paws. Big trouble.", 30, "#f3c677");
const titleWidth = (await sharp(squareTitle).metadata()).width ?? 0;
const subtitleWidth = (await sharp(squareSubtitle).metadata()).width ?? 0;
const fade = Buffer.from(
  '<svg width="1080" height="1080"><defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="#0a291f" stop-opacity="0"/><stop offset="0.81" stop-color="#0a291f"/><stop offset="1" stop-color="#0a291f"/></linearGradient></defs><rect width="1080" height="1080" fill="url(#fade)"/></svg>',
);
await sharp(icon)
  .resize(1080, 1080)
  .composite([
    { input: fade, left: 0, top: 0 },
    { input: squareTitle, left: Math.round((1080 - titleWidth) / 2), top: 862 },
    {
      input: squareSubtitle,
      left: Math.round((1080 - subtitleWidth) / 2),
      top: 976,
    },
  ])
  .jpeg({ quality: 92, mozjpeg: true })
  .toFile(join(brand, "craft-ones-social-square.jpg"));

console.info(
  "Generated Craft Ones icons, favicon, social cards and Discord cover.",
);
