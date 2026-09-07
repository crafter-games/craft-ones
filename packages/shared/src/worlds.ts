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
  const polygon = (points: number[][]) => {
    for (let row = 0; row < height; row++)
      for (let col = 0; col < width; col++) {
        const x = (col + 0.5) * CELL,
          y = (row + 0.5) * CELL;
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [xi, yi] = points[i],
            [xj, yj] = points[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
            inside = !inside;
        }
        if (inside) cells[row][col] = "1";
      }
  };
  const island = (x: number, y: number, w: number, h: number) =>
    polygon([
      [x + 12, y],
      [x + w - 16, y],
      [x + w, y + 12],
      [x + w - 12, y + h * 0.65],
      [x + w * 0.7, y + h * 0.7],
      [x + w * 0.58, y + h],
      [x + w * 0.34, y + h * 0.7],
      [x + 12, y + h * 0.58],
      [x, y + 12],
    ]);
  if (mapId === "andes") {
    // Broad starting shelves, stepped routes and a central arch with a hollow belly.
    polygon([
      [0, 624],
      [448, 624],
      [456, 656],
      [496, 680],
      [464, 840],
      [432, 904],
      [496, 1024],
      [0, 1024],
    ]);
    polygon([
      [1344, 624],
      [1792, 624],
      [1792, 1024],
      [1296, 1024],
      [1360, 904],
      [1328, 840],
      [1296, 680],
      [1336, 656],
    ]);
    rect(64, 544, 112, 80);
    rect(1616, 536, 112, 88);
    rect(472, 728, 216, 112);
    rect(1104, 728, 216, 112);
    ellipse(896, 648, 280, 208);
    rect(672, 632, 64, 320);
    rect(1056, 632, 64, 320);
    island(576, 440, 224, 72);
    island(992, 440, 224, 72);
    ellipse(896, 300, 152, 48);
    island(416, 504, 128, 24);
    island(1248, 504, 128, 24);
  } else {
    polygon([
      [0, 592],
      [424, 592],
      [464, 624],
      [488, 696],
      [456, 760],
      [504, 848],
      [448, 928],
      [488, 1024],
      [0, 1024],
    ]);
    polygon([
      [1368, 592],
      [1792, 592],
      [1792, 1024],
      [1304, 1024],
      [1344, 928],
      [1288, 848],
      [1336, 760],
      [1304, 696],
      [1328, 624],
    ]);
    rect(32, 456, 136, 136);
    rect(1624, 464, 136, 128);
    ellipse(896, 792, 360, 216);
    rect(672, 696, 64, 280);
    rect(1056, 696, 64, 280);
    rect(480, 720, 160, 72);
    rect(1152, 720, 160, 72);
    island(504, 656, 144, 32);
    island(1144, 656, 144, 32);
    island(768, 520, 256, 32);
    island(576, 472, 200, 64);
    island(1016, 472, 200, 64);
    polygon([
      [728, 320],
      [872, 304],
      [1056, 344],
      [1080, 368],
      [1032, 400],
      [816, 384],
      [736, 352],
    ]);
    island(416, 472, 128, 24);
    island(1248, 472, 128, 24);
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
