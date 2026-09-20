import { ArraySchema, defineTypes, Schema } from "@colyseus/schema";
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

export class Player extends Schema {
  declare selectedWeapon: WeaponId;
  declare abilityArmed: boolean;
  declare species: Species;
  declare coat: CoatId;
  declare abilityReadyTurn: number;
  declare shield: number;
  declare vx: number;
  declare sessionId: string;
  declare number: number;
  declare x: number;
  declare y: number;
  declare hp: number;
  declare connected: boolean;
  declare movementLeft: number;
  declare originX: number;
  declare jumps: number;
  declare vy: number;

  constructor() {
    super();
    Object.assign(this, {
      selectedWeapon: "rocket",
      abilityArmed: false,
      species: "cuy",
      coat: "caramel",
      abilityReadyTurn: 0,
      shield: 0,
      vx: 0,
      sessionId: "",
      number: 0,
      x: 0,
      y: ARENA.groundY - ARENA.playerRadius,
      hp: 100,
      connected: true,
      movementLeft: ARENA.moveBudget,
      originX: 0,
      jumps: 0,
      vy: 0,
    });
  }
}
defineTypes(Player, {
  selectedWeapon: "string",
  abilityArmed: "boolean",
  species: "string",
  coat: "string",
  abilityReadyTurn: "number",
  shield: "number",
  vx: "number",
  sessionId: "string",
  number: "number",
  x: "number",
  y: "number",
  hp: "number",
  connected: "boolean",
  movementLeft: "number",
  originX: "number",
  jumps: "number",
  vy: "number",
});

export class Projectile extends Schema {
  declare kind: ProjectileKind;
  declare elapsedMs: number;
  declare bounces: number;
  declare stuck: boolean;
  declare attachedPlayer: number;
  declare offsetX: number;
  declare offsetY: number;
  declare active: boolean;
  declare x: number;
  declare y: number;
  declare vx: number;
  declare vy: number;

  constructor() {
    super();
    Object.assign(this, {
      kind: "rocket",
      elapsedMs: 0,
      bounces: 0,
      stuck: false,
      attachedPlayer: 0,
      offsetX: 0,
      offsetY: 0,
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    });
  }
}
defineTypes(Projectile, {
  kind: "string",
  elapsedMs: "number",
  bounces: "number",
  stuck: "boolean",
  attachedPlayer: "number",
  offsetX: "number",
  offsetY: "number",
  active: "boolean",
  x: "number",
  y: "number",
  vx: "number",
  vy: "number",
});

export class Explosion extends Schema {
  declare radius: number;
  declare id: number;
  declare x: number;
  declare y: number;

  constructor() {
    super();
    Object.assign(this, { radius: ARENA.blastRadius, id: 0, x: 0, y: 0 });
  }
}
defineTypes(Explosion, {
  radius: "number",
  id: "number",
  x: "number",
  y: "number",
});

export class BattleState extends Schema {
  declare worldWidth: number;
  declare worldHeight: number;
  declare terrainRows: ArraySchema<string>;
  declare terrainRevision: number;
  declare lastAction: string;
  declare wind: number;
  declare mapId: string;
  declare terrain: ArraySchema<number>;
  declare players: ArraySchema<Player>;
  declare projectile: Projectile;
  declare explosion: Explosion;
  declare phase: Phase;
  declare currentPlayer: string;
  declare turnNumber: number;
  declare roundNumber: number;
  declare remainingMs: number;
  declare waitingRemainingMs: number;
  declare winner: string;
  declare finishReason: string;
  declare openingSeat: string;

  constructor() {
    super();
    Object.assign(this, {
      worldWidth: ARENA.width,
      worldHeight: ARENA.height,
      terrainRows: new ArraySchema<string>(),
      terrainRevision: 0,
      lastAction: "",
      wind: 0,
      mapId: "flat",
      terrain: new ArraySchema<number>(),
      players: new ArraySchema<Player>(),
      projectile: new Projectile(),
      explosion: new Explosion(),
      phase: "waiting",
      currentPlayer: "",
      turnNumber: 0,
      roundNumber: 0,
      remainingMs: 0,
      waitingRemainingMs: 0,
      winner: "",
      finishReason: "",
      openingSeat: "host",
    });
  }
}
defineTypes(BattleState, {
  worldWidth: "number",
  worldHeight: "number",
  terrainRows: ["string"],
  terrainRevision: "number",
  lastAction: "string",
  wind: "number",
  mapId: "string",
  terrain: ["number"],
  players: [Player],
  projectile: Projectile,
  explosion: Explosion,
  phase: "string",
  currentPlayer: "string",
  turnNumber: "number",
  remainingMs: "number",
  waitingRemainingMs: "number",
  winner: "string",
  finishReason: "string",
  roundNumber: "number",
  openingSeat: "string",
});

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
