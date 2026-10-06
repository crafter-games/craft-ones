// Deterministic wrapper over the shared Battle engine (packages/shared).
// A frame is one fixed 60 Hz step: the current seat's input becomes Battle intentions, then the clock advances.
// Aim, charge, the camera, the kickoff pause and notices live here, not in the renderer, so dotframe sim,
// replays and netplay see everything that decides a shot.
import { createChecksum } from "dotframe/src/checksum";
import {
  ARENA,
  abilityNeedsAim,
  Battle,
  type BattleView,
  dcos,
  PLAYABLE_MAP_IDS,
  type PlayableMapId,
  type PlayerOptions,
  WEAPONS,
  type WeaponId,
  wrapAngle,
} from "../../packages/shared/src";
import { type Camera, createCamera, updateCamera } from "./camera";
import { createEffects, type Effects, updateEffects } from "./effects";

export const WINDOW = { width: 1280, height: 720, title: "Craft Ones" };
export const PLAYERS = 2;
// Deepest rollback netplay allows before a peer waits instead of predicting further.
export const ROLLBACK_WINDOW = 60;
export const STEP_MS = 1000 / 60;
const AIM_SPEED = 0.035;
export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
// The web HUD holds its kickoff banner for 1.6 s and the playground clock waits for it.
export const KICKOFF_FRAMES = 96;
const NOTICE_FRAMES = 150;

export const Bit = {
  Left: 1,
  Right: 2,
  Jump: 4,
  AimUp: 8,
  AimDown: 16,
  Fire: 32,
  Weapon: 64,
  Ability: 128,
  Map: 256,
  Restart: 512,
};
// Bits 10-12 carry a hotbar slot: 1-6 the weapons in order, 7 the ability, 0 none.
const SLOT_SHIFT = 10;
export const slotBits = (slot: number): number => (slot & 7) << SLOT_SHIFT;
const slotOf = (bits: number): number => (bits >> SLOT_SHIFT) & 7;
// Bit 13 says bits 14-23 hold an absolute aim angle (pointer and touch aim), quantized to 1024 steps.
const AIM_SET = 1 << 13;
const AIM_SHIFT = 14;
const AIM_STEPS = 1024;
export const aimBits = (angle: number): number =>
  AIM_SET |
  ((Math.round(((angle + Math.PI) / (2 * Math.PI)) * AIM_STEPS) % AIM_STEPS) <<
    AIM_SHIFT);
// Bit 24 shoots at once with the aim in bits 14-23 and a power in bits 25-30: one gesture from a touch slingshot.
const SHOOT = 1 << 24;
const POWER_SHIFT = 25;
const POWER_STEPS = 63;
export const shootBits = (angle: number, power: number): number =>
  aimBits(angle) |
  SHOOT |
  (Math.round(Math.max(0, Math.min(1, power)) * POWER_STEPS) << POWER_SHIFT);
const aimOf = (bits: number): number =>
  (((bits >> AIM_SHIFT) & (AIM_STEPS - 1)) / AIM_STEPS) * 2 * Math.PI - Math.PI;

// The screen area below the HUD bar, which the camera frames.
export const HUD_HEIGHT = 64;
export const FRAME = {
  width: WINDOW.width,
  height: WINDOW.height - HUD_HEIGHT,
};

// Phones are wider than 16:9: keep the 720 logical height and widen the view to the screen's aspect, so nothing
// stretches. Call before creating the renderer and the match.
export function fitAspect(aspect: number): void {
  const width = Math.max(WINDOW.height, Math.round(WINDOW.height * aspect));
  WINDOW.width = width;
  FRAME.width = width;
}

export interface MatchOptions {
  map: PlayableMapId;
  one: PlayerOptions;
  two: PlayerOptions;
  opening: "host" | "guest";
  // The /playground?lab toggles.
  infiniteHp: boolean;
  destructible: boolean;
}

export const DEFAULT_OPTIONS: MatchOptions = {
  map: "andes",
  one: { species: "cuy", coat: "caramel" },
  two: { species: "llama", coat: "cream" },
  opening: "host",
  infiniteHp: false,
  destructible: true,
};

