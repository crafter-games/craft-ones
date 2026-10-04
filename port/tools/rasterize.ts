// Rasterizes the web app's SVG art into PNGs that dotframe can load (it decodes PNG only).
// Output goes to port/assets/art, which is generated and not committed.
import { mkdir, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import sharp from "sharp";

const source = join(import.meta.dir, "../../apps/web/public/art");
const out = join(import.meta.dir, "../assets/art");

// Pixel width per folder; maps only need to cover the fitted camera, parts and weapons draw small.
const width = (path: string): number =>
  path.startsWith("maps/")
    ? path.includes("-preview")
      ? 0
      : 1344
    : path.startsWith("weapons/")
      ? 192
      : 160;

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
    ),
  );
  return files.flat().filter((f) => f.endsWith(".svg"));
}

let count = 0;
for (const file of await walk(source)) {
  const rel = relative(source, file);
  const w = width(rel);
  if (!rel.includes("/") || w === 0) continue;
  const target = join(out, rel.replace(/\.svg$/, ".png"));
  await mkdir(dirname(target), { recursive: true });
  await sharp(file, { density: 300 }).resize({ width: w }).png().toFile(target);
  count++;
}
console.log(`rasterized ${count} files into ${relative(process.cwd(), out)}`);
