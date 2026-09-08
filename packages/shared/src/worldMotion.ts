import { ARENA } from "./config";
import type { Player } from "./schema";
import { bodyBlocked, type Geometry, grounded } from "./terrainGrid";

export function moveHorizontal(
  world: Geometry,
  player: Player,
  delta: number,
  climb = false,
) {
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / 2));
  let moved = 0;
  for (let i = 0; i < steps; i++) {
    const x = player.x + delta / steps;
    if (!bodyBlocked(world, x, player.y)) {
      player.x = x;
      moved += Math.abs(delta / steps);
      continue;
    }
    if (climb && grounded(world, player.x, player.y)) {
      let raised = false;
      for (let up = 2; up <= 10; up += 2)
        if (!bodyBlocked(world, x, player.y - up)) {
          player.x = x;
          player.y -= up;
          moved += Math.abs(delta / steps);
          raised = true;
          break;
        }
      if (raised) continue;
    }
    player.vx = 0;
    break;
  }
  return moved;
}

export function worldBodyStep(
  world: Geometry,
  players: Iterable<Player>,
  controlled?: ReadonlySet<Player>,
) {
  const dt = ARENA.stepMs / 1000;
  for (const player of players) {
    if (player.hp <= 0) continue;
    const budgeted = controlled?.has(player);
    const delta = budgeted
      ? Math.sign(player.vx) *
        Math.min(Math.abs(player.vx * dt), player.movementLeft)
      : player.vx * dt;
    const moved = moveHorizontal(world, player, delta);
    if (budgeted) {
      player.movementLeft = Math.max(0, player.movementLeft - moved);
      if (player.movementLeft < 0.001) {
        player.movementLeft = 0;
        player.vx = 0;
      }
    }
    const dy = player.vy * dt + 0.5 * ARENA.gravity * dt * dt;
    player.vy += ARENA.gravity * dt;
    const steps = Math.max(1, Math.ceil(Math.abs(dy) / 2));
    for (let i = 0; i < steps; i++) {
      const y = player.y + dy / steps;
      if (bodyBlocked(world, player.x, y)) {
        let lo = 0,
          hi = 1;
        for (let n = 0; n < 12; n++) {
          const mid = (lo + hi) / 2;
          if (bodyBlocked(world, player.x, player.y + (dy / steps) * mid))
            hi = mid;
          else lo = mid;
        }
        player.y += (dy / steps) * lo;
        player.vy = 0;
        break;
      }
      player.y = y;
    }
    if (grounded(world, player.x, player.y)) player.vx *= 0.75;
    if (Math.abs(player.vx) < 1) player.vx = 0;
    if (player.y > world.worldHeight + 60) {
      player.hp = 0;
      player.vx = 0;
      player.vy = 0;
    }
  }
}
