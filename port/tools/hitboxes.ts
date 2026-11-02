// Traces each critter's resting silhouette into the hit polygon the simulation uses.
// Run after `bun tools/rasterize.ts`: bun tools/hitboxes.ts. Writes packages/shared/src/hitboxes.ts.
import { join } from "node:path";
import sharp from "sharp";
import { SPECIES, type Species } from "../../packages/shared/src/arsenal";
import { HEAD_SCALE, handPose, joints } from "../src/art/pose";

const art = join(import.meta.dir, "../assets/art");
const out = join(import.meta.dir, "../../packages/shared/src/hitboxes.ts");
const COAT = "caramel";
// Parts draw as an 80x100 box centred on their joint (render.ts drawCritter).
const PART_W = 80;
const PART_H = 100;
const RAYS = 72;
const ALPHA = 128;
const GAP = 1.5;
const TOLERANCE = 0.75;

type Mask = { w: number; h: number; alpha: Uint8Array };
type Placed = {
  mask: Mask;
  tx: number;
  ty: number;
  rot: number;
  scale: number;
};
type Point = [number, number];

async function load(species: Species, part: string): Promise<Mask> {
  const { data, info } = await sharp(join(art, species, COAT, `${part}.png`))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  return { w: info.width, h: info.height, alpha };
}

// Whether a world-space point (player-local units, facing right) lands on an opaque texel of a part.
function solid(p: Placed, x: number, y: number): boolean {
  const c = Math.cos(-p.rot);
  const s = Math.sin(-p.rot);
  const lx = ((x - p.tx) * c - (y - p.ty) * s) / p.scale;
  const ly = ((x - p.tx) * s + (y - p.ty) * c) / p.scale;
  const u = Math.floor(((lx + PART_W / 2) / PART_W) * p.mask.w);
  const v = Math.floor(((ly + PART_H / 2) / PART_H) * p.mask.h);
  if (u < 0 || v < 0 || u >= p.mask.w || v >= p.mask.h) return false;
  return p.mask.alpha[v * p.mask.w + u] >= ALPHA;
}

async function silhouette(species: Species): Promise<Placed[]> {
  const j = joints[species];
  const at = async (
    part: string,
    tx: number,
    ty: number,
    rot = 0,
    scale = 1,
  ): Promise<Placed> => ({
    mask: await load(species, part),
    tx,
    ty,
    rot,
    scale,
  });
  const front = handPose(species, true, 0);
  const back = handPose(species, false, 0);
  const head = (xy: readonly number[]): [number, number] => [
    j.neck[0] + xy[0] * HEAD_SCALE,
    j.neck[1] + xy[1] * HEAD_SCALE,
  ];
  return Promise.all([
    at("tail", 0, 0),
    at("legBack", j.hipBack[0], j.hipBack[1]),
    at("footBack", j.hipBack[0] + j.ankle[0], j.hipBack[1] + j.ankle[1]),
    at("legFront", j.hipFront[0], j.hipFront[1]),
    at("footFront", j.hipFront[0] + j.ankle[0], j.hipFront[1] + j.ankle[1]),
    at("handBack", back.x, back.y, back.angle),
    at("handFront", front.x, front.y, front.angle),
    at("body", 0, 0),
    at("earBack", ...head(j.earBack), 0, HEAD_SCALE),
    at("earFront", ...head(j.earFront), 0, HEAD_SCALE),
    at("head", j.neck[0], j.neck[1], 0, HEAD_SCALE),
  ]);
}

// One vertex per ray from the critter's centre: where the silhouette first ends, so the gap between the legs
// stays open and nothing outside the drawing counts.
function trace(parts: Placed[]): Point[] {
  const opaque = (x: number, y: number) => parts.some((p) => solid(p, x, y));
  const ring: Point[] = [];
  for (let i = 0; i < RAYS; i++) {
    const a = (i / RAYS) * Math.PI * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let edge = 0;
    for (let r = 0; r < 90; r += 0.25) {
      if (opaque(dx * r, dy * r)) edge = r;
      else if (r - edge > GAP) break;
    }
    ring.push([dx * edge, dy * edge]);
  }
  return ring;
}

function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  let worst = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d =
      Math.abs(
        (bx - ax) * (ay - points[i][1]) - (ax - points[i][0]) * (by - ay),
      ) / len;
    if (d > worst) {
      worst = d;
      index = i;
    }
  }
  if (worst <= tolerance) return [points[0], points[points.length - 1]];
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
}

const round = (n: number) => Math.round(n * 2) / 2;
const lines: string[] = [];
for (const species of SPECIES) {
  const ring = trace(await silhouette(species));
  // Split the ring at its opposite ray so each half has distinct ends.
  const half = RAYS / 2;
  const closed = [
    ...simplify(ring.slice(0, half + 1), TOLERANCE).slice(0, -1),
    ...simplify([...ring.slice(half), ring[0]], TOLERANCE).slice(0, -1),
  ];
  const flat = closed.flatMap(([x, y]) => [round(x), round(y)]);
  lines.push(`  ${species}: [${flat.join(", ")}],`);
  console.log(`${species}: ${closed.length} vertices`);
}

await Bun.write(
  out,
  `// Generated by port/tools/hitboxes.ts from the critter art. Do not edit by hand.
// Each critter's resting silhouette as a polygon, flat [x0, y0, x1, y1, ...] in world units around the
// player's position, facing right (+x). Mirror x when the critter faces left.
import type { Species } from "./arsenal";

export const HITBOXES: Record<Species, readonly number[]> = {
${lines.join("\n")}
};
`,
);
