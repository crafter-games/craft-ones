import type { MapId } from "./terrain";
import { CELL, eraseCircle } from "./terrainGrid";

export const WORLD_WIDTH = 2688;
export const WORLD_HEIGHT = 1536;
export type PlayableMapId =
  | "andes"
  | "coast"
  | "canopy"
  | "caldera"
  | "totora"
  | "saltglass"
  | "huaca"
  | "frost"
  | "loom"
  | "harbor";
export const PLAYABLE_MAP_IDS: PlayableMapId[] = [
  "andes",
  "coast",
  "canopy",
  "caldera",
  "totora",
  "saltglass",
  "huaca",
  "frost",
  "loom",
  "harbor",
];
export const WORLD_MAPS = {
  andes: {
    name: "Cloudbreak Valley",
    subtitle: "Hanging gardens · stone arches · deep ravines",
    tip: "Deep ravines punish missed landings — keep ground under you.",
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
    tip: "Caves and bridges — splash hits hard in tight stone.",
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
    tip: "Split islands over open sky — one bad step is a void fall.",
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
    tip: "Brittle crater rims — the hollow middle drops away fast.",
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
  totora: {
    name: "Totora Drift",
    subtitle: "Reed villages · broad decks · deep channels",
    tip: "Broad reed decks over deep channels — stay on the path.",
    spawns: [
      [672, 894],
      [2016, 894],
    ],
    background: "maps/totora.svg",
    preview: "maps/totora-preview.svg",
    palette: {
      sky: "#9bcfd0",
      far: "#72aeb0",
      mid: "#4f8f96",
      near: "#356f7a",
      cloud: "#f7e8bd",
      cloudShade: "#d9d9ae",
      earth: "#b98b4d",
      shade: "#785e3d",
      light: "#dfbd72",
      outline: "#344944",
      underside: "#514735",
      rim: "#d5ad55",
      rimLight: "#f2db8a",
      tuft: "#839552",
      foliage: true,
      previewEarth: "#a97945",
      previewStrata: "#c99b56",
      previewRim: "#e8c86f",
    },
  },
  saltglass: {
    name: "Saltglass Basin",
    subtitle: "White terraces · crystal arches · long sightlines",
    tip: "Long sightlines — lob shots travel farther than they look.",
    spawns: [
      [408, 870],
      [2280, 870],
    ],
    background: "maps/saltglass.svg",
    preview: "maps/saltglass-preview.svg",
    palette: {
      sky: "#c9bde3",
      far: "#aaa2cf",
      mid: "#8585ba",
      near: "#666d9d",
      cloud: "#fff5df",
      cloudShade: "#e6d9dc",
      earth: "#ddd3c5",
      shade: "#9e91a0",
      light: "#f5ecdb",
      outline: "#4c4965",
      underside: "#71677b",
      rim: "#df9db6",
      rimLight: "#ffe0d1",
      tuft: "#ae7fa6",
      foliage: false,
      previewEarth: "#d9cfca",
      previewStrata: "#b9adc0",
      previewRim: "#f0b4c7",
    },
  },
  huaca: {
    name: "Moonlit Huaca",
    subtitle: "Adobe strongholds · temple chambers · moonlit roofs",
    tip: "Temple chambers — fights turn close once you go indoors.",
    spawns: [
      [680, 918],
      [2008, 918],
    ],
    background: "maps/huaca.svg",
    preview: "maps/huaca-preview.svg",
    palette: {
      sky: "#3f4f75",
      far: "#596487",
      mid: "#665d7f",
      near: "#403d61",
      cloud: "#9fa7bd",
      cloudShade: "#737e9d",
      earth: "#a86f4f",
      shade: "#75483d",
      light: "#ce9361",
      outline: "#302d42",
      underside: "#49333a",
      rim: "#dfad68",
      rimLight: "#ffd58a",
      tuft: "#92724c",
      foliage: false,
      previewEarth: "#9f684d",
      previewStrata: "#bd8058",
      previewRim: "#e6b46c",
    },
  },
  frost: {
    name: "Frostbite Shelf",
    subtitle: "Glacier halls · snow bridges · vertical shelves",
    tip: "Vertical shelves and snow bridges — height wins trades.",
    spawns: [
      [408, 894],
      [2280, 894],
    ],
    background: "maps/frost.svg",
    preview: "maps/frost-preview.svg",
    palette: {
      sky: "#b9dce8",
      far: "#93c2d5",
      mid: "#6fa5be",
      near: "#557f9e",
      cloud: "#f4f7e8",
      cloudShade: "#d9e7e7",
      earth: "#8bb6c8",
      shade: "#587b99",
      light: "#c7e4e5",
      outline: "#354e66",
      underside: "#405b76",
      rim: "#e9f4e7",
      rimLight: "#ffffff",
      tuft: "#d7ece8",
      foliage: false,
      previewEarth: "#82adbf",
      previewStrata: "#a9cfda",
      previewRim: "#f0f8ee",
    },
  },
  loom: {
    name: "Storm Loom",
    subtitle: "Woven islands · hooked routes · thunder gap",
    tip: "Hooked island routes — the thunder gap is a long fall.",
    spawns: [
      [408, 894],
      [2280, 894],
    ],
    background: "maps/loom.svg",
    preview: "maps/loom-preview.svg",
    palette: {
      sky: "#596784",
      far: "#6e7892",
      mid: "#4d5775",
      near: "#333d5d",
      cloud: "#a8aec0",
      cloudShade: "#7c859e",
      earth: "#755b78",
      shade: "#4f405e",
      light: "#a87483",
      outline: "#292a43",
      underside: "#393149",
      rim: "#d59b55",
      rimLight: "#ffd47c",
      tuft: "#ab735c",
      foliage: false,
      previewEarth: "#6c5574",
      previewStrata: "#90687f",
      previewRim: "#e6a75d",
    },
  },
  harbor: {
    name: "Clockwork Harbor",
    subtitle: "Timber docks · ship chambers · towering cranes",
    tip: "Docks and cranes — vertical cover, open water below.",
    spawns: [
      [600, 894],
      [2088, 894],
    ],
    background: "maps/harbor.svg",
    preview: "maps/harbor-preview.svg",
    palette: {
      sky: "#9ec7c0",
      far: "#72a19e",
      mid: "#527f80",
      near: "#365f67",
      cloud: "#f1e5be",
      cloudShade: "#d1d0ab",
      earth: "#8b6045",
      shade: "#5c4438",
      light: "#b78255",
      outline: "#313a36",
      underside: "#41352f",
      rim: "#c69558",
      rimLight: "#ebc477",
      tuft: "#71835a",
      foliage: false,
      previewEarth: "#805a43",
      previewStrata: "#a9744d",
      previewRim: "#d4a660",
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
    ellipse(856, 712, 520, 272);
    ellipse(928, 672, 336, 184, "0");
    rect(760, 400, 272, 304, "0");
    rect(824, 944, 80, 80, "0");
    island(64, 608, 288, 184);
    island(1400, 608, 328, 208);
    rect(336, 632, 224, 40);
    rect(1200, 648, 256, 32);
    island(352, 536, 96, 40);
    island(1288, 488, 144, 64);
    rect(456, 568, 112, 24);
    rect(1208, 560, 176, 24);
    const rows = cells.map((row) => row.join(""));
    carve(rows, 480, 736, 48);
    carve(rows, 1480, 680, 40);
    return rows;
  }
  if (mapId === "totora") {
    // Uneven reed decks and staggered roofs read as a shoreline village.
    island(24, 608, 520, 272);
    island(1216, 608, 552, 232);
    island(568, 552, 632, 296);
    rect(104, 528, 280, 80);
    rect(1448, 496, 240, 112);
    polygon([
      [648, 552],
      [720, 424],
      [824, 424],
      [872, 552],
    ]);
    polygon([
      [920, 552],
      [984, 456],
      [1104, 456],
      [1144, 552],
    ]);
    rect(456, 512, 176, 40);
    rect(1128, 488, 216, 48);
    const rows = cells.map((row) => row.join(""));
    carve(rows, 268, 736, 88);
    carve(rows, 1496, 720, 104);
    carve(rows, 960, 680, 96);
    return rows;
  }
  if (mapId === "saltglass") {
    // Wide salt banks frame a crystal colonnade with clean artillery lanes.
    polygon([
      [0, 592],
      [504, 592],
      [552, 656],
      [520, 1024],
      [0, 1024],
    ]);
    polygon([
      [1288, 656],
      [1336, 592],
      [1792, 592],
      [1792, 1024],
      [1272, 1024],
    ]);
    island(512, 720, 768, 240);
    polygon([
      [584, 720],
      [648, 472],
      [712, 720],
    ]);
    polygon([
      [760, 720],
      [840, 360],
      [928, 720],
    ]);
    polygon([
      [1000, 720],
      [1080, 440],
      [1152, 720],
    ]);
    rect(448, 536, 216, 56);
    rect(1128, 536, 216, 56);
    const rows = cells.map((row) => row.join(""));
    carve(rows, 896, 792, 152);
    carve(rows, 216, 760, 104);
    carve(rows, 1576, 760, 104);
    return rows;
  }
  if (mapId === "huaca") {
    // A low compound faces a taller citadel around an off-center stepped temple.
    polygon([
      [0, 624],
      [520, 624],
      [552, 672],
      [536, 1024],
      [0, 1024],
    ]);
    polygon([
      [1216, 688],
      [1280, 624],
      [1792, 624],
      [1792, 1024],
      [1232, 1024],
    ]);
    rect(40, 520, 320, 104);
    rect(1400, 472, 352, 152);
    rect(560, 664, 640, 264);
    rect(624, 568, 496, 96);
    rect(704, 480, 336, 88);
    rect(752, 376, 192, 104);
    rect(936, 744, 64, 280, "0");
    const rows = cells.map((row) => row.join(""));
    carve(rows, 272, 720, 104);
    carve(rows, 1456, 760, 128);
    carve(rows, 840, 720, 112);
    return rows;
  }
  if (mapId === "frost") {
    // A low glacier shelf faces a tall fractured wall across an offset arch.
    island(16, 608, 544, 288);
    island(1200, 608, 576, 240);
    island(480, 696, 816, 256);
    rect(496, 568, 280, 112);
    rect(1048, 536, 248, 160);
    ellipse(840, 584, 248, 176);
    island(160, 448, 280, 80);
    island(1288, 400, 344, 128);
    island(792, 320, 304, 96);
    const rows = cells.map((row) => row.join(""));
    carve(rows, 840, 632, 136);
    carve(rows, 288, 744, 96);
    carve(rows, 1328, 752, 96);
    return rows;
  }
  if (mapId === "loom") {
    // Uneven woven bands create a high left route and a hooked right descent.
    island(16, 608, 544, 280);
    island(1200, 608, 576, 240);
    polygon([
      [480, 608],
      [688, 472],
      [832, 472],
      [832, 552],
      [624, 688],
      [480, 688],
    ]);
    polygon([
      [928, 568],
      [984, 448],
      [1128, 472],
      [1328, 624],
      [1296, 704],
      [1152, 672],
    ]);
    polygon([
      [544, 824],
      [760, 680],
      [832, 680],
      [832, 760],
      [672, 872],
      [544, 872],
    ]);
    polygon([
      [1000, 704],
      [1088, 680],
      [1320, 792],
      [1296, 856],
      [1160, 888],
      [976, 776],
    ]);
    island(640, 312, 416, 112);
    const rows = cells.map((row) => row.join(""));
    carve(rows, 288, 744, 96);
    carve(rows, 1328, 752, 96);
    return rows;
  }
  if (mapId === "harbor") {
    // A low quay and tall crane dock flank an off-center playable ship.
    island(0, 608, 560, 288);
    island(1192, 608, 600, 240);
    polygon([
      [488, 624],
      [1264, 600],
      [1200, 880],
      [1088, 984],
      [680, 984],
      [568, 896],
    ]);
    rect(504, 552, 720, 72);
    rect(720, 376, 48, 192);
    rect(1000, 320, 56, 232);
    rect(600, 440, 296, 40);
    rect(880, 392, 248, 48);
    rect(280, 448, 48, 160);
    rect(1512, 400, 56, 208);
    rect(280, 448, 208, 40);
    rect(1344, 400, 224, 48);
    const rows = cells.map((row) => row.join(""));
    carve(rows, 840, 792, 144);
    carve(rows, 280, 744, 96);
    carve(rows, 1584, 736, 96);
    return rows;
  }
  if (mapId === "andes") {
    // A terraced garden faces a broken ridge across an off-center stone arch.
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
      [1264, 1024],
      [1320, 912],
      [1296, 824],
      [1328, 752],
      [1304, 680],
      [1336, 656],
    ]);
    rect(472, 728, 216, 112);
    rect(1128, 696, 168, 144);
    ellipse(840, 664, 304, 192);
    rect(672, 632, 64, 320);
    rect(1032, 640, 80, 312);
    island(24, 408, 184, 64);
    island(1584, 328, 176, 80);
    island(488, 312, 112, 32);
    island(1304, 240, 144, 40);
  } else if (mapId === "coast") {
    // A weathered mesa faces a tall sea stack around a slumped sandstone bowl.
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
      [1320, 672],
      [1360, 616],
      [1792, 592],
      [1792, 1024],
      [1272, 1024],
      [1336, 936],
      [1304, 864],
      [1368, 784],
      [1328, 728],
    ]);
    rect(1408, 592, 192, 64);
    rect(32, 456, 136, 136);
    rect(1576, 416, 184, 176);
    ellipse(840, 792, 400, 216);
    rect(672, 696, 64, 280);
    rect(1064, 680, 80, 296);
    rect(480, 720, 160, 72);
    rect(1160, 688, 192, 88);
    island(16, 360, 192, 72);
    island(1576, 280, 184, 96);
    island(336, 280, 136, 40);
    island(1336, 208, 160, 48);
  }
  const rows = cells.map((row) => row.join(""));
  // True interior cavities and open passages, not just dents in a height field.
  carve(
    rows,
    mapId === "andes" ? 840 : 920,
    mapId === "andes" ? 696 : 784,
    mapId === "andes" ? 112 : 144,
  );
  carve(rows, 144, 824, 96);
  carve(
    rows,
    mapId === "andes" ? 1584 : 1552,
    mapId === "andes" ? 776 : 800,
    mapId === "andes" ? 72 : 120,
  );
  carve(rows, 88, 944, 80);
  carve(rows, mapId === "andes" ? 1680 : 1648, 928, 96);
  return rows;
}
