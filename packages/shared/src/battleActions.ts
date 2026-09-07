import { type PlayerOptions, validPlayerOptions } from "./arsenal";
import { ARENA } from "./config";
import type { BattleState, Player } from "./schema";
import { bodyBlocked, grounded } from "./terrainGrid";
import { moveHorizontal } from "./worldMotion";

export function setAppearance(player: Player, options: unknown) {
  if (!validPlayerOptions(options)) return false;
  player.species = options.species;
  player.coat = options.coat;
  return true;
}
export const defaultAppearance = (number: number): PlayerOptions =>
  number === 1
    ? { species: "cuy", coat: "caramel" }
    : { species: "llama", coat: "cream" };

export function validateTurn(
  state: BattleState,
  sessionId: string,
  payload: unknown,
): Player | null {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    state.phase !== "aiming" ||
    state.currentPlayer !== sessionId ||
    (payload as { turnNumber?: unknown }).turnNumber !== state.turnNumber
  )
    return null;
  return (
    state.players.find(
      (p) => p.sessionId === sessionId && p.connected && p.hp > 0,
    ) ?? null
  );
}

export function worldMove(
  state: BattleState,
  player: Player,
  direction: number,
) {
  if (player.vy < -1 || !grounded(state, player.x, player.y))
    return "Land before moving";
  const before = { x: player.x, y: player.y };
  moveHorizontal(state, player, direction * ARENA.moveStep, true);
  if (
    state.players.some(
      (p) =>
        p !== player &&
        p.hp > 0 &&
        Math.hypot(p.x - player.x, p.y - player.y) < ARENA.playerRadius * 2,
    )
  ) {
    player.x = before.x;
    player.y = before.y;
    return "Another player is in the way";
  }
  return null;
}

export function pullTowardAnchor(state: BattleState, player: Player) {
  const dx = state.projectile.x - player.x,
    dy = state.projectile.y - player.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 28) return false;
  const travel = Math.min(7, distance - 25);
  for (let i = 0; i < 4; i++) {
    const x = player.x + ((dx / distance) * travel) / 4,
      y = player.y + ((dy / distance) * travel) / 4;
    if (
      bodyBlocked(state, x, y) ||
      state.players.some(
        (p) =>
          p !== player &&
          p.hp > 0 &&
          Math.hypot(p.x - x, p.y - y) < ARENA.playerRadius * 2,
      )
    )
      return false;
    player.x = x;
    player.y = y;
  }
  player.vx = 0;
  player.vy = 0;
  return true;
}
