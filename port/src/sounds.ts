// The SoundBoard envelopes from apps/web/src/game/SoundBoard.ts as data. tools/synth-sounds.ts renders each
// recipe to an MP3 at build time (dotframe plays decoded sounds, not live oscillators), and cueSound() picks
// the recipe a shared SoundCue maps to. Continuous values (blast radius, damage) snap to a few variants.
import { PROJECTILES, type SoundCue } from "../../packages/shared/src";

export type Wave = "sine" | "triangle" | "square" | "sawtooth";
export type Op =
  | {
      tone: true;
      from: number;
      to?: number;
      type?: Wave;
      attack?: number;
      hold?: number;
      decay?: number;
      gain?: number;
      delay?: number;
    }
  | {
      tone: false;
      decay: number;
      gain?: number;
      from?: number;
      to?: number;
      q?: number;
      type?: "bandpass" | "lowpass";
      delay?: number;
    };

const tone = (o: Omit<Extract<Op, { tone: true }>, "tone">): Op => ({
  tone: true,
  ...o,
});
const hiss = (o: Omit<Extract<Op, { tone: false }>, "tone">): Op => ({
  tone: false,
  ...o,
});

function fire(weapon: string): Op[] {
  switch (weapon) {
    case "rift":
      return [
        tone({ from: 180, to: 740, decay: 0.35, gain: 0.15 }),
        tone({ from: 510, to: 120, type: "triangle", decay: 0.3, gain: 0.12 }),
      ];
    case "meow":
      return [
        tone({ from: 620, to: 950, type: "triangle", decay: 0.12, gain: 0.12 }),
        tone({ from: 900, to: 260, decay: 0.38, gain: 0.15 }),
      ];
    case "shuriken":
      return [
        tone({
          from: 1700,
          to: 850,
          type: "triangle",
          decay: 0.12,
          gain: 0.09,
        }),
        hiss({ from: 3200, to: 900, decay: 0.14, gain: 0.1 }),
      ];
    case "grenade":
      return [
        tone({ from: 420, to: 180, type: "square", decay: 0.1, gain: 0.12 }),
        hiss({ decay: 0.12, from: 600, to: 240, gain: 0.08 }),
      ];
    case "mortar":
      return [
        tone({ from: 150, to: 60, decay: 0.26, gain: 0.26 }),
        hiss({ decay: 0.22, from: 400, to: 120, gain: 0.14 }),
      ];
    case "dynamite":
      return [
        tone({ from: 240, to: 120, type: "triangle", decay: 0.14, gain: 0.14 }),
        hiss({ decay: 0.3, from: 2400, gain: 0.05, q: 8 }),
      ];
    case "grapple":
      return [
        tone({ from: 900, to: 1800, type: "square", decay: 0.12, gain: 0.08 }),
        hiss({ decay: 0.18, from: 1800, to: 600, gain: 0.06, q: 6 }),
      ];
    case "sticky":
      return [
        tone({ from: 300, to: 140, decay: 0.16, gain: 0.16 }),
        hiss({ decay: 0.1, from: 700, to: 300, gain: 0.07 }),
      ];
    default:
      return [
        tone({ from: 260, to: 90, type: "sawtooth", decay: 0.18, gain: 0.18 }),
        hiss({ decay: 0.28, from: 900, to: 260, gain: 0.13, q: 2 }),
      ];
  }
}

const BLAST_SIZES = [0.6, 1, 1.6];
function blast(size: number): Op[] {
  return [
    tone({ from: 150 / size, to: 34, decay: 0.42 * size, gain: 0.34 }),
    hiss({ decay: 0.36 * size, from: 1600, to: 120, gain: 0.3, q: 0.7 }),
    hiss({
      decay: 0.5 * size,
      from: 300,
      to: 60,
      gain: 0.16,
      type: "lowpass",
      delay: 0.03,
    }),
  ];
}

