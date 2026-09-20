import {
  abilityNeedsAim,
  abilityProjectile,
  isWeapon,
  PROJECTILES,
  WEAPONS,
} from "./arsenal";
import { clamp, launch, windForTurn } from "./ballistics";
import {
  defaultAppearance,
  pullTowardAnchor,
  setAppearance,
  validateTurn,
  worldMove,
} from "./battleActions";
import { ARENA } from "./config";
import {
  isOpeningSeat,
  type OpeningSeat,
  resolveOpeningIndex,
} from "./matchOptions";
import { settlePlayers } from "./playerMotion";
import { advanceShot, launchShot } from "./projectiles";
import { BattleState, type FireAction, Player } from "./schema";
import { carveCrater, type MapId, makeTerrain, terrainHeight } from "./terrain";
import { eraseCircle, grounded } from "./terrainGrid";
import {
  moveHorizontal,
  movementRoom,
  resetMovement,
  syncMovement,
  worldBodyStep,
} from "./worldMotion";
import {
  makeWorld,
  type PlayableMapId,
  WORLD_HEIGHT,
  WORLD_MAPS,
  WORLD_WIDTH,
} from "./worlds";

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
  private volley: {
    sessionId: string;
    angle: number;
    power: number;
    remaining: number;
  } | null = null;
  private accumulator = 0;
  private bodyAccumulator = 0;
  private lastNow = Number.NEGATIVE_INFINITY;
  private turnDeadline = 0;
  private flightDeadline = 0;
  private flightMs = 0;
  private explosionDeadline = 0;

  private controlledMotion = new Set<Player>();
  private moveSequence = 0;
  private moveAt = -Infinity;
  // Local lab options are never exposed by BattleRoom's message handlers.
  infiniteHp = false;
  destructible = false;
  private resolveDeadline = 0;
  private openingSeat: OpeningSeat = "host";
  private openingIndex = 0;
  private matchOriginTurn = 0;

  constructor(
    private readonly now: () => number = () => performance.now(),
    mapId: MapId = "flat",
    private windSeed = 0,
    openingSeat: OpeningSeat | unknown = "host",
  ) {
    this.state.mapId = mapId;
    this.state.terrain.push(...makeTerrain(mapId));
    this.state.terrainRows.push(...makeWorld(mapId));
    if (mapId !== "flat") {
      this.destructible = true;
      this.state.worldWidth = WORLD_WIDTH;
      this.state.worldHeight = WORLD_HEIGHT;
    }
    this.openingSeat = isOpeningSeat(openingSeat) ? openingSeat : "host";
    this.openingIndex = resolveOpeningIndex(this.openingSeat);
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
    // Walking back toward the origin is always allowed: it hands range back.
    const room = player ? movementRoom(player, direction) : 0;
    if (
      !player?.connected ||
      player.hp <= 0 ||
      room <= 0 ||
      now - this.moveAt < ARENA.moveIntervalMs
    )
      return "Movement unavailable";
    if (this.state.terrainRows.length) {
      const airborne =
        player.vy < -1 || !grounded(this.state, player.x, player.y);
      const error = worldMove(
        this.state,
        player,
        direction,
        Math.min(ARENA.moveStep, room),
      );
      if (!error && airborne) this.controlledMotion.add(player);
      if (!error && !airborne) syncMovement(player);
      if (!error) {
        this.moveSequence = sequence as number;
        this.moveAt = now;
      }
      return error;
    }
    const opponent = this.state.players.find((p) => p.sessionId !== sessionId);
    const radius = ARENA.playerRadius;
    const min =
      player.number === 2 && opponent ? opponent.x + radius * 2 : radius;
    const max =
      player.number === 1 && opponent
        ? opponent.x - radius * 2
        : ARENA.width - radius;
    const x = clamp(
      player.x + direction * Math.min(ARENA.moveStep, room),
      min,
      max,
    );
    const y = terrainHeight(this.state.terrain, x) - radius;
    if (player.y - y > 12) return "Slope too steep";
    player.x = x;
    syncMovement(player);
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
    this.state.terrainRows.splice(
      0,
      this.state.terrainRows.length,
      ...makeWorld(this.state.mapId as MapId),
    );
    this.state.terrainRevision++;
    for (const player of this.state.players) {
      player.x = ARENA.width * (player.number === 1 ? 0.25 : 0.75);
      player.y =
        terrainHeight(this.state.terrain, player.x) - ARENA.playerRadius;
      if (this.state.mapId !== "flat")
        [player.x, player.y] =
          WORLD_MAPS[this.state.mapId as PlayableMapId].spawns[
            player.number - 1
          ];
      player.selectedWeapon = "rocket";
      player.abilityArmed = false;
      player.hp = 100;
      player.vy = 0;
      player.vx = 0;
      player.abilityReadyTurn = 0;
      player.shield = 0;
      resetMovement(player);
    }
    this.controlledMotion.clear();
    this.state.projectile.stuck = false;
    this.state.projectile.attachedPlayer = 0;
    this.bodyAccumulator = 0;
    this.state.winner = "";
    this.state.finishReason = "";
    this.state.projectile.active = false;
    this.state.roundNumber = 0;
    this.windSeed = (this.windSeed + 1) >>> 0;
    this.beginMatch(this.clockNow());
    return null;
  }

  addPlayer(sessionId: string, options: unknown = null): Player {
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
    if (this.state.mapId !== "flat")
      [player.x, player.y] =
        WORLD_MAPS[this.state.mapId as PlayableMapId].spawns[player.number - 1];
    setAppearance(player, defaultAppearance(player.number));
    if (options) setAppearance(player, options);
    resetMovement(player);
    this.state.players.push(player);
    if (this.state.players.length === 2) this.beginMatch(this.clockNow());
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

  select(sessionId: string, payload: unknown): string | null {
    const now = this.clockNow();
    if (this.state.phase === "aiming" && now >= this.turnDeadline) {
      this.nextTurn(now);
      return "Turn expired";
    }
    const player = validateTurn(this.state, sessionId, payload);
    if (!player) return "Cannot select now";
    const { selection } = payload as { selection?: unknown };
    if (selection === "ability") {
      if (
        !abilityNeedsAim(player.species) ||
        this.state.turnNumber < player.abilityReadyTurn
      )
        return "Ability unavailable";
      player.abilityArmed = true;
    } else {
      if (!isWeapon(selection)) return "Invalid weapon selection";
      player.selectedWeapon = selection;
      player.abilityArmed = false;
    }
    return null;
  }

  fire(sessionId: string, payload: unknown): string | null {
    const now = this.clockNow();
    if (this.state.phase === "aiming" && now >= this.turnDeadline) {
      this.nextTurn(now);
      return "Turn expired";
    }
    if (
      !isFireAction(payload) ||
      (payload.weapon !== undefined && !isWeapon(payload.weapon))
    )
      return "Invalid fire action";
    if (this.state.phase !== "aiming") return "Cannot fire in this phase";
    if (sessionId !== this.state.currentPlayer) return "It is not your turn";
    if (payload.turnNumber !== this.state.turnNumber)
      return "Stale turn number";
    const player = this.state.players.find(
      (entry) => entry.sessionId === sessionId,
    );
    if (!player?.connected || player.hp <= 0) return "Player cannot fire";
    // Selection and fire arrive in order even before the client sees a patch.
    // Resolve a plain fire intention from the authoritative selection.
    if (payload.weapon === undefined && player.abilityArmed)
      return this.ability(sessionId, {
        ...payload,
        direction: Math.cos(payload.angle) >= 0 ? 1 : -1,
      });
    const projectile = this.state.projectile;
    const kind = payload.weapon ?? player.selectedWeapon;
    player.selectedWeapon = kind;
    player.abilityArmed = false;
    if (this.state.terrainRows.length || kind !== "rocket")
      Object.assign(
        projectile,
        launchShot(this.state, player, payload.angle, payload.power, kind),
      );
    else
      Object.assign(
        projectile,
        launch(player, payload.angle, payload.power, this.state.terrain),
        {
          kind,
          elapsedMs: 0,
          bounces: 0,
          stuck: false,
          attachedPlayer: 0,
          offsetX: 0,
          offsetY: 0,
        },
      );
    this.state.lastAction = kind;
    projectile.active = true;
    this.state.phase = "flying";
    this.state.remainingMs = 0;
    this.accumulator = 0;
    this.flightMs = 0;
    this.bodyAccumulator = 0;
    this.flightDeadline = now + WEAPONS[kind].fuse;
    return null;
  }

  step(dtMs: number) {
    if (!Number.isFinite(dtMs) || dtMs < 0) return;
    const now = this.clockNow();
    if (this.state.phase === "waiting" || this.state.phase === "finished")
      return;
    if (this.state.phase !== "flying" && this.state.phase !== "grappling") {
      this.bodyAccumulator += Math.min(dtMs, ARENA.stepMs * MAX_CATCH_UP_STEPS);
      while (this.bodyAccumulator + EPSILON >= ARENA.stepMs) {
        this.bodyAccumulator = Math.max(0, this.bodyAccumulator - ARENA.stepMs);
        this.bodyStep();
      }
    }
    if (this.state.phase === "aiming") {
      if (now >= this.turnDeadline) this.nextTurn(now);
      else this.state.remainingMs = Math.ceil(this.turnDeadline - now);
      this.finishIfEliminated();
      return;
    }
    if (this.state.phase === "exploding") {
      if (
        now + EPSILON >= this.explosionDeadline &&
        !this.finishIfEliminated()
      ) {
        if (this.continueVolley(now)) return;
        if (
          this.state.terrainRows.length &&
          !this.state.players.every((p) => grounded(this.state, p.x, p.y))
        )
          this.resolve(now, 200);
        else this.nextTurn(now);
      }
      return;
    }
    if (this.state.phase === "resolving") {
      if (
        now >= this.resolveDeadline &&
        (this.state.players.every(
          (p) => p.hp <= 0 || grounded(this.state, p.x, p.y),
        ) ||
          now >= this.resolveDeadline + 2500)
      ) {
        if (!this.finishIfEliminated() && !this.continueVolley(now))
          this.nextTurn(now);
      }
      return;
    }
    if (this.state.phase === "grappling") {
      const player = this.state.players.find(
        (p) => p.sessionId === this.state.currentPlayer,
      );
      this.accumulator += Math.min(dtMs, ARENA.stepMs * 6);
      while (this.accumulator + EPSILON >= ARENA.stepMs) {
        this.accumulator = Math.max(0, this.accumulator - ARENA.stepMs);
        worldBodyStep(
          this.state,
          this.state.players.filter((p) => p !== player),
          this.controlledMotion,
        );
        if (
          !player ||
          !pullTowardAnchor(this.state, player) ||
          now >= this.resolveDeadline
        ) {
          this.resolve(now, 200);
          break;
        }
      }
      return;
    }
    if (this.state.phase !== "flying") return;
    if (now >= this.flightDeadline) {
      if (this.state.projectile.kind === "grapple") this.resolve(now, 200);
      else this.explode(now);
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

  private beginMatch(now: number) {
    if (this.openingSeat === "random")
      this.openingIndex = resolveOpeningIndex("random");
    this.state.roundNumber = 0;
    this.matchOriginTurn = this.state.turnNumber;
    this.startTurn(this.openingIndex, now);
  }

  private startTurn(index: number, now: number) {
    for (const player of this.controlledMotion) player.vx = 0;
    this.controlledMotion.clear();
    this.volley = null;
    // Tools persist per seat; aimed powers must be armed again on a new turn.
    for (const player of this.state.players) player.abilityArmed = false;
    this.state.phase = "aiming";
    this.state.currentPlayer = this.state.players[index].sessionId;
    this.state.turnNumber++;
    // Rounds are turn pairs from the opening seat so wind stays fair.
    const turnInMatch = this.state.turnNumber - this.matchOriginTurn;
    if ((turnInMatch - 1) % 2 === 0) this.state.roundNumber++;
    this.state.wind = windForTurn(
      this.state.mapId,
      turnInMatch,
      this.windSeed,
    );
    resetMovement(this.state.players[index]);
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

  private bodyStep() {
    if (this.state.terrainRows.length)
      worldBodyStep(this.state, this.state.players, this.controlledMotion);
    else settlePlayers(this.state.players, this.state.terrain);
  }

  private physicsStep(now: number) {
    this.bodyStep();
    const shot = this.state.projectile;
    const impact = advanceShot(shot, this.state, this.state.players);
    this.flightMs += ARENA.stepMs;
    if (impact === "anchor") {
      shot.active = false;
      this.state.phase = "grappling";
      this.resolveDeadline = now + 1800;
    } else if (impact === "miss") this.resolve(now, 300);
    else if (impact === "blast" || this.flightMs + EPSILON >= ARENA.maxFlightMs)
      this.explode(now);
  }

  private resolve(now: number, duration = 500) {
    this.state.projectile.active = false;
    this.state.phase = "resolving";
    this.state.remainingMs = 0;
    this.resolveDeadline = now + duration;
    this.accumulator = 0;
  }

  jump(sessionId: string, payload: unknown): string | null {
    const now = this.clockNow();
    if (this.state.phase === "aiming" && now >= this.turnDeadline) {
      this.nextTurn(now);
      return "Turn expired";
    }
    const player = validateTurn(this.state, sessionId, payload);
    const direction = (payload as { direction?: unknown } | null)?.direction;
    if (
      !player ||
      (direction !== -1 && direction !== 0 && direction !== 1) ||
      player.vy < -1 ||
      !grounded(this.state, player.x, player.y)
    )
      return "Jump unavailable";
    // Jumps are free: the flight is steered inside the same walking range.
    player.jumps += 1;
    this.controlledMotion.add(player);
    player.vy = -330;
    player.vx = direction * 180;

    return null;
  }

  ability(sessionId: string, payload: unknown): string | null {
    const now = this.clockNow();
    if (this.state.phase === "aiming" && now >= this.turnDeadline) {
      this.nextTurn(now);
      return "Turn expired";
    }
    const player = validateTurn(this.state, sessionId, payload);
    if (!player || this.state.turnNumber < player.abilityReadyTurn)
      return "Ability unavailable";
    if (player.species === "cuy")
      return "This character has no special ability";
    const projectile = abilityProjectile(player.species);
    if (projectile) {
      if (!isFireAction(payload)) return "Invalid ability aim";
      player.abilityArmed = true;
      player.abilityReadyTurn = this.state.turnNumber + 4;
      this.volley =
        projectile === "shuriken"
          ? {
              sessionId,
              angle: payload.angle,
              power: payload.power,
              remaining: 2,
            }
          : null;
      this.launchAbility(player, payload.angle, payload.power, now);
      return null;
    }
    if (player.species === "ronsoco") {
      if (player.shield > 0) return "Shield already active";
      player.shield = 30;
      this.state.lastAction = "shield";
    } else if (player.species === "zorro") {
      const direction = (payload as { direction?: unknown }).direction;
      if (
        (direction !== -1 && direction !== 1) ||
        !grounded(this.state, player.x, player.y) ||
        player.vy < 0
      )
        return "Land before dashing";
      const start = player.x;
      for (let i = 0; i < 40; i++) {
        const { x, y } = player;
        if (!grounded(this.state, x, y)) break;
        const error = worldMove(this.state, player, direction);
        if (!grounded(this.state, player.x, player.y)) {
          player.x = x;
          player.y = y;
          break;
        }
        if (error || Math.abs(player.x - x) < 0.01) break;
      }
      if (Math.abs(player.x - start) < 1) return "No room to dash";
      this.state.lastAction = "dash";
    } else if (player.species === "alpaca") {
      if (player.hp >= 100) return "Already at full health";
      player.hp = Math.min(100, player.hp + 25);
      this.state.lastAction = "shield";
    } else {
      const direction = (payload as { direction?: unknown }).direction;
      if (
        (direction !== -1 && direction !== 1) ||
        !grounded(this.state, player.x, player.y)
      )
        return "Land before leaping";
      // A puma springs flatter and further than a llama's high leap.
      const pounce = player.species === "puma";
      player.vx = direction * (pounce ? 470 : 360);
      player.vy = pounce ? -360 : -480;
      this.state.lastAction = "leap";
    }
    this.controlledMotion.delete(player);
    player.abilityArmed = true;
    player.abilityReadyTurn = this.state.turnNumber + 4;
    this.resolve(now, 550);
    return null;
  }

  private launchAbility(
    player: Player,
    angle: number,
    power: number,
    now: number,
  ) {
    const kind = abilityProjectile(player.species);
    if (!kind) return;
    this.controlledMotion.delete(player);
    Object.assign(
      this.state.projectile,
      launchShot(this.state, player, angle, power, kind),
      { active: true },
    );
    this.state.lastAction = kind;
    this.state.phase = "flying";
    this.state.remainingMs = 0;
    this.accumulator = 0;
    this.bodyAccumulator = 0;
    this.flightMs = 0;
    this.flightDeadline = now + PROJECTILES[kind].fuse;
  }

  private continueVolley(now: number) {
    const volley = this.volley;
    if (!volley || volley.remaining <= 0) return false;
    const owner = this.state.players.find(
      (p) => p.sessionId === volley.sessionId && p.hp > 0 && p.connected,
    );
    if (!owner) {
      this.volley = null;
      return false;
    }
    volley.remaining--;
    this.launchAbility(owner, volley.angle, volley.power, now);
    return true;
  }

  private explode(now: number) {
    const { projectile, explosion } = this.state;
    projectile.active = false;
    explosion.id++;
    explosion.x = clamp(projectile.x, 0, this.state.worldWidth);
    explosion.y = projectile.y;
    this.state.phase = "exploding";
    this.explosionDeadline = now + ARENA.explosionMs;
    const weapon = PROJECTILES[projectile.kind];
    explosion.radius = weapon.radius;
    if (this.destructible && this.state.terrainRows.length) {
      eraseCircle(
        this.state.terrainRows,
        explosion.x,
        explosion.y,
        weapon.crater,
      );
      this.state.terrainRevision++;
    }
    for (const player of this.state.players) {
      const distance = Math.hypot(
        player.x - explosion.x,
        player.y - explosion.y,
      );
      if (distance >= weapon.radius) continue;
      this.controlledMotion.delete(player);
      const strength = 1 - distance / weapon.radius;
      const incoming = Math.round(weapon.damage * strength);
      const absorbed = Math.min(player.shield, incoming);
      player.shield -= absorbed;
      player.hp = this.infiniteHp
        ? 100
        : Math.max(0, player.hp - incoming + absorbed);
      const direction =
        Math.sign(player.x - explosion.x) || (player.number === 1 ? -1 : 1);
      player.vy = -140 * strength;
      if (this.state.terrainRows.length) {
        moveHorizontal(
          this.state,
          player,
          direction * ARENA.knockback * strength,
        );
        player.vx = direction * 100 * strength;
        continue;
      }
      player.x = clamp(
        player.x + direction * ARENA.knockback * strength,
        ARENA.playerRadius,
        ARENA.width - ARENA.playerRadius,
      );
    }
    if (!this.state.terrainRows.length) this.separatePlayers();
    if (this.destructible && !this.state.terrainRows.length)
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
    this.volley = null;
    this.state.phase = "finished";
    this.state.winner = winner;
    this.state.finishReason = reason;
    this.state.currentPlayer = "";
    this.state.remainingMs = 0;
    this.state.projectile.active = false;
    this.accumulator = 0;
  }
}