export interface Match {
  seed: number;
  options: MatchOptions;
  frame: number;
  elapsed: number;
  battle: Battle;
  // Per seat, in world radians; seat 1 starts facing left.
  angle: number[];
  // Frames the fire button has been held this turn (0 = not charging).
  charge: number[];
  previous: number[];
  sequence: number;
  movedAt: number;
  // Frames left on the kickoff banner; the battle clock waits for it.
  kickoff: number;
  notice: string;
  noticeUntil: number;
  rematches: number;
  camera: Camera;
  fx: Effects;
  // Every input since start: save/restore replays it, because Battle keeps private state a clone would miss.
  log: number[][];
}

function newBattle(match: Match): void {
  const { options } = match;
  match.elapsed = 0;
  match.movedAt = -Infinity;
  match.battle = new Battle(
    () => match.elapsed,
    options.map,
    (match.seed + match.rematches) >>> 0,
    options.opening,
  );
  match.battle.destructible = options.destructible;
  match.battle.infiniteHp = options.infiniteHp;
  match.battle.addPlayer("p1", options.one);
  match.battle.addPlayer("p2", options.two);
  match.angle = [-Math.PI / 4, (-3 * Math.PI) / 4];
  match.charge = [0, 0];
  match.kickoff = KICKOFF_FRAMES;
  match.notice = "";
  match.noticeUntil = 0;
  match.camera = createCamera(view(match), FRAME);
  match.fx = createEffects(view(match));
}

export function createMatch(
  seed: number,
  options: Partial<MatchOptions> = {},
): Match {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const map = PLAYABLE_MAP_IDS.includes(merged.map) ? merged.map : "andes";
  const chosen = { ...merged, map };
  // Placeholder fields, replaced by newBattle: the battle's clock has to read this match.
  const battle = new Battle(() => 0, map, seed >>> 0, chosen.opening);
  const state = battle.state.toJSON() as BattleView;
  const match: Match = {
    seed,
    options: chosen,
    frame: 0,
    elapsed: 0,
    battle,
    angle: [0, 0],
    charge: [0, 0],
    previous: [0, 0],
    sequence: 0,
    movedAt: 0,
    kickoff: 0,
    notice: "",
    noticeUntil: 0,
    rematches: 0,
    camera: createCamera(state, FRAME),
    fx: createEffects(state),
    log: [],
  };
  newBattle(match);
  return match;
}

export function seatOf(match: Match): number {
  const current = match.battle.state.currentPlayer;
  return current === "p2" ? 1 : current === "p1" ? 0 : -1;
}

function report(match: Match, error: string | null): void {
  if (!error) return;
  match.notice = error;
  match.noticeUntil = match.frame + NOTICE_FRAMES;
}

