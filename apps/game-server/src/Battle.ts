import {
  ARENA,
  BattleState,
  type FireAction,
  Player,
} from "@craft-ones/shared";

const MAX_CATCH_UP_STEPS = 6;
const EPSILON = 1e-7;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

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

function circleHit(
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: Player,
) {
  const ox = x - player.x;
  const oy = y - player.y;
  const c = ox * ox + oy * oy - ARENA.playerRadius ** 2;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return Number.POSITIVE_INFINITY;
  const b = 2 * (ox * dx + oy * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return Number.POSITIVE_INFINITY;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : Number.POSITIVE_INFINITY;
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
  return Number.POSITIVE_INFINITY;
}

export class Battle {
  readonly state = new BattleState();
  private accumulator = 0;
  private lastNow = Number.NEGATIVE_INFINITY;
  private turnDeadline = 0;
  private flightDeadline = 0;
  private flightMs = 0;
  private explosionDeadline = 0;

  constructor(private readonly now: () => number = () => performance.now()) {}

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
    const speed =
      ARENA.minSpeed + payload.power * (ARENA.maxSpeed - ARENA.minSpeed);
    const directionX = Math.cos(payload.angle);
    const directionY = Math.sin(payload.angle);
    const projectile = this.state.projectile;
    const muzzle = ARENA.playerRadius + 2;
    projectile.x = clamp(player.x + directionX * muzzle, 0, ARENA.width);
    projectile.y = clamp(
      player.y + directionY * muzzle,
      -ARENA.height,
      ARENA.groundY,
    );
    projectile.vx = directionX * speed;
    projectile.vy = directionY * speed;
    projectile.active = true;
    this.state.phase = "flying";
    this.state.remainingMs = 0;
    this.accumulator = 0;
    this.flightMs = 0;
    this.flightDeadline = now + ARENA.maxFlightMs;
    return null;
  }

  step(dtMs: number) {
    if (!Number.isFinite(dtMs) || dtMs < 0) return;
    const now = this.clockNow();
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
    const projectile = this.state.projectile;
    const seconds = ARENA.stepMs / 1000;
    const dx = projectile.vx * seconds;
    const dy = projectile.vy * seconds + 0.5 * ARENA.gravity * seconds ** 2;
    let hit = Math.min(
      boundaryHit(projectile.x, dx, 0, ARENA.width),
      boundaryHit(projectile.y, dy, -ARENA.height, ARENA.groundY),
    );
    for (const player of this.state.players) {
      if (player.hp > 0)
        hit = Math.min(
          hit,
          circleHit(projectile.x, projectile.y, dx, dy, player),
        );
    }
    const travel = Math.min(1, hit);
    projectile.x = clamp(projectile.x + dx * travel, 0, ARENA.width);
    projectile.y = clamp(
      projectile.y + dy * travel,
      -ARENA.height,
      ARENA.groundY,
    );
    projectile.vy += ARENA.gravity * seconds * travel;
    this.flightMs += ARENA.stepMs;
    if (hit <= 1 || this.flightMs + EPSILON >= ARENA.maxFlightMs)
      this.explode(now);
  }

  private explode(now: number) {
    const { projectile, explosion } = this.state;
    projectile.active = false;
    explosion.id++;
    explosion.x = clamp(projectile.x, 0, ARENA.width);
    explosion.y = clamp(projectile.y, -ARENA.height, ARENA.groundY);
    this.state.phase = "exploding";
    this.explosionDeadline = now + ARENA.explosionMs;
    for (const player of this.state.players) {
      const distance = Math.hypot(
        player.x - explosion.x,
        player.y - explosion.y,
      );
      if (distance >= ARENA.blastRadius) continue;
      const strength = 1 - distance / ARENA.blastRadius;
      player.hp = Math.max(
        0,
        player.hp - Math.round(ARENA.maxDamage * strength),
      );
      const direction =
        Math.sign(player.x - explosion.x) || (player.number === 1 ? -1 : 1);
      player.x = clamp(
        player.x + direction * ARENA.knockback * strength,
        ARENA.playerRadius,
        ARENA.width - ARENA.playerRadius,
      );
    }
    this.separatePlayers();
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
