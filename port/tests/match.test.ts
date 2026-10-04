import { expect, test } from "bun:test";
import { PROJECTILES, type SoundCue } from "../../packages/shared/src";
import {
  aimBits,
  Bit,
  createMatch,
  KICKOFF_FRAMES,
  randomInput,
  restore,
  save,
  slotBits,
  step,
  summary,
} from "../src/match";
import { cueSound, SOUND_NAMES } from "../src/sounds";

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

test("R after a finished match starts a fresh one", () => {
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
