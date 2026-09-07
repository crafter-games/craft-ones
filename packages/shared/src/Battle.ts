import { advanceRocket, clamp, launch } from "./ballistics";
import { ARENA } from "./config";
import { settlePlayers } from "./playerMotion";
import { BattleState, type FireAction, Player } from "./schema";
import { carveCrater, type MapId, makeTerrain, terrainHeight } from "./terrain";

const MAX_CATCH_UP_STEPS = 6;
const EPSILON = 1e-7;

function isFireAction(value: unknown): value is FireAction {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const { angle, power, turnNumber } = value as Record<string, unknown>;
  return (
    typeof angle === "number" &&
    Number.isFinite(angle) &&
    angle >= -Math.PI &&
    angle <= Math.PI &&
    typeof power === "number" &&
    Number.isFinite(power) &&
    power >= 0 &&
    power <= 1 &&
    typeof turnNumber === "number" &&
    Number.isSafeInteger(turnNumber) &&
    turnNumber > 0
  );
}

export class Battle {
  readonly state = new BattleState();
  private accumulator = 0;
  private bodyAccumulator = 0;
  private lastNow = Number.NEGATIVE_INFINITY;
  private turnDeadline = 0;
  private flightDeadline = 0;
  private flightMs = 0;
  private explosionDeadline = 0;

  private moveSequence = 0;
  private moveAt = -Infinity;
  // Local lab options are never exposed by BattleRoom's message handlers.
  infiniteHp = false;
  destructible = false;

  constructor(
    private readonly now: () => number = () => performance.now(),
    mapId: MapId = "flat",
  ) {
    this.state.mapId = mapId;
    this.state.terrain.push(...makeTerrain(mapId));
  }

