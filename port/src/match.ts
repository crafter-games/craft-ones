// Deterministic wrapper over the shared Battle engine (packages/shared), the same one the Colyseus server runs.
// A frame is one fixed 60 Hz step: the current seat's input becomes Battle intentions, then the clock advances.
// Aim and charge live here, not in the renderer, so dotframe sim, replays and netplay see every shot.
import {
  ARENA,
  abilityNeedsAim,
  Battle,
  type BattleView,
  PLAYABLE_MAP_IDS,
  type PlayableMapId,
  type PlayerOptions,
  WEAPONS,
  type WeaponId,
} from "../../packages/shared/src";

export const WINDOW = { width: 1280, height: 720, title: "Craft Ones" };
export const PLAYERS = 2;
export const STEP_MS = 1000 / 60;
const AIM_SPEED = 0.035;
const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

export const Bit = {
  Left: 1,
  Right: 2,
  Jump: 4,
  AimUp: 8,
  AimDown: 16,
  Fire: 32,
  Weapon: 64,
  Ability: 128,
};

export interface MatchOptions {
  map: PlayableMapId;
  one: PlayerOptions;
  two: PlayerOptions;
  opening: "host" | "guest";
}

export const DEFAULT_OPTIONS: MatchOptions = {
  map: "andes",
  one: { species: "cuy", coat: "caramel" },
  two: { species: "llama", coat: "cream" },
  opening: "host",
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
  notice: string;
  // Every input since start: save/restore replays it, because Battle keeps private state a clone would miss.
  log: number[][];
}

export function createMatch(
  seed: number,
  options: Partial<MatchOptions> = {},
): Match {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const map = PLAYABLE_MAP_IDS.includes(merged.map) ? merged.map : "andes";
  const match: Match = {
    seed,
    options: { ...merged, map },
    frame: 0,
    elapsed: 0,
    battle: null as unknown as Battle,
    angle: [-Math.PI / 4, (-3 * Math.PI) / 4],
    charge: [0, 0],
    previous: [0, 0],
    sequence: 0,
    notice: "",
    log: [],
  };
  match.battle = new Battle(
    () => match.elapsed,
    map,
    seed >>> 0,
    merged.opening,
  );
  match.battle.destructible = true;
  match.battle.addPlayer("p1", merged.one);
  match.battle.addPlayer("p2", merged.two);
  return match;
}

export function seatOf(match: Match): number {
  const current = match.battle.state.currentPlayer;
  return current === "p2" ? 1 : current === "p1" ? 0 : -1;
}

function report(match: Match, error: string | null): void {
  if (error) match.notice = error;
}

export function step(match: Match, inputs: number[]): void {
  match.log.push([inputs[0] ?? 0, inputs[1] ?? 0]);
  match.frame += 1;
  const battle = match.battle;
  const state = battle.state;
  const seat = seatOf(match);
  if (seat >= 0 && state.phase === "aiming") {
    const id = seat === 0 ? "p1" : "p2";
    const bits = inputs[seat] ?? 0;
    const pressed = bits & ~match.previous[seat];
    const released = match.previous[seat] & ~bits;
    const turnNumber = state.turnNumber;
    const player = state.players.find((p) => p.sessionId === id);
    // Up raises the barrel on whichever side the critter faces.
    const facing = Math.cos(match.angle[seat]) >= 0 ? 1 : -1;
    if (bits & Bit.AimUp) match.angle[seat] -= AIM_SPEED * facing;
    if (bits & Bit.AimDown) match.angle[seat] += AIM_SPEED * facing;
    match.angle[seat] = Math.atan2(
      Math.sin(match.angle[seat]),
      Math.cos(match.angle[seat]),
    );
    const charging = match.charge[seat] > 0;
    if (!charging) {
      const direction = bits & Bit.Left ? -1 : bits & Bit.Right ? 1 : 0;
      // Walking turns the critter: point the barrel the way it moves, keeping the elevation.
      if (
        direction !== 0 &&
        Math.sign(Math.cos(match.angle[seat])) !== direction
      )
        match.angle[seat] = Math.atan2(
          Math.sin(match.angle[seat]),
          -Math.cos(match.angle[seat]),
        );
      if (pressed & Bit.Jump)
        report(match, battle.jump(id, { turnNumber, direction }));
      else if (direction !== 0)
        report(
          match,
          battle.move(id, {
            direction,
            sequence: ++match.sequence,
            turnNumber,
          }),
        );
      if (pressed & Bit.Weapon && player) {
        const next =
          WEAPON_IDS[
            (WEAPON_IDS.indexOf(player.selectedWeapon) + 1) % WEAPON_IDS.length
          ];
        report(match, battle.select(id, { selection: next, turnNumber }));
      }
      if (pressed & Bit.Ability && player) {
        const direction = Math.cos(match.angle[seat]) >= 0 ? 1 : -1;
        if (abilityNeedsAim(player.species)) {
          const selection = player.abilityArmed
            ? player.selectedWeapon
            : "ability";
          report(match, battle.select(id, { selection, turnNumber }));
        } else report(match, battle.ability(id, { turnNumber, direction }));
      }
    }
    if (bits & Bit.Fire) match.charge[seat] += 1;
    if (released & Bit.Fire && charging) {
      const power = power01(match.charge[seat]);
      const angle = match.angle[seat];
      if (player?.abilityArmed) {
        const direction = Math.cos(angle) >= 0 ? 1 : -1;
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
}

export function power01(frames: number): number {
  return Math.min(1, (frames * STEP_MS) / ARENA.chargeMs);
}

export function view(match: Match): BattleView {
  return match.battle.state.toJSON() as BattleView;
}

export function checksum(match: Match): number {
  const text =
    JSON.stringify(view(match)) + match.angle.join() + match.charge.join();
  let h = 2166136261;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function summary(match: Match): unknown {
  const s = match.battle.state;
  return {
    frame: match.frame,
    map: s.mapId,
    phase: s.phase,
    turn: s.turnNumber,
    current: s.currentPlayer,
    remainingMs: Math.round(s.remainingMs),
    wind: s.wind,
    terrainRevision: s.terrainRevision,
    winner: s.winner,
    notice: match.notice,
    players: s.players.map((p, i) => ({
      id: p.sessionId,
      species: p.species,
      hp: p.hp,
      x: Math.round(p.x),
      y: Math.round(p.y),
      weapon: p.selectedWeapon,
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
  const i = input as Record<string, boolean | undefined>;
  return (
    (i.left ? Bit.Left : 0) |
    (i.right ? Bit.Right : 0) |
    (i.jump ? Bit.Jump : 0) |
    (i.aimUp ? Bit.AimUp : 0) |
    (i.aimDown ? Bit.AimDown : 0) |
    (i.fire ? Bit.Fire : 0) |
    (i.weapon ? Bit.Weapon : 0) |
    (i.ability ? Bit.Ability : 0)
  );
}

// Mashing that still plays: mostly charge-and-release with some walking and aiming.
export function randomInput(next: () => number): number {
  let bits = 0;
  if (next() < 0.55) bits |= Bit.Fire;
  const r = next();
  if (r < 0.15) bits |= Bit.Left;
  else if (r < 0.3) bits |= Bit.Right;
  if (next() < 0.25) bits |= next() < 0.5 ? Bit.AimUp : Bit.AimDown;
  if (next() < 0.03) bits |= Bit.Jump;
  if (next() < 0.03) bits |= Bit.Weapon;
  return bits;
}
