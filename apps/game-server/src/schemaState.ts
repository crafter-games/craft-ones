import { ArraySchema, defineTypes, Schema } from "@colyseus/schema";
import {
  ARENA,
  type BattleState,
  type CoatId,
  type Phase,
  type ProjectileKind,
  type Species,
  type WeaponId,
} from "@craft-ones/shared";

// Colyseus network state. The shared engine keeps plain objects; the room copies them into these
// Schema classes after every change so patches and the browser client stay exactly as before.
// Schema classes use `declare` fields and constructor assignments: emitted native class fields
// overwrite Colyseus change-tracking accessors.

export class PlayerSchema extends Schema {
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
defineTypes(PlayerSchema, {
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

export class ProjectileSchema extends Schema {
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
defineTypes(ProjectileSchema, {
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

export class ExplosionSchema extends Schema {
  declare radius: number;
  declare id: number;
  declare x: number;
  declare y: number;

  constructor() {
    super();
    Object.assign(this, { radius: ARENA.blastRadius, id: 0, x: 0, y: 0 });
  }
}
defineTypes(ExplosionSchema, {
  radius: "number",
  id: "number",
  x: "number",
  y: "number",
});

export class BattleStateSchema extends Schema {
  declare worldWidth: number;
  declare worldHeight: number;
  declare terrainRows: ArraySchema<string>;
  declare terrainRevision: number;
  declare lastAction: string;
  declare wind: number;
  declare mapId: string;
  declare terrain: ArraySchema<number>;
  declare players: ArraySchema<PlayerSchema>;
  declare projectile: ProjectileSchema;
  declare explosion: ExplosionSchema;
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
      players: new ArraySchema<PlayerSchema>(),
      projectile: new ProjectileSchema(),
      explosion: new ExplosionSchema(),
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
defineTypes(BattleStateSchema, {
  worldWidth: "number",
  worldHeight: "number",
  terrainRows: ["string"],
  terrainRevision: "number",
  lastAction: "string",
  wind: "number",
  mapId: "string",
  terrain: ["number"],
  players: [PlayerSchema],
  projectile: ProjectileSchema,
  explosion: ExplosionSchema,
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


type Plain = Record<string, unknown>;

// Copies changed primitives only, so Schema change tracking still sends minimal patches.
function copyFields(target: Schema, source: object, fields: string[]) {
  const t = target as unknown as Plain;
  const s = source as Plain;
  for (const field of fields) if (t[field] !== s[field]) t[field] = s[field];
}

function syncArray<T>(target: ArraySchema<T>, source: readonly T[]) {
  while (target.length > source.length) target.pop();
  for (let i = 0; i < source.length; i++)
    if (i >= target.length) target.push(source[i]);
    else if (target[i] !== source[i]) target[i] = source[i];
}

const PLAYER_FIELDS = Object.keys(new PlayerSchema().toJSON());
const PROJECTILE_FIELDS = Object.keys(new ProjectileSchema().toJSON());
const EXPLOSION_FIELDS = Object.keys(new ExplosionSchema().toJSON());
const STATE_FIELDS = Object.keys(new BattleStateSchema().toJSON()).filter(
  (f) => !["terrainRows", "terrain", "players", "projectile", "explosion"].includes(f),
);

export function syncState(target: BattleStateSchema, source: BattleState) {
  copyFields(target, source, STATE_FIELDS);
  syncArray(target.terrainRows, source.terrainRows);
  syncArray(target.terrain, source.terrain);
  while (target.players.length > source.players.length) target.players.pop();
  source.players.forEach((player, i) => {
    if (i >= target.players.length) target.players.push(new PlayerSchema());
    copyFields(target.players[i], player, PLAYER_FIELDS);
  });
  copyFields(target.projectile, source.projectile, PROJECTILE_FIELDS);
  copyFields(target.explosion, source.explosion, EXPLOSION_FIELDS);
}