  move(sessionId: string, payload: unknown): string | null {
    const now = this.clockNow();
    if (this.state.phase === "aiming" && now >= this.turnDeadline) {
      this.nextTurn(now);
      return "Turn expired";
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      return "Invalid move";
    const { direction, turnNumber, sequence } = payload as Record<
      string,
      unknown
    >;
    if (
      (direction !== -1 && direction !== 1) ||
      !Number.isSafeInteger(sequence) ||
      (sequence as number) <= this.moveSequence
    )
      return "Invalid move";
    if (
      this.state.phase !== "aiming" ||
      sessionId !== this.state.currentPlayer ||
      turnNumber !== this.state.turnNumber
    )
      return "Cannot move now";
    const player = this.state.players.find((p) => p.sessionId === sessionId);
    if (
      !player?.connected ||
      player.hp <= 0 ||
      player.movementLeft <= 0 ||
      now - this.moveAt < ARENA.moveIntervalMs
    )
      return "Movement unavailable";
    const opponent = this.state.players.find((p) => p.sessionId !== sessionId);
    const radius = ARENA.playerRadius;
    const min =
      player.number === 2 && opponent ? opponent.x + radius * 2 : radius;
    const max =
      player.number === 1 && opponent
        ? opponent.x - radius * 2
        : ARENA.width - radius;
    const x = clamp(
      player.x + direction * Math.min(ARENA.moveStep, player.movementLeft),
      min,
      max,
    );
    const y = terrainHeight(this.state.terrain, x) - radius;
    if (player.y - y > 12) return "Slope too steep";
    player.movementLeft = Math.max(
      0,
      player.movementLeft - Math.abs(x - player.x),
    );
    player.x = x;
    player.y = y;
    player.vy = 0;
    this.moveSequence = sequence as number;
    this.moveAt = now;
    return null;
  }

  restart(sessionId: string, payload: unknown): string | null {
    if (
      this.state.phase !== "finished" ||
      sessionId !== this.state.players[0]?.sessionId ||
      this.state.players.some((p) => !p.connected)
    )
      return "Restart unavailable";
    if (
      !payload ||
      typeof payload !== "object" ||
      (payload as { turnNumber?: unknown }).turnNumber !== this.state.turnNumber
    )
      return "Stale restart";
    this.state.terrain.splice(
      0,
      this.state.terrain.length,
      ...makeTerrain(this.state.mapId as MapId),
    );
    for (const player of this.state.players) {
      player.x = ARENA.width * (player.number === 1 ? 0.25 : 0.75);
      player.y =
        terrainHeight(this.state.terrain, player.x) - ARENA.playerRadius;
      player.hp = 100;
      player.vy = 0;
    }
    this.bodyAccumulator = 0;
    this.state.winner = "";
    this.state.finishReason = "";
    this.state.projectile.active = false;
    this.startTurn(0, this.clockNow());
    return null;
  }

  addPlayer(sessionId: string): Player {
    if (
      !sessionId ||
      this.state.players.some((player) => player.sessionId === sessionId)
    ) {
      throw new Error("Player session must be unique and nonempty");
    }
    if (this.state.phase !== "waiting" || this.state.players.length >= 2) {
      throw new Error("Battle has already started");
    }
    const player = new Player();
    player.sessionId = sessionId;
    player.number = this.state.players.length + 1;
    player.x = ARENA.width * (player.number === 1 ? 0.25 : 0.75);
    player.y = terrainHeight(this.state.terrain, player.x) - ARENA.playerRadius;
    this.state.players.push(player);
    if (this.state.players.length === 2) this.startTurn(0, this.clockNow());
    return player;
  }

  removePlayer(sessionId: string) {
    const index = this.state.players.findIndex(
      (player) => player.sessionId === sessionId,
    );
    if (index < 0) return;
    if (this.state.phase === "waiting") {
      this.state.players.splice(index, 1);
      return;
    }
    this.state.players[index].connected = false;
    if (this.state.phase === "finished") return;
    if (this.finishIfEliminated()) return;
    const opponent = this.state.players.find(
      (player) => player.sessionId !== sessionId && player.connected,
    );
    this.finish(opponent?.sessionId ?? "", "forfeit");
  }

  fire(sessionId: string, payload: unknown): string | null {
    const now = this.clockNow();
    if (this.state.phase === "aiming" && now >= this.turnDeadline) {
      this.nextTurn(now);
      return "Turn expired";
    }
    if (!isFireAction(payload)) return "Invalid fire action";
    if (this.state.phase !== "aiming") return "Cannot fire in this phase";
    if (sessionId !== this.state.currentPlayer) return "It is not your turn";
    if (payload.turnNumber !== this.state.turnNumber)
      return "Stale turn number";
    const player = this.state.players.find(
      (entry) => entry.sessionId === sessionId,
    );
    if (!player?.connected || player.hp <= 0) return "Player cannot fire";
    const projectile = this.state.projectile;
    Object.assign(
      projectile,
      launch(player, payload.angle, payload.power, this.state.terrain),
    );
    projectile.active = true;
    this.state.phase = "flying";
    this.state.remainingMs = 0;
    this.accumulator = 0;
    this.flightMs = 0;
    this.bodyAccumulator = 0;
    this.flightDeadline = now + ARENA.maxFlightMs;
    return null;
  }

  step(dtMs: number) {
    if (!Number.isFinite(dtMs) || dtMs < 0) return;
    const now = this.clockNow();
    if (this.state.phase === "waiting" || this.state.phase === "finished")
      return;
    if (this.state.phase !== "flying") {
      this.bodyAccumulator += Math.min(dtMs, ARENA.stepMs * MAX_CATCH_UP_STEPS);
      while (this.bodyAccumulator + EPSILON >= ARENA.stepMs) {
        this.bodyAccumulator = Math.max(0, this.bodyAccumulator - ARENA.stepMs);
        settlePlayers(this.state.players, this.state.terrain);
      }
    }
    if (this.state.phase === "aiming") {
      if (now >= this.turnDeadline) this.nextTurn(now);
      else this.state.remainingMs = Math.ceil(this.turnDeadline - now);
      return;
    }
    if (this.state.phase === "exploding") {
      if (now + EPSILON >= this.explosionDeadline && !this.finishIfEliminated())
        this.nextTurn(now);
      return;
    }
    if (this.state.phase !== "flying") return;
    if (now >= this.flightDeadline) {
      this.explode(now);
      return;
    }
    this.accumulator += Math.min(dtMs, ARENA.stepMs * MAX_CATCH_UP_STEPS);
    for (
      let steps = 0;
      steps < MAX_CATCH_UP_STEPS && this.accumulator + EPSILON >= ARENA.stepMs;
      steps++
    ) {
      this.accumulator = Math.max(0, this.accumulator - ARENA.stepMs);
      this.physicsStep(now);
      if (this.state.phase !== "flying") {
        this.accumulator = 0;
        break;
      }
    }
  }

  private clockNow() {
    const value = this.now();
    if (!Number.isFinite(value)) throw new Error("Battle clock must be finite");
    this.lastNow = Math.max(this.lastNow, value);
    return this.lastNow;
  }

  private startTurn(index: number, now: number) {
    this.state.phase = "aiming";
    this.state.currentPlayer = this.state.players[index].sessionId;
    this.state.turnNumber++;
    this.state.players[index].movementLeft = ARENA.moveBudget;
    this.moveSequence = 0;
    this.moveAt = -Infinity;
    this.state.remainingMs = ARENA.turnMs;
    this.turnDeadline = now + ARENA.turnMs;
    this.accumulator = 0;
  }

  private nextTurn(now: number) {
    const current = this.state.players.findIndex(
      (player) => player.sessionId === this.state.currentPlayer,
    );
    this.startTurn((current + 1) % this.state.players.length, now);
  }

  private physicsStep(now: number) {
    settlePlayers(this.state.players, this.state.terrain);
    const projectile = this.state.projectile;
    const hit = advanceRocket(
      projectile,
      this.state.players,
      this.state.terrain,
    );
    this.flightMs += ARENA.stepMs;
    if (hit || this.flightMs + EPSILON >= ARENA.maxFlightMs) this.explode(now);
  }

  private explode(now: number) {
    const { projectile, explosion } = this.state;
    projectile.active = false;
    explosion.id++;
    explosion.x = clamp(projectile.x, 0, ARENA.width);
    explosion.y = projectile.y;
    this.state.phase = "exploding";
    this.explosionDeadline = now + ARENA.explosionMs;
    for (const player of this.state.players) {
      const distance = Math.hypot(
        player.x - explosion.x,
        player.y - explosion.y,
      );
      if (distance >= ARENA.blastRadius) continue;
      const strength = 1 - distance / ARENA.blastRadius;
      player.hp = this.infiniteHp
        ? 100
        : Math.max(0, player.hp - Math.round(ARENA.maxDamage * strength));
      const direction =
        Math.sign(player.x - explosion.x) || (player.number === 1 ? -1 : 1);
      player.vy = -140 * strength;
      player.x = clamp(
        player.x + direction * ARENA.knockback * strength,
        ARENA.playerRadius,
        ARENA.width - ARENA.playerRadius,
      );
    }
    this.separatePlayers();
    if (this.destructible)
      carveCrater(
        this.state.terrain,
        explosion.x,
        explosion.y,
        ARENA.blastRadius * 0.55,
      );
  }

  private separatePlayers() {
    const [left, right] = this.state.players;
    const radius = ARENA.playerRadius;
    if (!left || !right || right.x - left.x >= radius * 2) return;
    const midpoint = (left.x + right.x) / 2;
    left.x = clamp(midpoint - radius, radius, ARENA.width - radius * 3);
    right.x = left.x + radius * 2;
  }

  private finishIfEliminated() {
    const alive = this.state.players.filter((player) => player.hp > 0);
    if (alive.length === this.state.players.length) return false;
    this.finish(
      alive[0]?.sessionId ?? "",
      alive.length === 0 ? "draw" : "elimination",
    );
    return true;
  }

  private finish(winner: string, reason: string) {
    this.state.phase = "finished";
    this.state.winner = winner;
    this.state.finishReason = reason;
    this.state.currentPlayer = "";
    this.state.remainingMs = 0;
    this.state.projectile.active = false;
    this.accumulator = 0;
  }
}
