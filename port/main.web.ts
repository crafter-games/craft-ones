// Local hot-seat match on the web: one keyboard drives whichever seat has the turn, like /playground.
// ?map=coast&species=puma&coat=sage&species2=zorro&coat2=slate picks the match.
import { createDraw2D } from "dotframe/src/draw2d";
import type { Frame } from "dotframe/src/gpu";
import { Key } from "dotframe/src/input";
import type { Platform } from "dotframe/src/platform";
import { loadBytes, run } from "dotframe/src/web/run";
import type { CoatId, PlayableMapId, Species } from "../packages/shared/src";
import {
  Bit,
  createMatch,
  DEFAULT_OPTIONS,
  seatOf,
  step,
  WINDOW,
} from "./src/match";
import {
  createRenderer,
  critterLoaded,
  loadArt,
  loadCritter,
} from "./src/render";

const STEP = 1 / 60;
const params = new URLSearchParams(location.search);
const options = {
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
];

await run(WINDOW, ({ gpu, input }: Platform): Frame => {
  const draw = createDraw2D(gpu, WINDOW.width, WINDOW.height);
  const renderer = createRenderer(gpu, WINDOW);
  let match = createMatch(Math.floor(Math.random() * 0x1_0000_0000), options);
  let ready = false;
  Promise.all([
    loadArt(gpu, draw, loadBytes, "."),
    loadCritter(gpu, loadBytes, ".", options.one.species, options.one.coat),
    loadCritter(gpu, loadBytes, ".", options.two.species, options.two.coat),
  ]).then((): void => {
    ready =
      critterLoaded(options.one.species, options.one.coat) &&
      critterLoaded(options.two.species, options.two.coat);
  });
  let simulated = -1;
  return (time: number): boolean => {
    draw.begin();
    if (!ready) {
      draw.setFillStyle("#2b2330");
      draw.fillRect(0, 0, WINDOW.width, WINDOW.height);
      draw.end({ r: 0, g: 0, b: 0 });
      return true;
    }
    if (simulated < 0) simulated = time;
    for (let n = 0; simulated + STEP <= time && n < 5; n++) {
      let bits = 0;
      for (const [bit, keys] of BINDINGS)
        if (keys.some((k) => input.down(k))) bits |= bit;
      if (match.battle.state.phase === "finished" && input.down(Key.R))
        match = createMatch(match.seed + 1, options);
      const inputs = [0, 0];
      const seat = seatOf(match);
      if (seat >= 0) inputs[seat] = bits;
      step(match, inputs);
      simulated += STEP;
    }
    if (simulated < time - STEP * 5) simulated = time;
    renderer.render(match, draw);
    draw.end({ r: 0, g: 0, b: 0 });
    return true;
  };
});
