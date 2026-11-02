import { expect, test } from "bun:test";
import { PROJECTILES, type SoundCue } from "../../packages/shared/src";
import {
  aimBits,
  Bit,
  createMatch,
  KICKOFF_FRAMES,
  mapPicker,
  pickBits,
  randomInput,
  restore,
  save,
  seatOf,
  shootBits,
  slotBits,
  step,
  summary,
} from "../src/match";
import { restoreMatch, snapshotMatch } from "../src/snapshot";
import { cueSound, SOUND_NAMES } from "../src/sounds";

// A pick word naming indexes that do not exist (bit 13 set, all index bits 15).
const AIM_BAD = (1 << 13) | (0xfff << 14);
const mash = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

test("the clock waits for the kickoff banner", () => {
  const match = createMatch(1);
  for (let i = 0; i < KICKOFF_FRAMES; i++) step(match, [Bit.Fire, 0]);
  expect(match.battle.state.remainingMs).toBe(15000);
  expect(match.charge[0]).toBe(0);
  step(match, [0, 0]);
  expect(match.battle.state.remainingMs).toBeLessThan(15000);
});

test("slot keys pick tools and the ability", () => {
  const match = createMatch(1, { one: { species: "llama", coat: "cream" } });
  for (let i = 0; i <= KICKOFF_FRAMES; i++) step(match, [0, 0]);
  step(match, [slotBits(4), 0]);
  expect(match.battle.state.players[0].selectedWeapon).toBe("mortar");
  step(match, [0, 0]);
  step(match, [slotBits(7), 0]);
  expect(match.battle.state.players[0].abilityArmed).toBe(true);
});

test("a finished match starts a fresh one once both seats are ready", () => {
  const next = mash(3);
  const match = createMatch(1);
  let frames = 0;
  while (match.battle.state.phase !== "finished" && frames++ < 30000)
    step(match, [
      randomInput(next) & ~Bit.Restart,
      randomInput(next) & ~Bit.Restart,
    ]);
  expect(match.battle.state.phase).toBe("finished");
  step(match, [0, 0]);
  step(match, [0, Bit.Restart]);
  expect(match.rematches).toBe(0);
  step(match, [Bit.Restart, Bit.Restart]);
  const after = summary(match) as {
    phase: string;
    rematches: number;
    players: { hp: number }[];
  };
  expect(after.rematches).toBe(1);
  expect(after.phase).toBe("kickoff");
  expect(after.players.map((p) => p.hp)).toEqual([100, 100]);
  // Restore replays the log, so a rematch survives save/restore.
  expect(
    (summary(restore(save(match))) as { rematches: number }).rematches,
  ).toBe(1);
});

function finished(seed: number): ReturnType<typeof createMatch> {
  const next = mash(seed);
  const match = createMatch(1);
  let frames = 0;
  while (match.battle.state.phase !== "finished" && frames++ < 30000)
    step(match, [
      randomInput(next) & ~Bit.Restart,
      randomInput(next) & ~Bit.Restart,
    ]);
  expect(match.battle.state.phase).toBe("finished");
  return match;
}

test("each seat's pick sets its own critter and the loser picks the map", () => {
  const match = finished(3);
  const picker = mapPicker(match);
  expect(picker).toBe(match.battle.state.winner === "p1" ? 1 : 0);
  const word = (seat: number, map: "coast" | "andes"): number =>
    pickBits({
      map,
      species: seat === 0 ? "puma" : "zorro",
      coat: seat === 0 ? "sage" : "slate",
    });
  // The winner asks for one map and the loser for the other: the loser's wins.
  const bits = [0, 0];
  bits[picker] = word(picker, "coast");
  bits[1 - picker] = word(1 - picker, "andes");
  step(match, [bits[0] | Bit.Restart, bits[1]]);
  expect(match.rematches).toBe(0);
  step(match, [bits[0] | Bit.Restart, bits[1] | Bit.Restart]);
  expect(match.rematches).toBe(1);
  const s = summary(match) as {
    map: string;
    players: { species: string }[];
  };
  expect(s.map).toBe("coast");
  expect(s.players.map((p) => p.species)).toEqual(["puma", "zorro"]);
  expect(match.battle.state.players[0].coat).toBe("sage");
  expect(match.battle.state.players[1].coat).toBe("slate");
  // The match keeps the options it started with, which its replay starts from.
  expect(match.options.map).toBe("andes");
  expect(restore(save(match)).lineup.map).toBe("coast");
  expect(restore(save(match)).battle.state.players[0].species).toBe("puma");
});

