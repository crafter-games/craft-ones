// The dotframe CLI contract: dotframe sim, snap, replay, and desync drive a Craft Ones match through this module.
import type { Gpu } from "dotframe/src/gpu";
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
  randomInput,
  restore,
  type Saved,
  save,
  step,
  summary,
  view,
  WINDOW,
} from "./src/match";
import { createRenderer, loadArt, loadCritter } from "./src/render";

export default defineSim({
  players: PLAYERS,
  window: WINDOW,
  options: DEFAULT_OPTIONS as unknown as Record<string, unknown>,
  neutral: 0,
  encode,
  random: randomInput,
  create: (platform: SimPlatform): SimRun => {
    let match: Match = createMatch(1);
    const draw = platform.draw;
    // Snap does not know the match options when it loads, so it loads every critter (about 4 MB).
    const gpu = platform.gpu as Gpu;
    const art =
      platform.headless || !draw
        ? null
        : Promise.all([
            loadArt(gpu, draw, platform.load, "."),
            ...SPECIES.flatMap((species) =>
              Object.keys(COATS).map((coat) =>
                loadCritter(gpu, platform.load, ".", species, coat),
              ),
            ),
          ]);
    const renderer = draw ? createRenderer(platform.gpu, WINDOW) : null;
    return {
      ready: art ? art.then((): void => undefined) : Promise.resolve(),
      start: (seed: number, options: Record<string, unknown>): void => {
        match = createMatch(seed, options as Partial<MatchOptions>);
      },
      step: (inputs: number[]): void => step(match, inputs),
      checksum: (): number => checksum(match),
      state: (): unknown => summary(match),
      over: (): boolean => over(match),
      save: (): unknown => save(match),
      restore: (saved: unknown): void => {
        match = restore(saved as Saved);
      },
      inspect: (): unknown => ({
        view: view(match),
        angle: match.angle,
        charge: match.charge,
      }),
      render: (d) => renderer?.render(match, d),
    };
  },
});
