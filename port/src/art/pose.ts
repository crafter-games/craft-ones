import type { ProjectileKind, Species } from "../../../packages/shared/src";
import { WEAPON_ART } from "./weapons";

export type { Species } from "../../../packages/shared/src";
export const HEAD_SCALE = 0.94;
type Joints = {
  neck: number[];
  hipBack: number[];
  hipFront: number[];
  earBack: number[];
  earFront: number[];
  ankle: number[];
};
export const joints: Record<Species, Joints> = {
  freddy: {
    neck: [0, -21],
    hipBack: [-11, 15],
    hipFront: [10, 15],
    earBack: [-16, -18],
    earFront: [15, -18],
    ankle: [0, 7],
  },
  michi: {
    neck: [0, -24],
    hipBack: [-8, 14],
    hipFront: [8, 14],
    earBack: [-15, -23],
    earFront: [13, -23],
    ankle: [0, 7],
  },
  railly: {
    neck: [0, -25],
    hipBack: [-9, 14],
    hipFront: [9, 14],
    earBack: [-22, -9],
    earFront: [21, -9],
    ankle: [0, 7],
  },
  cuy: {
    neck: [0, -16],
    hipBack: [-10, 10],
    hipFront: [8, 10],
    earBack: [-17, -21],
    earFront: [10, -24],
    ankle: [0, 7],
  },
  llama: {
    neck: [1, -25],
    hipBack: [-8, 10],
    hipFront: [8, 10],
    earBack: [-10, -22],
    earFront: [8, -23],
    ankle: [0, 7],
  },
  zorro: {
    neck: [1, -18],
    hipBack: [-10, 11],
    hipFront: [9, 11],
    earBack: [-13, -23],
    earFront: [8, -24],
    ankle: [0, 7],
  },
  ronsoco: {
    neck: [0, -15],
    hipBack: [-12, 11],
    hipFront: [11, 11],
    earBack: [-16, -21],
    earFront: [7, -23],
    ankle: [0, 7],
  },
  puma: {
    neck: [1, -19],
    hipBack: [-11, 11],
    hipFront: [10, 11],
    earBack: [-12, -24],
    earFront: [9, -25],
    ankle: [0, 7],
  },
  alpaca: {
    neck: [1, -22],
    hipBack: [-9, 10],
    hipFront: [9, 10],
    earBack: [-9, -21],
    earFront: [7, -22],
    ankle: [0, 7],
  },
};

/** The same ordered silhouettes and joint transforms drive SVG proofs and Phaser. */
export const BODY_LAYERS = [
  "tail",
  "legBack",
  "legFront",
  "handBack",
  "body",
  "weapon",
  "handFront",
  "head",
] as const;
// Paws float independently: no shoulder, arm segments or stretched connectors.
// The resting hand stays outside the torso while the leading hand holds a tool.
export function weaponPose(species: Species, angle = 0) {
  const x = {
    cuy: 19,
    llama: 16,
    zorro: 19,
    ronsoco: 24,
    puma: 21,
    alpaca: 18,
    freddy: 24,
    michi: 17,
    railly: 20,
  }[species];
  // Give a raised barrel just enough clearance to avoid the muzzle/face.
  return { x: x + Math.abs(Math.sin(angle)) * 8, y: 3 };
}
export function handPose(
  species: Species,
  front: boolean,
  angle: number,
  weapon?: ProjectileKind,
) {
  const rest = {
    freddy: { front: [28, 6, -1.3], back: [-27, 3, -1.5] },
    michi: { front: [23, 4, -1.4], back: [-21, -3, -1.2] },
    railly: { front: [26, 2, -1.2], back: [-26, -4, -1.4] },
    cuy: { front: [25, 3, -1.3], back: [-25, -1, -1.45] },
    llama: { front: [22, 5, -1.2], back: [-21, -9, -1.6] },
    zorro: { front: [25, 8, -1.5], back: [-26, 3, -1.05] },
    ronsoco: { front: [29, 5, -1.3], back: [-28, 0, -1.5] },
    puma: { front: [27, 7, -1.45], back: [-28, 2, -1.1] },
    alpaca: { front: [24, 4, -1.25], back: [-23, -6, -1.55] },
  }[species][front ? "front" : "back"];
  if (!weapon || !front) return { x: rest[0], y: rest[1], angle: rest[2] };
  const grip = WEAPON_ART[weapon].frontGrip;
  const origin = weaponPose(species, angle);
  return {
    x: origin.x + Math.cos(angle) * grip[0] - Math.sin(angle) * grip[1],
    y: origin.y + Math.sin(angle) * grip[0] + Math.cos(angle) * grip[1],
    angle,
  };
}
