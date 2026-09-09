import type { Species, WeaponId } from "@craft-ones/shared";
import { WEAPON_ART } from "../weapons/design";

export type { Species } from "@craft-ones/shared";
export const HEAD_SCALE = 0.94;
export const joints = {
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
} satisfies Record<Species, Record<string, number[]>>;

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
export function weaponPose() {
  return { x: 34, y: 2 };
}
export function handPose(
  species: Species,
  front: boolean,
  angle: number,
  weapon?: WeaponId,
) {
  const rest = {
    cuy: { front: [33, 2, -1.3], back: [-33, -5, -1.45] },
    llama: { front: [31, 5, -1.2], back: [-31, -16, -1.6] },
    zorro: { front: [35, 9, -1.5], back: [-47, 3, -1.05] },
    ronsoco: { front: [36, 5, -1.3], back: [-36, -3, -1.5] },
    puma: { front: [35, 8, -1.45], back: [-45, 2, -1.1] },
    alpaca: { front: [32, 4, -1.25], back: [-32, -13, -1.55] },
  }[species][front ? "front" : "back"];
  if (!weapon || !front) return { x: rest[0], y: rest[1], angle: rest[2] };
  const grip = WEAPON_ART[weapon].frontGrip;
  const origin = weaponPose();
  return {
    x: origin.x + Math.cos(angle) * grip[0] - Math.sin(angle) * grip[1],
    y: origin.y + Math.sin(angle) * grip[0] + Math.cos(angle) * grip[1],
    angle,
  };
}