export function step(match: Match, inputs: number[]): void {
  match.log.push([inputs[0] ?? 0, inputs[1] ?? 0]);
  match.frame += 1;
  const pressedBy = (i: number): number =>
    (inputs[i] ?? 0) & ~match.previous[i];
  // Either seat can toggle the overview, even while the other one plays.
  for (let i = 0; i < PLAYERS; i++)
    if (pressedBy(i) & Bit.Map) match.camera.map = !match.camera.map;
  if (match.battle.state.phase === "finished") {
    if ([0, 1].some((i) => pressedBy(i) & Bit.Restart)) {
      match.rematches += 1;
      newBattle(match);
    }
    match.previous = [inputs[0] ?? 0, inputs[1] ?? 0];
    return;
  }
  if (match.kickoff > 0) {
    match.kickoff -= 1;
    match.previous = [inputs[0] ?? 0, inputs[1] ?? 0];
    updateCamera(match.camera, view(match), FRAME, STEP_MS, false);
    return;
  }
  const battle = match.battle;
  const state = battle.state;
  const seat = seatOf(match);
  if (seat >= 0 && state.phase === "aiming") {
    const id = seat === 0 ? "p1" : "p2";
    const bits = inputs[seat] ?? 0;
    const pressed = pressedBy(seat);
    const released = match.previous[seat] & ~bits;
    const turnNumber = state.turnNumber;
    const player = state.players.find((p) => p.sessionId === id);
    // Up raises the barrel on whichever side the critter faces.
    const facing = dcos(match.angle[seat]) >= 0 ? 1 : -1;
    if (bits & AIM_SET) match.angle[seat] = aimOf(bits);
    if (bits & Bit.AimUp) match.angle[seat] -= AIM_SPEED * facing;
    if (bits & Bit.AimDown) match.angle[seat] += AIM_SPEED * facing;
    match.angle[seat] = wrapAngle(match.angle[seat]);
    const charging = match.charge[seat] > 0;
    if (!charging && player) {
      const direction = bits & Bit.Left ? -1 : bits & Bit.Right ? 1 : 0;
      // Walking turns the critter: point the barrel the way it moves, keeping the elevation.
      if (direction !== 0 && Math.sign(dcos(match.angle[seat])) !== direction)
        match.angle[seat] = wrapAngle(Math.PI - match.angle[seat]);
      if (pressed & Bit.Jump)
        report(match, battle.jump(id, { turnNumber, direction }));
      // Battle takes one step per moveIntervalMs; asking every frame would only collect refusals.
      else if (
        direction !== 0 &&
        match.elapsed - match.movedAt >= ARENA.moveIntervalMs
      ) {
        match.movedAt = match.elapsed;
        match.sequence += 1;
        report(
          match,
          battle.move(id, {
            direction,
            sequence: match.sequence,
            turnNumber,
          }),
        );
      }
      const slot =
        slotOf(bits) !== slotOf(match.previous[seat]) ? slotOf(bits) : 0;
      if (pressed & Bit.Weapon) {
        const next =
          WEAPON_IDS[
            (WEAPON_IDS.indexOf(player.selectedWeapon) + 1) % WEAPON_IDS.length
          ];
        report(match, battle.select(id, { selection: next, turnNumber }));
      } else if (slot >= 1 && slot <= WEAPON_IDS.length)
        report(
          match,
          battle.select(id, { selection: WEAPON_IDS[slot - 1], turnNumber }),
        );
      if (pressed & Bit.Ability || slot === 7) {
        const aimDirection = dcos(match.angle[seat]) >= 0 ? 1 : -1;
        if (abilityNeedsAim(player.species)) {
          const selection = player.abilityArmed
            ? player.selectedWeapon
            : "ability";
          report(match, battle.select(id, { selection, turnNumber }));
        } else
          report(
            match,
            battle.ability(id, { turnNumber, direction: aimDirection }),
          );
      }
    }
    if (bits & Bit.Fire) match.charge[seat] += 1;
    const shoot = (pressed & SHOOT) !== 0 && !charging;
    if ((released & Bit.Fire && charging) || shoot) {
      const power = shoot
        ? ((bits >> POWER_SHIFT) & POWER_STEPS) / POWER_STEPS
        : power01(match.charge[seat]);
      const angle = match.angle[seat];
      if (player?.abilityArmed) {
        const direction = dcos(angle) >= 0 ? 1 : -1;
        report(
          match,
          battle.ability(id, { turnNumber, direction, angle, power }),
        );
      } else report(match, battle.fire(id, { angle, power, turnNumber }));
      match.charge[seat] = 0;
    }
  } else match.charge = [0, 0];
  match.previous = [inputs[0] ?? 0, inputs[1] ?? 0];
  match.elapsed += STEP_MS;
  battle.step(STEP_MS);
  const after = view(match);
  updateEffects(match.fx, after, match.frame);
  updateCamera(
    match.camera,
    after,
    FRAME,
    STEP_MS,
    match.charge.some((c) => c > 0),
  );
}

export function power01(frames: number): number {
  return Math.min(1, (frames * STEP_MS) / ARENA.chargeMs);
}

export function view(match: Match): BattleView {
  return match.battle.state.toJSON() as BattleView;
}

