import { ARENA } from "./config";
import type { BattleView, PlayerView } from "./schema";
import { terrainHeight } from "./terrain";

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
type Point = { x: number; y: number };
type Rocket = Point & { vx: number; vy: number };

export function launch(
  player: Point,
  angle: number,
  power: number,
  terrain: ArrayLike<number>,
): Rocket {
  const speed = ARENA.minSpeed + power * (ARENA.maxSpeed - ARENA.minSpeed);
  const x = clamp(
    player.x + Math.cos(angle) * (ARENA.playerRadius + 2),
    0,
    ARENA.width,
  );
  return {
    x,
    y: clamp(
      player.y + Math.sin(angle) * (ARENA.playerRadius + 2),
      -ARENA.height,
      terrainHeight(terrain, x),
    ),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  };
}

function circleHit(
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: Point,
) {
  const ox = x - player.x,
    oy = y - player.y;
  const c = ox * ox + oy * oy - ARENA.playerRadius ** 2;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (!a) return Infinity;
  const b = 2 * (ox * dx + oy * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return Infinity;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : Infinity;
}

function boundaryHit(
  position: number,
  delta: number,
  minimum: number,
  maximum: number,
) {
  if (position < minimum || position > maximum) return 0;
  if (delta > 0 && position + delta >= maximum)
    return (maximum - position) / delta;
  if (delta < 0 && position + delta <= minimum)
    return (minimum - position) / delta;
  return Infinity;
}

// Intersect each crossed linear terrain segment, including high-speed shots.
function groundHit(
  rocket: Point,
  dx: number,
  dy: number,
  terrain: ArrayLike<number>,
) {
  if (rocket.y >= terrainHeight(terrain, rocket.x)) return 0;
  const intervals = [0, 1];
  if (dx !== 0) {
    const left = Math.max(
      0,
      Math.ceil(Math.min(rocket.x, rocket.x + dx) / ARENA.terrainStep),
    );
    const right = Math.min(
      terrain.length - 1,
      Math.floor(Math.max(rocket.x, rocket.x + dx) / ARENA.terrainStep),
    );
    for (let i = left; i <= right; i++) {
      const t = (i * ARENA.terrainStep - rocket.x) / dx;
      if (t > 0 && t < 1) intervals.push(t);
    }
  }
  intervals.sort((a, b) => a - b);
  for (let i = 1; i < intervals.length; i++) {
    const a = intervals[i - 1],
      b = intervals[i];
    const gapA =
      terrainHeight(terrain, rocket.x + dx * a) - (rocket.y + dy * a);
    const gapB =
      terrainHeight(terrain, rocket.x + dx * b) - (rocket.y + dy * b);
    if (gapB <= 0) return a + ((b - a) * gapA) / (gapA - gapB);
  }
  return Infinity;
}

export function advanceRocket(
  rocket: Rocket,
  players: Iterable<Pick<PlayerView, "x" | "y" | "hp">>,
  terrain: ArrayLike<number>,
) {
  const dt = ARENA.stepMs / 1000;
  const dx = rocket.vx * dt;
  const dy = rocket.vy * dt + 0.5 * ARENA.gravity * dt ** 2;
  let hit = Math.min(
    boundaryHit(rocket.x, dx, 0, ARENA.width),
    boundaryHit(rocket.y, dy, -ARENA.height, ARENA.height),
    groundHit(rocket, dx, dy, terrain),
  );
  for (const player of players)
    if (player.hp > 0)
      hit = Math.min(hit, circleHit(rocket.x, rocket.y, dx, dy, player));
  const travel = Math.min(1, hit);
  rocket.x = clamp(rocket.x + dx * travel, 0, ARENA.width);
  rocket.y = clamp(
    rocket.y + dy * travel,
    -ARENA.height,
    terrainHeight(terrain, rocket.x),
  );
  rocket.vy += ARENA.gravity * dt * travel;
  return hit <= 1;
}

export function trajectory(
  state: BattleView,
  player: PlayerView,
  angle: number,
  power: number,
) {
  const rocket = launch(player, angle, power, state.terrain);
  const points: Point[] = [{ x: rocket.x, y: rocket.y }];
  for (let step = 0; step < ARENA.maxFlightMs / ARENA.stepMs; step++) {
    const hit = advanceRocket(rocket, state.players, state.terrain);
    if (step % 6 === 0 || hit) points.push({ x: rocket.x, y: rocket.y });
    if (hit) break;
  }
  return points;
}
