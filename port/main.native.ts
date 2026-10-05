// Native macOS and Windows: setup, then the same hot-seat match, through dotframe's scriptc backend.
// CRAFT_ONES_ROOT points at the port folder (assets/art, assets/sfx, node_modules/dotframe/assets/fonts).
import { createDraw2D } from "dotframe/src/draw2d";
import type { Frame } from "dotframe/src/gpu";
import { Key } from "dotframe/src/input";
import { loadBytes, run } from "dotframe/src/native/run";
import type { Platform } from "dotframe/src/platform";
import { type BattleView, COATS, SPECIES } from "../packages/shared/src";
import { loadSpeakers, type Speakers } from "./src/audio";
import { createControls } from "./src/controls";
import {
  Bit,
  createMatch,
  DEFAULT_OPTIONS,
  type Match,
  power01,
  seatOf,
  step,
  view,
  WINDOW,
} from "./src/match";
import { createRenderer, loadArt, loadCritter } from "./src/render";
import { createSetup, renderSetup } from "./src/setup";
import { createSetupInput } from "./src/setupInput";

const root = process.env.CRAFT_ONES_ROOT ?? ".";
const STEP = 1 / 60;

await run(WINDOW, ({ gpu, input, audio }: Platform): Frame => {
  const draw = createDraw2D(gpu, WINDOW.width, WINDOW.height);
  const renderer = createRenderer(gpu, WINDOW);
  let match: Match | null = null;
  const setup = createSetup(DEFAULT_OPTIONS);
  const setupInput = createSetupInput(input);
  let ready = false;
  // Every critter, so setup can preview any pick.
  const jobs: Promise<void>[] = [loadArt(gpu, draw, loadBytes, root)];
  for (const species of SPECIES)
    for (const coat of Object.keys(COATS))
      jobs.push(loadCritter(gpu, loadBytes, root, species, coat));
  Promise.all(jobs).then((): void => {
    ready = true;
  });
  let speakers: Speakers | null = null;
  let heard: BattleView | null = null;
  loadSpeakers(audio, loadBytes, root).then((s: Speakers): void => {
    speakers = s;
  });
  const controls = createControls(input, WINDOW.width, WINDOW.height);
  let simulated = -1;
  return (time: number): boolean => {
    draw.begin();
    if (ready && !match) {
      controls.disarm();
      const choice = setupInput.poll(setup, WINDOW.width, WINDOW.height);
      if (choice)
        match = createMatch(
          Math.floor(Math.random() * 0x1_0000_0000),
          choice.options,
        );
      renderSetup(setup, draw, WINDOW.width, WINDOW.height);
      simulated = -1;
    } else if (ready && match) {
      if (
        match.battle.state.phase === "finished" &&
        (setupInput.tapped([Key.Escape]) || controls.menu())
      )
        match = null;
    }
    if (ready && match) {
      if (simulated < 0) simulated = time;
      for (let n = 0; simulated + STEP <= time && n < 5; n++) {
        const bits = controls.bits(match);
        const inputs = [0, 0];
        const seat = seatOf(match);
        if (seat >= 0) inputs[seat] = bits;
        // R and M work for both seats; the rest only for the seat with the turn.
        inputs[1 - Math.max(0, seat)] |= bits & (Bit.Restart | Bit.Map);
        const listener = match.battle.state.currentPlayer;
        step(match, inputs);
        const now = view(match);
        if (speakers) {
          speakers.hear(heard, now, listener);
          speakers.charge(
            seat >= 0 ? power01(match.charge[seat]) : 0,
            match.frame,
          );
        }
        heard = now;
        simulated += STEP;
      }
      renderer.render(match, draw, controls.touched(), controls.preview());
    }
    draw.end({ r: 0, g: 0, b: 0 });
    return true;
  };
});
