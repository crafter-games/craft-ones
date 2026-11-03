// The dotframe CLI contract: dotframe sim, snap, replay, and desync drive a Craft Ones match through this module.
import { defineSim, type SimPlatform, type SimRun } from "dotframe/src/sim";
import { COATS, SPECIES } from "../packages/shared/src";
import {
  checksum,
  createMatch,
  DEFAULT_OPTIONS,
  encode,
  type Match,
  type MatchOptions,
  over,
  PLAYERS,
  ROLLBACK_WINDOW,
  randomInput,
  step,
  summary,
  view,
  WINDOW,
} from "./src/match";
import {
  createRenderer,
  type ImageLoader,
  loadArt,
  loadCritter,
} from "./src/render";
import {
  type MatchSnapshot,
  restoreMatch,
  snapshotMatch,
} from "./src/snapshot";

export default defineSim({
  players: PLAYERS,
  window: WINDOW,
  options: DEFAULT_OPTIONS as unknown as Record<string, unknown>,
  neutral: 0,
  // Matches the rollback engine's limit in src/netplay.ts.
  rollbackWindow: ROLLBACK_WINDOW,
  encode,
  random: randomInput,
  create: (platform: SimPlatform): SimRun => {
    let match: Match = createMatch(1);
    const draw = platform.draw;
    // Snap does not know the match options when it loads, so it loads every critter (about 4 MB).
    const image = platform.image;
    const load = async (): Promise<void> => {
      if (!draw || !image) return;
      const gpu: ImageLoader = {
        createImage: (png, smooth, mipmaps) => image(png, smooth, mipmaps),
      };
      await loadArt(gpu, draw, platform.load, ".");
      for (const species of SPECIES)
        for (const coat of Object.keys(COATS))
          await loadCritter(gpu, platform.load, ".", species, coat);
    };
    // Always built: desync renders through a stub Draw2D to prove rendering never changes the match.
    const renderer = createRenderer(platform.gpu, WINDOW);
    return {
      ready: platform.headless ? Promise.resolve() : load(),
      start: (seed: number, options: Record<string, unknown>): void => {
        match = createMatch(seed, options as Partial<MatchOptions>);
      },
      step: (inputs: number[]): void => step(match, inputs),
      checksum: (): number => checksum(match),
      state: (): unknown => summary(match),
      over: (): boolean => over(match),
      save: (): unknown => snapshotMatch(match),
      restore: (saved: unknown): void => {
        restoreMatch(match, saved as MatchSnapshot);
      },
      inspect: (): unknown => ({
        view: view(match),
        angle: match.angle,
        charge: match.charge,
        camera: match.camera,
        fx: match.fx,
        kickoff: match.kickoff,
      }),
      render: (d) => renderer.render(match, d),
    };
  },
});
