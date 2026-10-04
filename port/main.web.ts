// Craft Ones on the web: setup screen, then a local hot-seat match where one keyboard drives whichever seat
// has the turn, like /playground. ?map=coast&species=puma&coat=sage&species2=zorro&coat2=slate skips setup.
import { createDraw2D } from "dotframe/src/draw2d";
import type { Frame } from "dotframe/src/gpu";
import { Key } from "dotframe/src/input";
import type { Platform } from "dotframe/src/platform";
import { loadBytes, run } from "dotframe/src/web/run";
import {
  type BattleView,
  COATS,
  type CoatId,
  type PlayableMapId,
  SPECIES,
  type Species,
} from "../packages/shared/src";
import { loadSpeakers, type Speakers } from "./src/audio";
import {
  Bit,
  createMatch,
  DEFAULT_OPTIONS,
  type Match,
  type MatchOptions,
  power01,
  seatOf,
  slotBits,
  step,
  view,
  WINDOW,
} from "./src/match";
import { createRenderer, loadArt, loadCritter } from "./src/render";
import { createSetup, press, renderSetup, type SetupKey } from "./src/setup";

const STEP = 1 / 60;
const params = new URLSearchParams(location.search);
const direct = params.has("map") || params.has("species");
const fromUrl: MatchOptions = {
  ...DEFAULT_OPTIONS,
  map: (params.get("map") ?? DEFAULT_OPTIONS.map) as PlayableMapId,
  one: {
    species: (params.get("species") ?? DEFAULT_OPTIONS.one.species) as Species,
    coat: (params.get("coat") ?? DEFAULT_OPTIONS.one.coat) as CoatId,
  },
  two: {
    species: (params.get("species2") ?? DEFAULT_OPTIONS.two.species) as Species,
    coat: (params.get("coat2") ?? DEFAULT_OPTIONS.two.coat) as CoatId,
  },
};
const BINDINGS: [number, number[]][] = [
  [Bit.Left, [Key.Left, Key.A]],
  [Bit.Right, [Key.Right, Key.D]],
  [Bit.Jump, [Key.Space, Key.W]],
  [Bit.AimUp, [Key.Up, Key.Q]],
  [Bit.AimDown, [Key.Down, Key.E]],
  [Bit.Fire, [Key.F, Key.Enter]],
  [Bit.Weapon, [Key.Tab, Key.X]],
  [Bit.Ability, [Key.C]],
  [Bit.Map, [Key.M]],
  [Bit.Restart, [Key.R]],
];
const SLOT_KEYS = [
  Key.Digit1,
  Key.Digit2,
  Key.Digit3,
  Key.Digit4,
  Key.Digit5,
  Key.Digit6,
  Key.Digit7,
];
const SETUP_KEYS: [SetupKey, number[]][] = [
  ["up", [Key.Up, Key.W]],
  ["down", [Key.Down, Key.S]],
  ["left", [Key.Left, Key.A]],
  ["right", [Key.Right, Key.D]],
  ["confirm", [Key.Enter, Key.Space, Key.F]],
];

await run(WINDOW, ({ gpu, input, audio }: Platform): Frame => {
  const draw = createDraw2D(gpu, WINDOW.width, WINDOW.height);
  const renderer = createRenderer(gpu, WINDOW);
  const setup = createSetup(fromUrl);
  let match: Match | null = direct
    ? createMatch(Math.floor(Math.random() * 0x1_0000_0000), fromUrl)
    : null;
  let speakers: Speakers | null = null;
  let heard: BattleView | null = null;
  let ready = false;
  // Every critter loads up front (about 4 MB) so the setup screen can preview any pick.
  Promise.all([
    loadArt(gpu, draw, loadBytes, "."),
    ...SPECIES.flatMap((species) =>
      Object.keys(COATS).map((coat) =>
        loadCritter(gpu, loadBytes, ".", species, coat),
      ),
    ),
  ]).then((): void => {
    ready = true;
  });
  loadSpeakers(audio, loadBytes, ".").then((s: Speakers): void => {
    speakers = s;
  });
  const held = new Set<number>();
  // Edge-triggered keys for the setup screen, which is not part of the simulation.
  const tapped = (keys: number[]): boolean => {
    const down = keys.some((k) => input.down(k));
    const was = keys.some((k) => held.has(k));
    for (const k of keys)
      if (input.down(k)) held.add(k);
      else held.delete(k);
    return down && !was;
  };
  let simulated = -1;
  return (time: number): boolean => {
    draw.begin();
    if (!ready) {
      draw.setFillStyle("#2b2330");
      draw.fillRect(0, 0, WINDOW.width, WINDOW.height);
      draw.end({ r: 0, g: 0, b: 0 });
      return true;
    }
    if (!match) {
      for (const [key, keys] of SETUP_KEYS)
        if (tapped(keys)) {
          const options = press(setup, key);
          if (options)
            match = createMatch(
              Math.floor(Math.random() * 0x1_0000_0000),
              options,
            );
        }
      renderSetup(setup, draw, WINDOW.width, WINDOW.height);
      draw.end({ r: 0, g: 0, b: 0 });
      simulated = -1;
      return true;
    }
    // Escape from a finished match goes back to setup.
    if (tapped([Key.Escape]) && match.battle.state.phase === "finished") {
      match = null;
      heard = null;
      draw.end({ r: 0, g: 0, b: 0 });
      return true;
    }
    if (simulated < 0) simulated = time;
    for (let n = 0; simulated + STEP <= time && n < 5; n++) {
      let bits = 0;
      for (const [bit, keys] of BINDINGS)
        if (keys.some((k) => input.down(k))) bits |= bit;
      SLOT_KEYS.forEach((k, i) => {
        if (input.down(k)) bits |= slotBits(i + 1);
      });
      const inputs = [0, 0];
      const seat = seatOf(match);
      if (seat >= 0) inputs[seat] = bits;
      // R and M work for both seats; the rest only for the seat with the turn.
      inputs[1 - Math.max(0, seat)] |= bits & (Bit.Restart | Bit.Map);
      const listener = match.battle.state.currentPlayer;
      step(match, inputs);
      const now = view(match);
      speakers?.hear(heard, now, listener);
      speakers?.charge(
        seat >= 0 ? power01(match.charge[seat]) : 0,
        match.frame,
      );
      heard = now;
      simulated += STEP;
    }
    if (simulated < time - STEP * 5) simulated = time;
    renderer.render(match, draw);
    draw.end({ r: 0, g: 0, b: 0 });
    return true;
  };
});
