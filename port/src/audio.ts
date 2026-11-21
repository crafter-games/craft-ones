// Plays the synthesized sounds (assets/sfx, built by tools/synth-sounds.ts) for the shared sound cues.
// Cues come from comparing two views, so this reads the match and never changes it.
import type { Audio, AudioPlayer } from "dotframe/src/audio";
import {
  type BattleView,
  PLAYABLE_MAP_IDS,
  type PlayableMapId,
  soundCues,
} from "../../packages/shared/src";
import { cueSound, SOUND_NAMES } from "./sounds";

export type LoadBytes = (path: string) => Promise<Uint8Array>;

export type MusicTrack = "menu" | PlayableMapId;
export const MUSIC_NAMES: MusicTrack[] = ["menu", ...PLAYABLE_MAP_IDS];

const DEFAULT_MUSIC_LEVEL = 0.3;
const DEFAULT_SFX_LEVEL = 0.35;
const MAX_MUSIC_GAIN = 0.45;
const MAX_SFX_GAIN = 0.85;
const DUCKED_MULTIPLIER = 0.45;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export interface Speakers {
  hear: (
    before: BattleView | null,
    after: BattleView,
    listener: string,
  ) => void;
  charge: (power: number, frame: number) => void;
  music: (track: MusicTrack | null, ducked?: boolean) => void;
  musicVolume: () => number;
  setMusicVolume: (level: number) => void;
  sfxVolume: () => number;
  setSfxVolume: (level: number) => void;
  previewSfx: () => void;
}

export async function loadSpeakers(
  audio: Audio,
  load: LoadBytes,
  root: string,
): Promise<Speakers> {
  const sounds = new Map<string, number>();
  const tracks = new Map<MusicTrack, number>();
  await Promise.all([
    ...SOUND_NAMES.map(async (name): Promise<void> => {
      sounds.set(
        name,
        await audio.loadSound(await load(`${root}/assets/sfx/${name}.mp3`)),
      );
    }),
    ...MUSIC_NAMES.map(async (name): Promise<void> => {
      try {
        tracks.set(
          name,
          await audio.loadMusic(await load(`${root}/assets/music/${name}.mp3`)),
        );
      } catch {
        return;
      }
    }),
  ]);
  return createSpeakers(audio, sounds, tracks);
}

// Synchronous loading for hosts without promises (scriptc library mode on iOS).
export function loadSpeakersSync(
  audio: AudioPlayer,
  read: (path: string) => Uint8Array,
  decode: (mp3: Uint8Array) => number,
  loadTrack: (mp3: Uint8Array) => number,
  root: string,
): Speakers {
  const sounds = new Map<string, number>();
  for (const name of SOUND_NAMES)
    sounds.set(name, decode(read(`${root}/assets/sfx/${name}.mp3`)));
  const tracks = new Map<MusicTrack, number>();
  for (const name of MUSIC_NAMES)
    tracks.set(name, loadTrack(read(`${root}/assets/music/${name}.mp3`)));
  return createSpeakers(audio, sounds, tracks);
}

function createSpeakers(
  audio: AudioPlayer,
  sounds: Map<string, number>,
  tracks: Map<MusicTrack, number>,
): Speakers {
  let lastStep = -1000;
  let frame = 0;
  let currentTrack: MusicTrack | null = null;
  let currentDucked = false;
  let musicLevel = DEFAULT_MUSIC_LEVEL;
  let sfxLevel = DEFAULT_SFX_LEVEL;
  const musicGain = (): number =>
    musicLevel * MAX_MUSIC_GAIN * (currentDucked ? DUCKED_MULTIPLIER : 1);
  const sfxGain = (): number => sfxLevel * MAX_SFX_GAIN;
  const play = (name: string, rate = 1): void => {
    const vol = sfxGain();
    if (vol <= 0) return;
    const id = sounds.get(name);
    if (id !== undefined) audio.play(id, vol, rate);
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
    music: (track, ducked = false): void => {
      if (track === null) {
        if (currentTrack !== null) {
          audio.stopMusic(0);
          currentTrack = null;
          currentDucked = false;
        }
        return;
      }
      if (track !== currentTrack) {
        const id = tracks.get(track);
        if (id === undefined) return;
        currentTrack = track;
        currentDucked = ducked;
        audio.playMusic(id, true, musicGain(), 0);
      } else if (ducked !== currentDucked) {
        currentDucked = ducked;
        audio.setMusicVolume(musicGain(), 0);
      }
    },
    musicVolume: (): number => musicLevel,
    setMusicVolume: (level: number): void => {
      musicLevel = clamp01(level);
      if (currentTrack !== null) audio.setMusicVolume(musicGain(), 0);
    },
    sfxVolume: (): number => sfxLevel,
    setSfxVolume: (level: number): void => {
      sfxLevel = clamp01(level);
    },
    previewSfx: (): void => {
      play("turn-mine", 1);
    },
  };
}
