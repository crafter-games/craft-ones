import { ARENA } from "./config";
import type { PlayableMapId } from "./worlds";

export type MapId = "flat" | PlayableMapId;
export const MAPS = {
  andes: {
    name: "Highland Hop",
    subtitle: "Andean grasslands",
    sky: 0xb6e3df,
    earth: 0x76564c,
    grass: 0x78a75d,
  },
  coast: {
    name: "Dune Rumble",
    subtitle: "Pacific badlands",
    sky: 0xf4d5a1,
    earth: 0xbb795a,
    grass: 0xefbf78,
  },
  canopy: {
    name: "Emerald Ladder",
    subtitle: "Jungle canopy",
    sky: 0xc8e6ae,
    earth: 0x5f6550,
    grass: 0x4ea96b,
  },
  caldera: {
    name: "Cinder Crown",
    subtitle: "Volcanic crater",
    sky: 0xe7b7a8,
    earth: 0x66535f,
    grass: 0xc16e54,
  },
  totora: {
    name: "Totora Drift",
    subtitle: "Highland lake",
    sky: 0x9bcfd0,
    earth: 0xb98b4d,
    grass: 0xd5ad55,
  },
  saltglass: {
    name: "Saltglass Basin",
    subtitle: "Crystal salt flat",
    sky: 0xc9bde3,
    earth: 0xddd3c5,
    grass: 0xdf9db6,
  },
  huaca: {
    name: "Moonlit Huaca",
    subtitle: "Adobe strongholds",
    sky: 0x3f4f75,
    earth: 0xa86f4f,
    grass: 0xdfad68,
  },
  frost: {
    name: "Frostbite Shelf",
    subtitle: "Glacier halls",
    sky: 0xb9dce8,
    earth: 0x8bb6c8,
    grass: 0xe9f4e7,
  },
  loom: {
    name: "Storm Loom",
    subtitle: "Woven sky islands",
    sky: 0x596784,
    earth: 0x755b78,
    grass: 0xd59b55,
  },
  harbor: {
    name: "Clockwork Harbor",
    subtitle: "Timber docks",
    sky: 0x9ec7c0,
    earth: 0x8b6045,
    grass: 0xc69558,
  },
} as const;

const profiles: Record<"flat" | "andes" | "coast", [number, number][]> = {
  flat: [
    [0, 440],
    [960, 440],
  ],
  andes: [
    [0, 418],
    [96, 418],
    [160, 440],
    [288, 440],
    [360, 426],
    [432, 426],
    [504, 452],
    [576, 452],
    [648, 440],
    [800, 440],
    [864, 412],
    [960, 412],
  ],
  coast: [
    [0, 448],
    [112, 448],
    [176, 414],
    [288, 414],
    [360, 444],
    [456, 464],
    [552, 464],
    [648, 414],
    [784, 414],
    [864, 440],
    [960, 440],
  ],
};

export function makeTerrain(mapId: MapId): number[] {
  const profile = mapId === "andes" || mapId === "coast" ? mapId : "flat";
  const points = profiles[profile];
  return Array.from({ length: ARENA.width / ARENA.terrainStep + 1 }, (_, i) => {
    const x = i * ARENA.terrainStep;
    const end = points.findIndex((p) => p[0] >= x);
    if (end <= 0) return points[0][1];
    const [ax, ay] = points[end - 1];
    const [bx, by] = points[end];
    return ay + ((x - ax) / (bx - ax)) * (by - ay);
  });
}

export function terrainHeight(terrain: number[], x: number): number {
  if (!terrain.length) return ARENA.groundY;
  const index = Math.max(
    0,
    Math.min(terrain.length - 1, x / ARENA.terrainStep),
  );
  const low = Math.floor(index);
  return (
    terrain[low] +
    (terrain[Math.min(low + 1, terrain.length - 1)] - terrain[low]) *
      (index - low)
  );
}

/** A height field has solid ground below its surface; craters cannot create caves. */
export function carveCrater(
  terrain: number[],
  x: number,
  y: number,
  radius: number,
) {
  for (let i = 0; i < terrain.length; i++) {
    const dx = i * ARENA.terrainStep - x;
    if (Math.abs(dx) >= radius) continue;
    const bottom = y + Math.sqrt(radius * radius - dx * dx);
    terrain[i] = Math.min(ARENA.height - 22, Math.max(terrain[i], bottom));
  }
}
