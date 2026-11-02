// Shots against critter silhouettes. Only +, -, *, / and Math.sqrt, so every peer gets the same answer.
import type { Species } from "./arsenal";
import { HITBOXES } from "./hitboxes";

export type HitBody = {
  x: number;
  y: number;
  hp: number;
  species: Species;
  facing: number;
};

const vertexX = (body: HitBody, poly: readonly number[], i: number) =>
  body.x + (body.facing < 0 ? -poly[i] : poly[i]);
const vertexY = (body: HitBody, poly: readonly number[], i: number) =>
  body.y + poly[i + 1];

/** Even-odd test of a world point against a critter's silhouette. */
export function insideBody(body: HitBody, px: number, py: number): boolean {
  const poly = HITBOXES[body.species];
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = vertexX(body, poly, i),
      yi = vertexY(body, poly, i),
      xj = vertexX(body, poly, j),
      yj = vertexY(body, poly, j);
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

/** Fraction along (dx, dy) where a segment from (x, y) first crosses the silhouette's outline, or Infinity. */
export function segmentBodyHit(
  body: HitBody,
  x: number,
  y: number,
  dx: number,
  dy: number,
): number {
  const poly = HITBOXES[body.species];
  let hit = Infinity;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const ax = vertexX(body, poly, j),
      ay = vertexY(body, poly, j),
      ex = vertexX(body, poly, i) - ax,
      ey = vertexY(body, poly, i) - ay;
    const denominator = dx * ey - dy * ex;
    if (denominator === 0) continue;
    const ox = ax - x,
      oy = ay - y;
    const t = (ox * ey - oy * ex) / denominator;
    const u = (ox * dy - oy * dx) / denominator;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t < hit) hit = t;
  }
  return hit;
}

/** Distance from a point to the silhouette, 0 inside it. */
export function distanceToBody(body: HitBody, px: number, py: number): number {
  if (insideBody(body, px, py)) return 0;
  const poly = HITBOXES[body.species];
  let best = Infinity;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const ax = vertexX(body, poly, j),
      ay = vertexY(body, poly, j),
      ex = vertexX(body, poly, i) - ax,
      ey = vertexY(body, poly, i) - ay;
    const length = ex * ex + ey * ey;
    let s = length > 0 ? ((px - ax) * ex + (py - ay) * ey) / length : 0;
    s = s < 0 ? 0 : s > 1 ? 1 : s;
    const qx = ax + ex * s - px,
      qy = ay + ey * s - py;
    const d = qx * qx + qy * qy;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

/**
 * First body a shot's step meets: its fraction along the step and index, or t Infinity. A shot that starts
 * inside a body hits it at 0, except the shooter's own, which it is still leaving.
 */
export function bodiesHit(
  bodies: readonly HitBody[],
  x: number,
  y: number,
  dx: number,
  dy: number,
  shooter: number,
): { t: number; index: number } {
  let t = Infinity;
  let index = -1;
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    if (body.hp <= 0) continue;
    if (insideBody(body, x, y)) {
      if (i === shooter) continue;
      return { t: 0, index: i };
    }
    const hit = segmentBodyHit(body, x, y, dx, dy);
    if (hit < t) {
      t = hit;
      index = i;
    }
  }
  return { t, index };
}
