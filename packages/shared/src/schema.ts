import type { CoatId, ProjectileKind, Species, WeaponId } from "./arsenal";

import { ARENA } from "./config";

export type Phase =
  | "waiting"
  | "aiming"
  | "flying"
  | "exploding"
  | "resolving"
  | "grappling"
  | "finished";
export type MoveAction = {
  direction: -1 | 1;
  turnNumber: number;
  sequence: number;
};
export type FireAction = {
  angle: number;
  power: number;
  turnNumber: number;
  weapon?: WeaponId;
};

export type SelectionAction = {
  selection: WeaponId | "ability";
  turnNumber: number;
};

// Plain state classes. The simulation never depended on Schema's change tracking; the Colyseus server
// mirrors this state into its own Schema classes (apps/game-server/src/schemaState.ts) for network patches,
// and the dotframe port snapshots it directly. toJSON gives the BattleView every client renders.

export class Player {
  selectedWeapon: WeaponId = "rocket";
  abilityArmed = false;
  species: Species = "cuy";
  coat: CoatId = "caramel";
  abilityReadyTurn = 0;
  shield = 0;
  vx = 0;
  sessionId = "";
  number = 0;
  x = 0;
  y: number = ARENA.groundY - ARENA.playerRadius;
  hp = 100;
  connected = true;
  movementLeft: number = ARENA.moveBudget;
  originX = 0;
  jumps = 0;
  vy = 0;

  toJSON(): PlayerView {
    return {
      selectedWeapon: this.selectedWeapon,
      abilityArmed: this.abilityArmed,
      species: this.species,
      coat: this.coat,
      abilityReadyTurn: this.abilityReadyTurn,
      shield: this.shield,
      vx: this.vx,
      sessionId: this.sessionId,
      number: this.number,
      x: this.x,
      y: this.y,
      hp: this.hp,
      connected: this.connected,
      movementLeft: this.movementLeft,
      originX: this.originX,
      jumps: this.jumps,
      vy: this.vy,
    };
  }
}

export class Projectile {
  kind: ProjectileKind = "rocket";
  elapsedMs = 0;
  bounces = 0;
  stuck = false;
  attachedPlayer = 0;
  offsetX = 0;
  offsetY = 0;
  active = false;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;

  toJSON(): BattleView["projectile"] {
    return {
      kind: this.kind,
      elapsedMs: this.elapsedMs,
      bounces: this.bounces,
      stuck: this.stuck,
      attachedPlayer: this.attachedPlayer,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      active: this.active,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
    };
  }
}

export class Explosion {
  radius: number = ARENA.blastRadius;
  id = 0;
  x = 0;
  y = 0;

  toJSON(): BattleView["explosion"] {
    return { radius: this.radius, id: this.id, x: this.x, y: this.y };
  }
}

export class BattleState {
  worldWidth: number = ARENA.width;
  worldHeight: number = ARENA.height;
  terrainRows: string[] = [];
  terrainRevision = 0;
  lastAction = "";
  wind = 0;
  mapId = "flat";
  terrain: number[] = [];
  players: Player[] = [];
  projectile = new Projectile();
  explosion = new Explosion();
  phase: Phase = "waiting";
  currentPlayer = "";
  turnNumber = 0;
  roundNumber = 0;
  remainingMs = 0;
  waitingRemainingMs = 0;
  winner = "";
  finishReason = "";
  openingSeat = "host";

  // Same key order as the Schema definition, so JSON snapshots and checksums are unchanged.
  toJSON(): BattleView {
    return {
      worldWidth: this.worldWidth,
      worldHeight: this.worldHeight,
      terrainRows: this.terrainRows.slice(),
      terrainRevision: this.terrainRevision,
      lastAction: this.lastAction,
      wind: this.wind,
      mapId: this.mapId,
      terrain: this.terrain.slice(),
      players: this.players.map((p) => p.toJSON()),
      projectile: this.projectile.toJSON(),
      explosion: this.explosion.toJSON(),
      phase: this.phase,
      currentPlayer: this.currentPlayer,
      turnNumber: this.turnNumber,
      remainingMs: this.remainingMs,
      waitingRemainingMs: this.waitingRemainingMs,
      winner: this.winner,
      finishReason: this.finishReason,
      roundNumber: this.roundNumber,
      openingSeat: this.openingSeat,
    };
  }
}

export type PlayerView = Pick<
  Player,
  | "selectedWeapon"
  | "abilityArmed"
  | "species"
  | "coat"
  | "abilityReadyTurn"
  | "shield"
  | "vx"
  | "sessionId"
  | "number"
  | "x"
  | "y"
  | "hp"
  | "connected"
  | "movementLeft"
  | "originX"
  | "jumps"
  | "vy"
>;
export type BattleView = {
  worldWidth: number;
  worldHeight: number;
  terrainRows: string[];
  terrainRevision: number;
  lastAction: string;
  wind: number;
  mapId: string;
  terrain: number[];
  players: PlayerView[];
  projectile: Pick<
    Projectile,
    | "kind"
    | "elapsedMs"
    | "bounces"
    | "stuck"
    | "attachedPlayer"
    | "offsetX"
    | "offsetY"
    | "active"
    | "x"
    | "y"
    | "vx"
    | "vy"
  >;
  explosion: Pick<Explosion, "radius" | "id" | "x" | "y">;
  phase: Phase;
  currentPlayer: string;
  turnNumber: number;
  roundNumber: number;
  remainingMs: number;
  waitingRemainingMs: number;
  winner: string;
  finishReason: string;
  openingSeat: string;
};
