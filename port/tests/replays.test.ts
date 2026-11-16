import { expect, test } from "bun:test";
import type { Input } from "dotframe/src/input";
import { createControls } from "../src/controls";
import {
  Bit,
  checksum,
  createMatch,
  KICKOFF_FRAMES,
  type Match,
  randomInput,
  step,
  WINDOW,
} from "../src/match";
import { replayButton } from "../src/render";
import {
  advanceReplay,
  openReplay,
  recordReplay,
  replayCount,
  replayEnded,
} from "../src/replays";

const mash = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

function playOut(match: Match, next: () => number): void {
  for (let f = 0; match.battle.state.phase !== "finished" && f < 30000; f++)
    step(match, [
      randomInput(next) & ~Bit.Restart,
      randomInput(next) & ~Bit.Restart,
    ]);
  expect(match.battle.state.phase).toBe("finished");
}

function watchToEnd(index: number): Match {
  const viewer = openReplay(index);
  for (let f = 0; !replayEnded(viewer) && f < 30000; f++) advanceReplay(viewer);
  expect(replayEnded(viewer)).toBe(true);
  return viewer.match;
}

test("a saved replay ends on the exact state the match finished in", () => {
  const match = createMatch(7);
  playOut(match, mash(3));
  const final = checksum(match);
  const before = replayCount();
  recordReplay(match, 0);
  expect(replayCount()).toBe(before + 1);
  const watched = watchToEnd(before);
  expect(checksum(watched)).toBe(final);
  expect(watched.battle.state.winner).toBe(match.battle.state.winner);
});

test("a rematch is its own replay, starting at its kickoff", () => {
  const match = createMatch(11);
  const next = mash(6);
  playOut(match, next);
  const first = replayCount();
  recordReplay(match, 0);
  step(match, [Bit.Restart, Bit.Restart]);
  expect(match.rematches).toBe(1);
  const from = match.frame - (KICKOFF_FRAMES - match.kickoff);
  playOut(match, next);
  const final = checksum(match);
  recordReplay(match, from);
  // Saving the same battle again refreshes it instead of adding another.
  recordReplay(match, from);
  expect(replayCount()).toBe(first + 2);
  const viewer = openReplay(first + 1);
  expect(viewer.match.rematches).toBe(1);
  expect(viewer.match.kickoff).toBe(KICKOFF_FRAMES);
  expect(checksum(watchToEnd(first + 1))).toBe(final);
});

test("the REPLAY button on the results card asks for the replay, not a rematch", () => {
  const match = createMatch(7);
  playOut(match, mash(3));
  const b = replayButton(WINDOW.width);
  const pointer = {
    x: (b.x + b.w / 2) / WINDOW.width,
    y: (b.y + b.h / 2) / WINDOW.height,
    buttons: 0,
  };
  const input: Input = {
    down: () => false,
    firstDown: () => -1,
    axis: () => 0,
    button: () => false,
    pointer: () => pointer,
    touches: () => [],
    look: () => ({ dx: 0, dy: 0 }) as ReturnType<Input["look"]>,
  };
  const controls = createControls(input, WINDOW.width, WINDOW.height);
  // The pointer counts once it has been up.
  pointer.buttons = 0;
  controls.bits(match);
  pointer.buttons = 1;
  expect(controls.bits(match) & Bit.Restart).toBe(0);
  expect(controls.replay()).toBe(true);
  expect(controls.replay()).toBe(false);
  expect(controls.menu()).toBe(false);
});
