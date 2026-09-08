import { ARENA } from "./config";
import type { Player } from "./schema";
import { bodyBlocked, type Geometry, grounded } from "./terrainGrid";

/**
 * The movement budget is a range around the spot where the turn started, not a
 * path length: walking back toward that spot gives the range back. Jumps also
 * spend part of the range outright, and that part never returns.
 */
export function movementRange(player: Player) {
  return Math.max(0, ARENA.moveBudget - player.movementSpent);
}

/** How far the player may still travel in `direction` before leaving the range. */
export function movementRoom(player: Player, direction: number) {
  if (!direction) return 0;
  const edge = player.originX + Math.sign(direction) * movementRange(player);
  return Math.max(0, (edge - player.x) * Math.sign(direction));
}

/** Publish the range left, so clients and controls read one authoritative number. */
export function syncMovement(player: Player) {
  player.movementLeft = Math.max(
    0,
    movementRange(player) - Math.abs(player.x - player.originX),
  );
}

/** Anchor the range on where the player stands now. */
export function resetMovement(player: Player) {
  player.originX = player.x;
  player.movementSpent = 0;
  player.movementLeft = ARENA.moveBudget;
}

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
    const room = budgeted ? movementRoom(player, Math.sign(player.vx)) : 0;
    const delta = budgeted
      ? Math.sign(player.vx) * Math.min(Math.abs(player.vx * dt), room)
      : player.vx * dt;
    moveHorizontal(world, player, delta);
    if (budgeted) {
      syncMovement(player);
      if (room < 0.001) player.vx = 0;
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
