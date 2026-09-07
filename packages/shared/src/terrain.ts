import { ARENA } from "./config";

export type MapId = "flat" | "andes" | "coast";
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
} as const;

const profiles: Record<MapId, [number, number][]> = {
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
  const points = profiles[mapId];
  return Array.from({ length: ARENA.width / ARENA.terrainStep + 1 }, (_, i) => {
    const x = i * ARENA.terrainStep;
    const end = points.findIndex((p) => p[0] >= x);
    if (end <= 0) return points[0][1];
    const [ax, ay] = points[end - 1];
    const [bx, by] = points[end];
    return ay + ((x - ax) / (bx - ax)) * (by - ay);
  });
}

export function terrainHeight(terrain: ArrayLike<number>, x: number): number {
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
  terrain: { length: number; [index: number]: number },
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
