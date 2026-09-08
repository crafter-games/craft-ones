import { expect, test } from "bun:test";
import {
  CELL,
  eraseCircle,
  makeWorld,
  PLAYABLE_MAP_IDS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@craft-ones/shared";
import {
  contourPaths,
  terrainContours,
} from "../../../packages/shared/src/terrainContours";

test("arenas have 2.25 times the original area with unchanged collision precision", () => {
  expect(WORLD_WIDTH).toBe(2688);
  expect(WORLD_HEIGHT).toBe(1536);
  expect(CELL).toBe(8);
  for (const id of PLAYABLE_MAP_IDS) {
    const rows = makeWorld(id);
    expect(rows.length).toBe(192);
    expect(rows.every((row) => row.length === 336)).toBe(true);
  }
});

test("continuous contours preserve separate islands, holes and diagonal cell contacts", () => {
  const rows = [
    "00000000",
    "01111000",
    "01001000",
    "01111000",
    "00000100",
    "00000000",
  ];
  const contours = terrainContours(rows);
  expect(contours.length).toBe(3);
  const paths = contourPaths(contours);
  expect(paths.land.match(/Z/g)?.length).toBe(3);
  expect(paths.land).toContain("Q");
  expect(paths.rim).not.toBe("");
  expect(rows[2]).toBe("01001000");
});

test("craters produce compact curved boundaries without changing occupancy", () => {
  const rows = Array.from({ length: 40 }, () => "1".repeat(40));
  eraseCircle(rows, 160, 160, 100);
  const before = [...rows];
  const contours = terrainContours(rows);
  expect(contours.length).toBe(2);
  const hole = contours.find((points) =>
    points.every((p) => p.x > 0 && p.x < 320),
  );
  expect(hole).toBeDefined();
  if (!hole) throw new Error("Missing crater contour");
  expect(hole.length).toBeLessThan(60);
  for (const p of hole)
    expect(Math.abs(Math.hypot(p.x - 160, p.y - 160) - 100)).toBeLessThan(CELL);
  expect(rows).toEqual(before);
});
