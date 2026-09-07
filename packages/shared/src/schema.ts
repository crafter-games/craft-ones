import { ArraySchema, defineTypes, Schema } from "@colyseus/schema";

import { ARENA } from "./config";

export type Phase = "waiting" | "aiming" | "flying" | "exploding" | "finished";
export type MoveAction = {
  direction: -1 | 1;
  turnNumber: number;
  sequence: number;
};
export type FireAction = { angle: number; power: number; turnNumber: number };

export class Player extends Schema {
  declare sessionId: string;
  declare number: number;
  declare x: number;
  declare y: number;
  declare hp: number;
  declare connected: boolean;
  declare movementLeft: number;
  declare vy: number;

  constructor() {
    super();
    Object.assign(this, {
      sessionId: "",
      number: 0,
      x: 0,
      y: ARENA.groundY - ARENA.playerRadius,
      hp: 100,
      connected: true,
      movementLeft: ARENA.moveBudget,
      vy: 0,
    });
  }
}
defineTypes(Player, {
  sessionId: "string",
  number: "number",
  x: "number",
  y: "number",
  hp: "number",
  connected: "boolean",
  movementLeft: "number",
  vy: "number",
});

export class Projectile extends Schema {
  declare active: boolean;
  declare x: number;
  declare y: number;
  declare vx: number;
  declare vy: number;

  constructor() {
    super();
    Object.assign(this, { active: false, x: 0, y: 0, vx: 0, vy: 0 });
  }
}
defineTypes(Projectile, {
  active: "boolean",
  x: "number",
  y: "number",
  vx: "number",
  vy: "number",
});

export class Explosion extends Schema {
  declare id: number;
  declare x: number;
  declare y: number;

  constructor() {
    super();
    Object.assign(this, { id: 0, x: 0, y: 0 });
  }
}
defineTypes(Explosion, { id: "number", x: "number", y: "number" });

export class BattleState extends Schema {
  declare mapId: string;
  declare terrain: ArraySchema<number>;
  declare players: ArraySchema<Player>;
  declare projectile: Projectile;
  declare explosion: Explosion;
  declare phase: Phase;
  declare currentPlayer: string;
  declare turnNumber: number;
  declare remainingMs: number;
  declare winner: string;
  declare finishReason: string;

  constructor() {
    super();
    Object.assign(this, {
      mapId: "flat",
      terrain: new ArraySchema<number>(),
      players: new ArraySchema<Player>(),
      projectile: new Projectile(),
      explosion: new Explosion(),
      phase: "waiting",
      currentPlayer: "",
      turnNumber: 0,
      remainingMs: 0,
      winner: "",
      finishReason: "",
    });
  }
}
defineTypes(BattleState, {
  mapId: "string",
  terrain: ["number"],
  players: [Player],
  projectile: Projectile,
  explosion: Explosion,
  phase: "string",
  currentPlayer: "string",
  turnNumber: "number",
  remainingMs: "number",
  winner: "string",
  finishReason: "string",
});

export type PlayerView = Pick<
  Player,
  | "sessionId"
  | "number"
  | "x"
  | "y"
  | "hp"
  | "connected"
  | "movementLeft"
  | "vy"
>;
export type BattleView = {
  mapId: string;
  terrain: number[];
  players: PlayerView[];
  projectile: Pick<Projectile, "active" | "x" | "y" | "vx" | "vy">;
  explosion: Pick<Explosion, "id" | "x" | "y">;
  phase: Phase;
  currentPlayer: string;
  turnNumber: number;
  remainingMs: number;
  winner: string;
  finishReason: string;
};