const HURT_WEIGHTS = [0.3, 1];
function hurt(weight: number, mine: boolean): Op[] {
  return [
    tone({
      from: mine ? 300 : 380,
      to: mine ? 110 : 170,
      type: "square",
      decay: 0.12 + weight * 0.12,
      gain: (mine ? 0.15 : 0.1) + weight * 0.08,
    }),
  ];
}

function turn(mine: boolean): Op[] {
  const root = mine ? 660 : 440;
  return [
    tone({ from: root, type: "triangle", decay: 0.16, gain: 0.1 }),
    tone({
      from: root * 1.5,
      type: "triangle",
      decay: 0.22,
      gain: 0.08,
      delay: 0.11,
    }),
  ];
}

const fanfare = (notes: number[], step: number, type: Wave = "square"): Op[] =>
  notes.map((note, i) =>
    tone({ from: note, type, decay: 0.26, gain: 0.12, delay: i * step }),
  );

export const RECIPES: Record<string, Op[]> = {
  bounce: [
    tone({ from: 340, to: 210, type: "triangle", decay: 0.09, gain: 0.16 }),
  ],
  stick: [
    tone({ from: 190, to: 90, decay: 0.13, gain: 0.2 }),
    hiss({ decay: 0.05, from: 900, gain: 0.05 }),
  ],
  heal: [
    tone({ from: 520, to: 780, decay: 0.18, gain: 0.13 }),
    tone({ from: 780, to: 1040, decay: 0.22, gain: 0.1, delay: 0.1 }),
  ],
  shield: [
    tone({ from: 300, to: 600, type: "triangle", decay: 0.3, gain: 0.1 }),
    tone({ from: 450, to: 900, decay: 0.34, gain: 0.07, delay: 0.04 }),
  ],
  leap: [
    tone({ from: 260, to: 720, type: "triangle", decay: 0.24, gain: 0.13 }),
  ],
  dash: [hiss({ decay: 0.2, from: 700, to: 2600, gain: 0.09, q: 4 })],
  jump: [tone({ from: 300, to: 560, type: "square", decay: 0.11, gain: 0.07 })],
  step: [hiss({ decay: 0.05, from: 420, to: 180, gain: 0.05, q: 1.4 })],
  win: fanfare([523, 659, 784, 1047], 0.11),
  lose: fanfare([440, 370, 294, 220], 0.15, "triangle"),
  "turn-mine": turn(true),
  "turn-other": turn(false),
  // One whine cycle; played repeatedly at a rising rate while a shot charges.
  charge: [
    tone({
      from: 160,
      type: "sawtooth",
      attack: 0.01,
      hold: 0.06,
      decay: 0.04,
      gain: 0.05,
    }),
  ],
};
for (const kind of Object.keys(PROJECTILES))
  RECIPES[`fire-${kind}`] = fire(kind);
BLAST_SIZES.forEach((size, i) => {
  RECIPES[`blast-${i}`] = blast(size);
});
HURT_WEIGHTS.forEach((weight, i) => {
  RECIPES[`hurt-mine-${i}`] = hurt(weight, true);
  RECIPES[`hurt-other-${i}`] = hurt(weight, false);
});

export const SOUND_NAMES = Object.keys(RECIPES);

const nearest = (values: number[], value: number): number =>
  values.reduce(
    (best, v, i) =>
      Math.abs(v - value) < Math.abs(values[best] - value) ? i : best,
    0,
  );

export function cueSound(cue: SoundCue): string {
  switch (cue.kind) {
    case "fire":
      return `fire-${cue.weapon}`;
    case "blast":
      return `blast-${nearest(BLAST_SIZES, Math.min(1.6, Math.max(0.6, cue.radius / 100)))}`;
    case "hurt":
      return `hurt-${cue.mine ? "mine" : "other"}-${nearest(HURT_WEIGHTS, Math.min(1, cue.amount / 55))}`;
    case "turn":
      return cue.mine ? "turn-mine" : "turn-other";
    case "heal":
      return "heal";
    default:
      return cue.kind;
  }
}
