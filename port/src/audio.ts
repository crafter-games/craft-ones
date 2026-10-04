// Plays the synthesized sounds (assets/sfx, built by tools/synth-sounds.ts) for the shared sound cues.
// Cues come from comparing two views, so this reads the match and never changes it.
import type { Audio } from "dotframe/src/audio";
import { type BattleView, soundCues } from "../../packages/shared/src";
import { cueSound, SOUND_NAMES } from "./sounds";

export type LoadBytes = (path: string) => Promise<Uint8Array>;

export interface Speakers {
  hear: (
    before: BattleView | null,
    after: BattleView,
    listener: string,
  ) => void;
  charge: (power: number, frame: number) => void;
}

export async function loadSpeakers(
  audio: Audio,
  load: LoadBytes,
  root: string,
): Promise<Speakers> {
  const sounds = new Map<string, number>();
  await Promise.all(
    SOUND_NAMES.map(async (name): Promise<void> => {
      sounds.set(
        name,
        await audio.loadSound(await load(`${root}/assets/sfx/${name}.mp3`)),
      );
    }),
  );
  let lastStep = -1000;
  let frame = 0;
  const play = (name: string, rate = 1): void => {
    const id = sounds.get(name);
    if (id !== undefined) audio.play(id, 0.9, rate);
  };
  return {
    hear: (before, after, listener): void => {
      frame += 1;
      for (const cue of soundCues(before, after, listener)) {
        // Footsteps come thick and fast; keep them sparse enough to stay pleasant (as SoundBoard does).
        if (cue.kind === "step") {
          if (frame - lastStep < 6) continue;
          lastStep = frame;
        }
        play(cueSound(cue));
      }
    },
    // The rising whine of a charging shot: one short cycle every 6 frames, pitched up with power.
    charge: (power, at): void => {
      if (power > 0 && at % 6 === 0) play("charge", (120 + power * 520) / 160);
    },
  };
}
