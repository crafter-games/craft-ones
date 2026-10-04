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
  aimBits,
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
import {
  createRenderer,
  hotbarSlots,
  loadArt,
  loadCritter,
  screenToWorld,
  touchButtons,
} from "./src/render";
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
  // Pointer and touch, turned into the same encoded input as the keyboard. Aim follows the pointer only after
  // it moves, so the keyboard keeps aiming when the mouse sits still. A press on the hotbar picks a slot
  // instead of charging a shot.
  let lastPointer = { x: -1, y: -1 };
  let charging = false;
  let touched = false;
  const W = WINDOW.width;
  const H = WINDOW.height;
  const inside = (
    r: { x: number; y: number; w: number; h: number },
    px: number,
    py: number,
  ): boolean => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  const slotAt = (px: number, py: number): number =>
    hotbarSlots(W, H).findIndex((r) =>
      inside({ ...r, w: r.size, h: r.size }, px, py),
    ) + 1;
  const pointerBits = (current: Match): number => {
    const seat = seatOf(current);
    const player = current.battle.state.players[seat];
    if (!player) return 0;
    const aimAt = (px: number, py: number): number => {
      const world = screenToWorld(current, px, py);
      return aimBits(Math.atan2(world.y - player.y, world.x - player.x));
    };
    let bits = 0;
    const fingers = input.touches();
    if (fingers.length > 0) touched = true;
    let aimFinger = false;
    for (const f of fingers) {
      const px = f.x * W;
      const py = f.y * H;
      const button = touchButtons(H).find((b) => inside(b, px, py));
      if (button)
        bits |=
          button.id === "left"
            ? Bit.Left
            : button.id === "right"
              ? Bit.Right
              : Bit.Jump;
      else if (slotAt(px, py) > 0) bits |= slotBits(slotAt(px, py));
      else if (!aimFinger) {
        aimFinger = true;
        bits |= aimAt(px, py) | Bit.Fire;
      }
    }
    if (fingers.length > 0) return bits;
    const p = input.pointer();
    const px = p.x * W;
    const py = p.y * H;
    const held = (p.buttons & 1) !== 0;
    if (!held) charging = false;
    else if (!charging) {
      const slot = slotAt(px, py);
      if (slot > 0) return slotBits(slot);
      charging = true;
    }
    const moved = px !== lastPointer.x || py !== lastPointer.y;
    lastPointer = { x: px, y: py };
    if (moved && px >= 0 && px <= W && py >= 0 && py <= H)
      bits |= aimAt(px, py);
    if (charging) bits |= Bit.Fire | aimAt(px, py);
    return bits;
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
      bits |= pointerBits(match);
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
    renderer.render(match, draw, touched);
    draw.end({ r: 0, g: 0, b: 0 });
    return true;
  };
});
