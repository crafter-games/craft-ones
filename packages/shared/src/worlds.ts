import type { MapId } from "./terrain";
import { CELL, eraseCircle } from "./terrainGrid";

export const WORLD_WIDTH = 1792;
export const WORLD_HEIGHT = 1024;
export const WORLD_MAPS = {
  andes: {
    name: "Cloudbreak Valley",
    subtitle: "Hanging gardens · stone arches · deep ravines",
    spawns: [
      [288, 606],
      [1504, 606],
    ],
    background: "maps/andes.svg",
  },
  coast: {
    name: "Amber Hollows",
    subtitle: "Wind-carved cliffs · caves · sandstone bridges",
    spawns: [
      [304, 574],
      [1488, 574],
    ],
    background: "maps/coast.svg",
  },
} as const;

/** Original level layouts, authored independently of the decorative backdrops. */
export function makeWorld(mapId: MapId): string[] {
  if (mapId === "flat") return [];
  const width = WORLD_WIDTH / CELL,
    height = WORLD_HEIGHT / CELL;
  const cells = Array.from({ length: height }, () =>
    Array<string>(width).fill("0"),
  );
  const rect = (x: number, y: number, w: number, h: number) => {
    for (
      let row = Math.max(0, Math.floor(y / CELL));
      row < Math.min(height, Math.ceil((y + h) / CELL));
      row++
    )
      for (
        let col = Math.max(0, Math.floor(x / CELL));
        col < Math.min(width, Math.ceil((x + w) / CELL));
        col++
      )
        cells[row][col] = "1";
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number) => {
    for (let row = 0; row < height; row++)
      for (let col = 0; col < width; col++)
        if (
          (((col + 0.5) * CELL - cx) / rx) ** 2 +
            (((row + 0.5) * CELL - cy) / ry) ** 2 <
          1
        )
          cells[row][col] = "1";
  };
  if (mapId === "andes") {
    // Broad starting shelves, stepped routes and a central arch with a hollow belly.
    rect(0, 624, 496, 400);
    rect(1296, 624, 496, 400);
    rect(64, 544, 112, 80);
    rect(1616, 536, 112, 88);
    rect(472, 728, 216, 112);
    rect(1104, 728, 216, 112);
    ellipse(896, 648, 280, 208);
    rect(672, 632, 64, 320);
    rect(1056, 632, 64, 320);
    rect(592, 440, 192, 56);
    rect(1008, 440, 192, 56);
    ellipse(896, 300, 152, 48);
    rect(424, 528, 112, 40);
    rect(1264, 512, 120, 40);
  } else {
    rect(0, 592, 496, 432);
    rect(1296, 592, 496, 432);
    rect(32, 456, 136, 136);
    rect(1624, 464, 136, 128);
    ellipse(896, 792, 360, 216);
    rect(672, 696, 64, 280);
    rect(1056, 696, 64, 280);
    rect(480, 720, 160, 72);
    rect(1152, 720, 160, 72);
    rect(592, 488, 192, 64);
    rect(1008, 488, 192, 64);
    ellipse(896, 352, 152, 48);
    rect(416, 504, 112, 48);
    rect(1272, 504, 112, 48);
  }
  const rows = cells.map((row) => row.join(""));
  // True interior cavities and open passages, not just dents in a height field.
  eraseCircle(
    rows,
    896,
    mapId === "andes" ? 680 : 792,
    mapId === "andes" ? 112 : 144,
  );
  eraseCircle(rows, 144, 824, 96);
  eraseCircle(rows, 1648, 824, 96);
  eraseCircle(rows, 88, 944, 80);
  eraseCircle(rows, 1712, 944, 80);
  return rows;
}
