import type { MapId } from "./terrain";
import { CELL, eraseCircle } from "./terrainGrid";

export const WORLD_WIDTH = 2688;
export const WORLD_HEIGHT = 1536;
export const PLAYABLE_MAP_IDS = [
  "andes",
  "coast",
  "canopy",
  "caldera",
] as const;
export type PlayableMapId = (typeof PLAYABLE_MAP_IDS)[number];
export const WORLD_MAPS = {
  andes: {
    name: "Cloudbreak Valley",
    subtitle: "Hanging gardens · stone arches · deep ravines",
    spawns: [
      [432, 918],
      [2256, 918],
    ],
    background: "maps/andes.svg",
    preview: "maps/andes-preview.svg",
    palette: {
      sky: "#bcdfce",
      far: "#99c6b5",
      mid: "#7eae9d",
      near: "#679584",
      cloud: "#ecf0cf",
      cloudShade: "#d8e6bf",
      earth: "#78513f",
      shade: "#543e36",
      light: "#956447",
      outline: "#493b33",
      underside: "#48372f",
      rim: "#77914c",
      rimLight: "#b1ce74",
      tuft: "#577e42",
      foliage: true,
      previewEarth: "#715044",
      previewStrata: "#8d6650",
      previewRim: "#9abc68",
    },
  },
  coast: {
    name: "Amber Hollows",
    subtitle: "Wind-carved cliffs · caves · sandstone bridges",
    spawns: [
      [456, 870],
      [2232, 870],
    ],
    background: "maps/coast.svg",
    preview: "maps/coast-preview.svg",
    palette: {
      sky: "#edbd9c",
      far: "#d39e86",
      mid: "#be8979",
      near: "#a97669",
      cloud: "#fff0c7",
      cloudShade: "#f3dcae",
      earth: "#a56b50",
      shade: "#825443",
      light: "#c28a61",
      outline: "#493b33",
      underside: "#48372f",
      rim: "#dba56d",
      rimLight: "#f3cc8e",
      tuft: "#a1a365",
      foliage: true,
      previewEarth: "#9d6250",
      previewStrata: "#bb805d",
      previewRim: "#e1b274",
    },
  },
  canopy: {
    name: "Emerald Ladder",
    subtitle: "Split treetop islands · root caves · open sky",
    spawns: [
      [384, 894],
      [2304, 894],
    ],
    background: "maps/canopy.svg",
    preview: "maps/canopy-preview.svg",
    palette: {
      sky: "#c8e6ae",
      far: "#a3c891",
      mid: "#7da887",
      near: "#608878",
      cloud: "#f0f2c5",
      cloudShade: "#dce4ad",
      earth: "#5f6550",
      shade: "#3c4b40",
      light: "#7c8060",
      outline: "#293f36",
      underside: "#263b33",
      rim: "#4ea96b",
      rimLight: "#b0dd73",
      tuft: "#287951",
      foliage: true,
      previewEarth: "#5f6550",
      previewStrata: "#7c8060",
      previewRim: "#76c675",
    },
  },
  caldera: {
    name: "Cinder Crown",
    subtitle: "Hollow crater · brittle approaches · basalt caves",
    spawns: [
      [360, 894],
      [2328, 894],
    ],
    background: "maps/caldera.svg",
    preview: "maps/caldera-preview.svg",
    palette: {
      sky: "#e7b7a8",
      far: "#c096a5",
      mid: "#a17f96",
      near: "#80677f",
      cloud: "#e9c5b5",
      cloudShade: "#cda6a9",
      earth: "#66535f",
      shade: "#433a4b",
      light: "#8b6571",
      outline: "#342e40",
      underside: "#302b3b",
      rim: "#c16e54",
      rimLight: "#f3b775",
      tuft: "#c16e54",
      foliage: false,
      previewEarth: "#66535f",
      previewStrata: "#8b6571",
      previewRim: "#e89c67",
    },
  },
} as const;

// Layout coordinates use the original artboard; rasterize at arena scale, keeping
// 8px collision cells and character/weapon sizes unchanged.
const layoutScale = 1.5;
const scaled = (value: number) =>
  Math.round((value * layoutScale) / CELL) * CELL;

/** Original level layouts, authored independently of the decorative backdrops. */
export function makeWorld(mapId: MapId): string[] {
  if (mapId === "flat") return [];
  const width = WORLD_WIDTH / CELL,
    height = WORLD_HEIGHT / CELL;
  const cells = Array.from({ length: height }, () =>
    Array<string>(width).fill("0"),
  );
  const rect = (x: number, y: number, w: number, h: number, value = "1") => {
    x = scaled(x);
    y = scaled(y);
    w = scaled(w);
    h = scaled(h);
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
        cells[row][col] = value;
  };
  const ellipse = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    value = "1",
  ) => {
    cx *= layoutScale;
    cy *= layoutScale;
    rx *= layoutScale;
    ry *= layoutScale;
    for (let row = 0; row < height; row++)
      for (let col = 0; col < width; col++)
        if (
          (((col + 0.5) * CELL - cx) / rx) ** 2 +
            (((row + 0.5) * CELL - cy) / ry) ** 2 <
          1
        )
          cells[row][col] = value;
  };
  const polygon = (points: number[][]) => {
    points = points.map((point) => point.map(scaled));
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
  const carve = (rows: string[], x: number, y: number, radius: number) =>
    eraseCircle(rows, x * layoutScale, y * layoutScale, radius * layoutScale);
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
  if (mapId === "canopy") {
    island(64, 608, 416, 224);
    island(1312, 608, 416, 248);
    island(504, 536, 184, 96);
    island(704, 464, 104, 80);
    island(1104, 544, 184, 104);
    island(984, 456, 96, 80);
    island(520, 800, 232, 96);
    island(1064, 744, 208, 104);
    island(320, 528, 120, 40);
    island(1360, 528, 120, 40);
    island(120, 432, 152, 72);
    island(1488, 392, 160, 72);
    const rows = cells.map((row) => row.join(""));
    carve(rows, 248, 696, 56);
    carve(rows, 1536, 704, 56);
    return rows;
  }
  if (mapId === "caldera") {
    ellipse(896, 712, 504, 272);
    ellipse(896, 680, 344, 200, "0");
    rect(736, 400, 320, 304, "0");
    rect(864, 944, 64, 80, "0");
    island(64, 608, 288, 184);
    island(1440, 608, 288, 184);
    rect(336, 632, 224, 40);
    rect(1232, 632, 224, 40);
    island(352, 536, 96, 40);
    island(1344, 536, 96, 40);
    rect(456, 568, 112, 24);
    rect(1224, 568, 112, 24);
    const rows = cells.map((row) => row.join(""));
    carve(rows, 480, 736, 48);
    carve(rows, 1312, 736, 48);
    return rows;
  }
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
    island(368, 552, 96, 32);
    island(1328, 552, 96, 32);
    island(416, 504, 128, 24);
    island(1248, 504, 128, 24);
  } else if (mapId === "coast") {
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
    island(368, 528, 96, 32);
    island(1328, 528, 96, 32);
    island(416, 472, 128, 24);
    island(1248, 472, 128, 24);
  }
  const rows = cells.map((row) => row.join(""));
  // True interior cavities and open passages, not just dents in a height field.
  carve(
    rows,
    896,
    mapId === "andes" ? 680 : 792,
    mapId === "andes" ? 112 : 144,
  );
  carve(rows, 144, 824, 96);
  carve(rows, 1648, 824, 96);
  carve(rows, 88, 944, 80);
  carve(rows, 1712, 944, 80);
  return rows;
}
