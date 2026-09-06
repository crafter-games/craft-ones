import { ArraySchema, defineTypes, Schema } from "@colyseus/schema";

export const ARENA = {
  width: 960,
  height: 540,
  groundY: 440,
  playerRadius: 18,
  gravity: 420,
  minSpeed: 240,
  maxSpeed: 700,
  blastRadius: 100,
  maxDamage: 55,
  knockback: 48,
  turnMs: 15_000,
  explosionMs: 650,
  maxFlightMs: 8_000,
  stepMs: 1000 / 60,
} as const;

export type Phase = "waiting" | "aiming" | "flying" | "exploding" | "finished";
export type FireAction = { angle: number; power: number; turnNumber: number };

export class Player extends Schema {
  sessionId = "";
  number = 0;
  x = 0;
  y = ARENA.groundY - ARENA.playerRadius;
  hp = 100;
  connected = true;
}
defineTypes(Player, {
  sessionId: "string",
  number: "number",
  x: "number",
  y: "number",
  hp: "number",
  connected: "boolean",
});

export class Projectile extends Schema {
  active = false;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
}
defineTypes(Projectile, {
  active: "boolean",
  x: "number",
  y: "number",
  vx: "number",
  vy: "number",
});

export class Explosion extends Schema {
  id = 0;
  x = 0;
  y = 0;
}
defineTypes(Explosion, { id: "number", x: "number", y: "number" });

export class BattleState extends Schema {
  players = new ArraySchema<Player>();
  projectile = new Projectile();
  explosion = new Explosion();
  phase: Phase = "waiting";
  currentPlayer = "";
  turnNumber = 0;
  remainingMs = 0;
  winner = "";
  finishReason = "";
}
defineTypes(BattleState, {
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
  "sessionId" | "number" | "x" | "y" | "hp" | "connected"
>;
export type BattleView = {
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
