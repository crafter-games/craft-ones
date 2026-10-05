import { ARENA } from "./config";
import type { Player } from "./schema";
import { terrainHeight } from "./terrain";

/** Player gravity uses the same fixed step as rockets, including during flight. */
export function settlePlayers(players: Player[], terrain: number[]) {
  const dt = ARENA.stepMs / 1000;
  for (const player of players) {
    const ground = terrainHeight(terrain, player.x) - ARENA.playerRadius;
    if (player.y >= ground && player.vy >= 0) {
      player.y = ground;
      player.vy = 0;
      continue;
    }
    player.y += player.vy * dt + 0.5 * ARENA.gravity * dt ** 2;
    player.vy += ARENA.gravity * dt;
    if (player.y >= ground) {
      player.y = ground;
      player.vy = 0;
    }
  }
}