test("a seat that is ready cannot change its pick, and a bad pick is ignored", () => {
  const match = finished(3);
  const keep = match.lineup.two.species;
  step(match, [
    pickBits({ map: "coast", species: "puma", coat: "sage" }) | Bit.Restart,
    0,
  ]);
  // Ready already: this later pick is dropped. The other seat's word names indexes that do not exist.
  step(match, [
    pickBits({ map: "coast", species: "zorro", coat: "sage" }),
    AIM_BAD,
  ]);
  expect(match.rematches).toBe(0);
  step(match, [0, Bit.Restart]);
  expect(match.rematches).toBe(1);
  expect(match.battle.state.players[0].species).toBe("puma");
  expect(match.battle.state.players[1].species).toBe(keep);
});

test("rematch picks survive a rollback snapshot", () => {
  const match = finished(3);
  step(match, [
    pickBits({ map: "coast", species: "puma", coat: "sage" }) | Bit.Restart,
    0,
  ]);
  const snap = snapshotMatch(match);
  step(match, [0, Bit.Restart]);
  expect(match.rematches).toBe(1);
  restoreMatch(match, snap);
  expect(match.rematches).toBe(0);
  expect(match.ready).toEqual([true, false]);
  step(match, [0, Bit.Restart]);
  expect(match.battle.state.players[0].species).toBe("puma");
});

test("every sound cue maps to a synthesized sound", () => {
  const cues: SoundCue[] = [
    ...Object.keys(PROJECTILES).map(
      (weapon) => ({ kind: "fire", weapon }) as SoundCue,
    ),
    ...[10, 60, 100, 160, 400].map(
      (radius) => ({ kind: "blast", radius }) as SoundCue,
    ),
    ...[1, 30, 55, 90].flatMap((amount) =>
      [true, false].map((mine) => ({ kind: "hurt", amount, mine }) as SoundCue),
    ),
    { kind: "heal", amount: 25 },
    ...(
      [
        "bounce",
        "stick",
        "shield",
        "leap",
        "dash",
        "jump",
        "step",
        "win",
        "lose",
      ] as const
    ).map((kind) => ({ kind }) as SoundCue),
    { kind: "turn", mine: true },
    { kind: "turn", mine: false },
  ];
  for (const cue of cues) expect(SOUND_NAMES).toContain(cueSound(cue));
});

test("pointer aim survives encoding within one quantization step", () => {
  for (const angle of [-Math.PI + 0.001, -2.4, -1.2, -0.3, 0, 0.7, 2.9]) {
    const match = createMatch(1);
    for (let i = 0; i <= KICKOFF_FRAMES; i++) step(match, [0, 0]);
    step(match, [aimBits(angle), 0]);
    const diff = Math.atan2(
      Math.sin(match.angle[0] - angle),
      Math.cos(match.angle[0] - angle),
    );
    expect(Math.abs(diff)).toBeLessThan((2 * Math.PI) / 1024);
  }
});

test("holding a direction walks without refusals", () => {
  const match = createMatch(1);
  for (let i = 0; i <= KICKOFF_FRAMES; i++) step(match, [0, 0]);
  const start = match.battle.state.players[0].x;
  for (let i = 0; i < 30; i++) step(match, [Bit.Right, 0]);
  expect(match.battle.state.players[0].x).toBeGreaterThan(start);
  expect(match.notice).toBe("");
});

test("a slingshot shot fires in one frame with its own angle and power", () => {
  const match = createMatch(3);
  for (let i = 0; i < KICKOFF_FRAMES + 2; i++) step(match, [0, 0]);
  const seat = seatOf(match);
  const inputs = [0, 0];
  inputs[seat] = shootBits(-Math.PI / 3, 0.8);
  step(match, inputs);
  expect(match.battle.state.phase).toBe("flying");
  expect(match.battle.state.projectile.vy).toBeLessThan(0);
});

test("a charge held through the turn timer does not freeze the camera on the next turn", () => {
  const match = createMatch(1);
  for (let i = 0; i <= KICKOFF_FRAMES; i++) step(match, [0, 0]);
  const first = match.battle.state.currentPlayer;
  let frames = 0;
  while (match.battle.state.currentPlayer === first && frames++ < 2000)
    step(match, [Bit.Fire, Bit.Fire]);
  expect(match.battle.state.currentPlayer).not.toBe(first);
  for (let i = 0; i < 5; i++) step(match, [0, 0]);
  expect(match.charge).toEqual([0, 0]);
  // The overview must still be reachable: the camera follows the map toggle.
  step(match, [Bit.Map, 0]);
  step(match, [0, 0]);
  const before = match.camera.zoom;
  for (let i = 0; i < 120; i++) step(match, [0, 0]);
  expect(match.camera.map).toBe(true);
  expect(match.camera.zoom).not.toBe(before);
});
