import { PROJECTILES, type ProjectileKind } from "./arsenal";
import { advanceRocket, clamp } from "./ballistics";
import { ARENA } from "./config";
import type { PlayerView } from "./schema";
import { type Geometry, gridHit, solidAt } from "./terrainGrid";

export type Shot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: ProjectileKind;
  elapsedMs: number;
  bounces: number;
  stuck: boolean;
  attachedPlayer: number;
  offsetX: number;
  offsetY: number;
};
export type Impact = "flying" | "blast" | "anchor" | "miss";

export function launchShot(
  world: Geometry,
  player: { x: number; y: number },
  angle: number,
  power: number,
  kind: ProjectileKind,
): Shot {
  const spec = PROJECTILES[kind];
  const speed = spec.minSpeed + power * (spec.maxSpeed - spec.minSpeed);
  const reach = ARENA.playerRadius + 4;
  const x = clamp(player.x + Math.cos(angle) * reach, 1, world.worldWidth - 1);
  const y = player.y + Math.sin(angle) * reach;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    kind,
    elapsedMs: 0,
    bounces: 0,
    stuck: false,
    attachedPlayer: 0,
    offsetX: 0,
    offsetY: 0,
  };
}

function bodyHit(
  x: number,
  y: number,
  dx: number,
  dy: number,
  players: Pick<PlayerView, "x" | "y" | "hp">[],
) {
  let hit = Infinity;
  for (const p of players) {
    if (p.hp <= 0) continue;
    const ox = x - p.x,
      oy = y - p.y,
      c = ox * ox + oy * oy - ARENA.playerRadius ** 2;
    if (c <= 0) {
      hit = 0;
      continue;
    }
    const a = dx * dx + dy * dy,
      b = 2 * (ox * dx + oy * dy),
      discriminant = b * b - 4 * a * c;
    if (a > 0 && discriminant >= 0) {
      const t = (-b - Math.sqrt(discriminant)) / (2 * a);
      if (t >= 0 && t <= 1) hit = Math.min(hit, t);
    }
  }
  return hit;
}

export function advanceShot(
  shot: Shot,
  world: Geometry,
  players: Pick<PlayerView, "x" | "y" | "hp">[],
): Impact {
  const spec = PROJECTILES[shot.kind],
    dt = ARENA.stepMs / 1000,
    wind = shot.kind === "grapple" ? 0 : (world.wind ?? 0);
  shot.elapsedMs += ARENA.stepMs;
  const bodies = Array.from(players);
  if (shot.stuck) {
    const target = bodies[shot.attachedPlayer - 1];
    if (target) {
      shot.x = target.x + shot.offsetX;
      shot.y = target.y + shot.offsetY;
    }
    return shot.elapsedMs + 0.001 >= spec.fuse ? "blast" : "flying";
  }
  if (!world.terrainRows.length && shot.kind === "rocket") {
    // A plain Rocket, not the Shot itself: scriptc copies a record passed as a narrower type.
    const rocket = { x: shot.x, y: shot.y, vx: shot.vx, vy: shot.vy };
    const hit = advanceRocket(rocket, bodies, world.terrain, wind);
    shot.x = rocket.x;
    shot.y = rocket.y;
    shot.vx = rocket.vx;
    shot.vy = rocket.vy;
    return hit ? "blast" : "flying";
  }
  const dx = shot.vx * dt + 0.5 * wind * dt ** 2,
    dy = shot.vy * dt + 0.5 * ARENA.gravity * spec.gravity * dt ** 2;
  const terrain = gridHit(world, shot.x, shot.y, dx, dy);
  const player =
    shot.kind === "grapple" || spec.bounce
      ? Infinity
      : bodyHit(shot.x, shot.y, dx, dy, bodies);
  const hit = Math.min(terrain, player);
  if (hit <= 1) {
    const travel = Math.max(0, hit - 0.001);
    shot.x += dx * travel;
    shot.y += dy * travel;
    shot.vx += wind * dt * travel;
    if (shot.kind === "grapple")
      return shot.x <= 2 || shot.x >= world.worldWidth - 2 ? "miss" : "anchor";
    if (shot.kind === "sticky") {
      shot.stuck = true;
      shot.vx = 0;
      shot.vy = 0;
      if (player < terrain) {
        const index = bodies.findIndex(
          (p) =>
            p.hp > 0 &&
            Math.hypot(p.x - shot.x, p.y - shot.y) <= ARENA.playerRadius + 1,
        );
        if (index >= 0) {
          shot.attachedPlayer = index + 1;
          shot.offsetX = shot.x - bodies[index].x;
          shot.offsetY = shot.y - bodies[index].y;
        }
      }
    } else if (spec.bounce) {
      const hitX = shot.x + dx * 0.003,
        hitY = shot.y + dy * 0.003;
      const wall = solidAt(world, hitX + Math.sign(dx) * 3, shot.y);
      const floor = solidAt(world, shot.x, hitY + Math.sign(dy) * 3);
      if (wall || !floor) shot.vx = -shot.vx * spec.bounce;
      else shot.vx *= 0.78;
      if (floor || !wall) shot.vy = -shot.vy * spec.bounce;
      else shot.vy *= 0.8;
      shot.bounces++;
      // Remove sub-pixel jitter once a thrown object has come to rest.
      if (Math.abs(shot.vy) < 25 && floor) shot.vy = 0;
    } else return "blast";
  } else {
    shot.x += dx;
    shot.y += dy;
    shot.vx += wind * dt;
    shot.vy += ARENA.gravity * spec.gravity * dt;
  }
  if (
    shot.y > world.worldHeight + 80 ||
    shot.x < 0 ||
    shot.x > world.worldWidth
  )
    return "miss";
  if (shot.elapsedMs + 0.001 >= spec.fuse)
    return shot.kind === "grapple" ? "miss" : "blast";
  return "flying";
}

export function shotTrajectory(
  world: Geometry,
  players: PlayerView[],
  player: PlayerView,
  angle: number,
  power: number,
  kind: ProjectileKind,
) {
  const shot = launchShot(world, player, angle, power, kind);
  const points = [{ x: shot.x, y: shot.y }];
  for (let i = 0; i < 480; i++) {
    const result = advanceShot(shot, world, players);
    if (i % 6 === 0 || result !== "flying")
      points.push({ x: shot.x, y: shot.y });
    if (result !== "flying") break;
  }
  return points;
}