// Numbers in a fixed order (dotframe's checksum), so web, native and other browsers hash the same state. Terrain
// rows enter through terrainRevision: they only change with a crater, which also moves the shot and players.
export function checksum(match: Match): number {
  const sum = createChecksum();
  const text = (value: string): void => {
    sum.add(value.length);
    for (let i = 0; i < value.length; i++) sum.add(value.charCodeAt(i));
  };
  const state = match.battle.state;
  sum
    .add(state.terrainRevision)
    .add(state.wind)
    .add(state.turnNumber)
    .add(state.roundNumber)
    .add(state.remainingMs)
    .add(state.waitingRemainingMs);
  text(state.phase);
  text(state.currentPlayer);
  text(state.winner);
  text(state.lastAction);
  for (const h of state.terrain) sum.add(h);
  for (const p of state.players) {
    sum
      .add(p.x)
      .add(p.y)
      .add(p.vx)
      .add(p.vy)
      .add(p.hp)
      .add(p.shield)
      .add(p.jumps)
      .add(p.movementLeft)
      .add(p.originX)
      .add(p.abilityReadyTurn)
      .add(p.abilityArmed ? 1 : 0);
    text(p.selectedWeapon);
  }
  const shot = state.projectile;
  sum
    .add(shot.active ? 1 : 0)
    .add(shot.x)
    .add(shot.y)
    .add(shot.vx)
    .add(shot.vy)
    .add(shot.elapsedMs)
    .add(shot.bounces)
    .add(shot.stuck ? 1 : 0)
    .add(shot.attachedPlayer);
  text(shot.kind);
  sum.add(state.explosion.id).add(state.explosion.x).add(state.explosion.y);
  for (const a of match.angle) sum.add(a);
  for (const c of match.charge) sum.add(c);
  return sum.add(match.kickoff).add(match.rematches).value();
}

export function summary(match: Match): unknown {
  const s = match.battle.state;
  return {
    frame: match.frame,
    map: s.mapId,
    phase: match.kickoff > 0 && s.phase !== "finished" ? "kickoff" : s.phase,
    turn: s.turnNumber,
    current: s.currentPlayer,
    remainingMs: Math.round(s.remainingMs),
    wind: s.wind,
    terrainRevision: s.terrainRevision,
    winner: s.winner,
    rematches: match.rematches,
    effects: {
      trail: match.fx.trail.length,
      bursts: match.fx.bursts.length,
      popups: match.fx.popups.map((t) => t.amount),
    },
    notice: match.frame < match.noticeUntil ? match.notice : "",
    players: s.players.map((p, i) => ({
      id: p.sessionId,
      species: p.species,
      hp: p.hp,
      x: Math.round(p.x),
      y: Math.round(p.y),
      weapon: p.abilityArmed ? "ability" : p.selectedWeapon,
      abilityReadyTurn: p.abilityReadyTurn,
      angle: Number(match.angle[i].toFixed(3)),
    })),
  };
}

export function over(match: Match): boolean {
  return match.battle.state.phase === "finished";
}

export interface Saved {
  seed: number;
  options: MatchOptions;
  log: number[][];
}

export function save(match: Match): Saved {
  return {
    seed: match.seed,
    options: match.options,
    log: match.log.map((f) => [...f]),
  };
}

export function restore(saved: Saved): Match {
  const match = createMatch(saved.seed, saved.options);
  for (const inputs of saved.log) step(match, inputs);
  return match;
}

export function encode(input: unknown): number {
  const i = input as Record<string, boolean | number | undefined>;
  return (
    (i.left ? Bit.Left : 0) |
    (i.right ? Bit.Right : 0) |
    (i.jump ? Bit.Jump : 0) |
    (i.aimUp ? Bit.AimUp : 0) |
    (i.aimDown ? Bit.AimDown : 0) |
    (i.fire ? Bit.Fire : 0) |
    (i.weapon ? Bit.Weapon : 0) |
    (i.ability ? Bit.Ability : 0) |
    (i.map ? Bit.Map : 0) |
    (i.restart ? Bit.Restart : 0) |
    slotBits(typeof i.slot === "number" ? i.slot : 0) |
    (typeof i.aim === "number" ? aimBits(i.aim) : 0)
  );
}

// Mashing that still plays: mostly charge-and-release with some walking, aiming and tool picks.
export function randomInput(next: () => number): number {
  let bits = 0;
  if (next() < 0.55) bits |= Bit.Fire;
  const r = next();
  if (r < 0.15) bits |= Bit.Left;
  else if (r < 0.3) bits |= Bit.Right;
  if (next() < 0.25) bits |= next() < 0.5 ? Bit.AimUp : Bit.AimDown;
  if (next() < 0.03) bits |= Bit.Jump;
  if (next() < 0.04) bits |= slotBits(1 + Math.floor(next() * 7));
  if (next() < 0.02) bits |= Bit.Restart;
  return bits;
}
