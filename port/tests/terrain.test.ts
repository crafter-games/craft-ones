import { expect, test } from "bun:test";
import {
  CELL,
  PLAYABLE_MAP_IDS,
  terrainContours,
} from "../../packages/shared/src";
import { createMatch, view } from "../src/match";
import { rasterizeLoops, TEXEL } from "../src/render";

// The drawn terrain must be the physics terrain: contours only shave stair steps, never fill or open caves.
test.each([...PLAYABLE_MAP_IDS])(
  "%s terrain coverage matches occupancy",
  (map) => {
    const rows = view(createMatch(1, { map })).terrainRows;
    const width = (rows[0].length * CELL) / TEXEL;
    const height = (rows.length * CELL) / TEXEL;
    const coverage = rasterizeLoops(terrainContours(rows), width, height);
    let mismatched = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const solid =
          rows[Math.floor((y * TEXEL) / CELL)][
            Math.floor((x * TEXEL) / CELL)
          ] === "1";
        if (coverage[y * width + x] >= 0.5 !== solid) mismatched++;
      }
    expect(mismatched / (width * height)).toBeLessThan(0.005);
  },
);
