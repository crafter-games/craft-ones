import { ARENA } from "./config";
import { terrainHeight } from "./terrain";

export const CELL = 8;
export type Geometry = {
  worldWidth: number;
  worldHeight: number;
  terrain: ArrayLike<number>;
  terrainRows: ArrayLike<string>;
  /** Horizontal projectile acceleration in world units per second squared. */
  wind?: number;
};
type MutableRows = { length: number; [index: number]: string };

/** Compact replicated occupancy rows support islands, caves and circular holes. */
export function solidAt(world: Geometry, x: number, y: number): boolean {
  if (x < 0 || x >= world.worldWidth) return true;
  if (y < -world.worldHeight) return true;
  if (y < 0 || y >= world.worldHeight) return false;
  if (!world.terrainRows.length) return y >= terrainHeight(world.terrain, x);
  return (
    world.terrainRows[Math.floor(y / CELL)]?.[Math.floor(x / CELL)] === "1"
  );
}

export function bodyBlocked(
  world: Geometry,
  x: number,
  y: number,
  radius = ARENA.playerRadius,
): boolean {
  if (!world.terrainRows.length)
    return (
      y + radius > terrainHeight(world.terrain, x) ||
      x - radius < 0 ||
      x + radius > world.worldWidth
    );
  if (x - radius < 0 || x + radius > world.worldWidth) return true;
  for (
    let row = Math.max(0, Math.floor((y - radius) / CELL));
    row <=
    Math.min(world.terrainRows.length - 1, Math.floor((y + radius) / CELL));
    row++
  ) {
    for (
      let col = Math.max(0, Math.floor((x - radius) / CELL));
      col <=
      Math.min(world.worldWidth / CELL - 1, Math.floor((x + radius) / CELL));
      col++
    ) {
      if (world.terrainRows[row][col] !== "1") continue;
      const nx = Math.max(col * CELL, Math.min((col + 1) * CELL, x));
      const ny = Math.max(row * CELL, Math.min((row + 1) * CELL, y));
      if ((nx - x) ** 2 + (ny - y) ** 2 < radius ** 2 - 0.001) return true;
    }
  }
  return false;
}

export function grounded(world: Geometry, x: number, y: number) {
  return bodyBlocked(world, x, y + 1);
}

export function eraseCircle(
  rows: MutableRows,
  x: number,
  y: number,
  radius: number,
) {
  for (
    let row = Math.max(0, Math.floor((y - radius) / CELL));
    row <= Math.min(rows.length - 1, Math.ceil((y + radius) / CELL));
    row++
  ) {
    const cells = rows[row].split("");
    let changed = false;
    for (
      let col = Math.max(0, Math.floor((x - radius) / CELL));
      col <= Math.min(cells.length - 1, Math.ceil((x + radius) / CELL));
      col++
    ) {
      if (
        Math.hypot((col + 0.5) * CELL - x, (row + 0.5) * CELL - y) <= radius &&
        cells[col] === "1"
      ) {
        cells[col] = "0";
        changed = true;
      }
    }
    if (changed) rows[row] = cells.join("");
  }
}

/** Sweep in <=2px increments: rockets and hooks cannot tunnel through 8px cells. */
export function gridHit(
  world: Geometry,
  x: number,
  y: number,
  dx: number,
  dy: number,
) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (solidAt(world, x + dx * t, y + dy * t)) {
      let lo = Math.max(0, (i - 1) / steps),
        hi = t;
      for (let n = 0; n < 10; n++) {
        const mid = (lo + hi) / 2;
        if (solidAt(world, x + dx * mid, y + dy * mid)) hi = mid;
        else lo = mid;
      }
      return hi;
    }
  }
  return Infinity;
}
