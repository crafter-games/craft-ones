import { expect, test } from "bun:test";
import { DEFAULT_OPTIONS } from "../src/match";
import { createSetup, focusFirst, press, tap } from "../src/setup";

// The rematch screen of the player who lost: only their critter and the map are theirs to change.
const loserScreen = () => {
  const s = createSetup(DEFAULT_OPTIONS, false);
  s.editOne = false;
  s.editTwo = true;
  s.editMap = true;
  focusFirst(s);
  return s;
};

test("a rematch screen opens on the map, so the first confirm does not mean READY", () => {
  const s = loserScreen();
  expect(press(s, "right")).toBeNull();
  expect(s.options.map).not.toBe(DEFAULT_OPTIONS.map);
  expect(press(s, "confirm")).toBeNull();
  expect(press(s, "confirm")).not.toBeNull();
});

test("tapping the map preview cycles the map, and only for the player who picks it", () => {
  const s = loserScreen();
  tap(s, 640, 250, 1280, 720);
  expect(s.options.map).not.toBe(DEFAULT_OPTIONS.map);
  const winner = loserScreen();
  winner.editMap = false;
  tap(winner, 640, 250, 1280, 720);
  expect(winner.options.map).toBe(DEFAULT_OPTIONS.map);
});
