// iOS entry, compiled with scriptc in library mode. The host calls init once with the bundle's game folder, then
// frame every display refresh. Loading is synchronous: library mode has no promises.
import { createDraw2D, type Draw2D } from "dotframe/src/draw2d";
import { openLibraryPlatform } from "dotframe/src/native/library";
import type { BattleView } from "../../packages/shared/src";
import { loadSpeakersSync, type Speakers } from "../src/audio";
import { type Controls, createControls } from "../src/controls";
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
} from "../src/match";
import { createRenderer, loadArtSync } from "../src/render";

const STEP = 1 / 60;
let match: Match | null = null;
let draw: Draw2D | null = null;
let render:
  | ((match: Match, draw: Draw2D, touched: boolean, preview: number) => void)
  | null = null;
let controls: Controls | null = null;
let speakers: Speakers | null = null;
let heard: BattleView | null = null;
let simulated = -1;

export function init(base: string): void {
  const platform = openLibraryPlatform(WINDOW);
  const d = createDraw2D(platform.gpu, WINDOW.width, WINDOW.height);
  const read = (path: string): Uint8Array => platform.readFile(path);
  loadArtSync(d, read, (png: Uint8Array) => platform.image(png, true), base, [
    DEFAULT_OPTIONS.one,
    DEFAULT_OPTIONS.two,
  ]);
  speakers = loadSpeakersSync(platform.audio, read, platform.sound, base);
  const renderer = createRenderer(platform.gpu, WINDOW);
  render = (m: Match, dr: Draw2D, touched: boolean, preview: number): void =>
    renderer.render(m, dr, touched, preview);
  controls = createControls(platform.input, WINDOW.width, WINDOW.height);
  match = createMatch(
    Math.floor(Math.random() * 0x1_0000_0000),
    DEFAULT_OPTIONS,
  );
  draw = d;
}

// Returns false to ask the host to quit.
export function frame(time: number): boolean {
  const m = match;
  const d = draw;
  const c = controls;
  const r = render;
  if (!m || !d || !c || !r) return true;
  if (simulated < 0) simulated = time;
  for (let n = 0; simulated + STEP <= time && n < 5; n++) {
    const bits = c.bits(m);
    const inputs = [0, 0];
    const seat = seatOf(m);
    if (seat >= 0) inputs[seat] = bits;
    inputs[1 - Math.max(0, seat)] |= bits & (Bit.Restart | Bit.Map);
    const listener = m.battle.state.currentPlayer;
    step(m, inputs);
    const now = view(m);
    if (speakers) {
      speakers.hear(heard, now, listener);
      speakers.charge(seat >= 0 ? power01(m.charge[seat]) : 0, m.frame);
    }
    heard = now;
    simulated += STEP;
  }
  if (simulated < time - STEP * 5) simulated = time;
  d.begin();
  r(m, d, true, c.preview());
  d.end({ r: 0, g: 0, b: 0 });
  return true;
}
