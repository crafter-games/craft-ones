import type { ProjectileKind } from "./arsenal";
import { ARENA } from "./config";
import type { BattleView } from "./schema";

/**
 * What the battle just did, in terms a speaker can render. Every cue is derived
 * from two consecutive authoritative snapshots, so both seats and the local
 * playground hear the same match without the client inventing anything.
 */
export type SoundCue =
  | { kind: "fire"; weapon: ProjectileKind }
  | { kind: "bounce" }
  | { kind: "stick" }
  | { kind: "blast"; radius: number }
  | { kind: "hurt"; amount: number; mine: boolean }
  | { kind: "heal"; amount: number }
  | { kind: "shield" }
  | { kind: "leap" }
  | { kind: "dash" }
  | { kind: "jump" }
  | { kind: "step" }
  | { kind: "turn"; mine: boolean }
  | { kind: "win" }
  | { kind: "lose" };

/** Footsteps land on a grid instead of on every synced pixel. */
const STRIDE = 16;

function stride(x: number) {
  return Math.floor(x / STRIDE);
}

/**
 * Compare two snapshots and report what should be heard. Pure and order
 * independent: the same pair of frames always yields the same cues, which is
 * what keeps the mixer testable without a speaker.
 */
export function soundCues(
  before: BattleView | null,
  after: BattleView,
  sessionId: string,
): SoundCue[] {
  if (!before) return [];
  const cues: SoundCue[] = [];
  const mine = (id: string) => id === sessionId;

  if (before.phase !== "flying" && after.phase === "flying")
    cues.push({ kind: "fire", weapon: after.projectile.kind });
  if (after.projectile.bounces > before.projectile.bounces)
    cues.push({ kind: "bounce" });
  if (!before.projectile.stuck && after.projectile.stuck)
    cues.push({ kind: "stick" });
  if (after.explosion.id !== before.explosion.id)
    cues.push({ kind: "blast", radius: after.explosion.radius });

  if (after.lastAction !== before.lastAction) {
    if (after.lastAction === "shield") cues.push({ kind: "shield" });
    if (after.lastAction === "leap") cues.push({ kind: "leap" });
    if (after.lastAction === "dash") cues.push({ kind: "dash" });
  }

  for (const player of after.players) {
    const was = before.players.find((p) => p.sessionId === player.sessionId);
    if (!was) continue;
    if (player.hp < was.hp)
      cues.push({
        kind: "hurt",
        amount: was.hp - player.hp,
        mine: mine(player.sessionId),
      });
    if (player.hp > was.hp)
      cues.push({ kind: "heal", amount: player.hp - was.hp });
    if (player.movementSpent - was.movementSpent >= ARENA.jumpCost)
      cues.push({ kind: "jump" });
    if (
      after.phase === "aiming" &&
      player.sessionId === after.currentPlayer &&
      player.hp > 0 &&
      stride(player.x) !== stride(was.x)
    )
      cues.push({ kind: "step" });
  }

  if (after.turnNumber > before.turnNumber && after.phase !== "finished")
    cues.push({ kind: "turn", mine: mine(after.currentPlayer) });
  if (before.phase !== "finished" && after.phase === "finished")
    cues.push(after.winner === sessionId ? { kind: "win" } : { kind: "lose" });

  return cues;
}
