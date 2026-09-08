import type { Species, WeaponId } from "@craft-ones/shared";
import { WEAPON_ART } from "../weapons/design";

export type { Species } from "@craft-ones/shared";
export const HEAD_SCALE = 0.94;
export const joints = {
  cuy: {
    neck: [0, -16],
    shoulderBack: [-6, -2],
    shoulderFront: [6, 0],
    hipBack: [-10, 10],
    hipFront: [8, 10],
    earBack: [-17, -21],
    earFront: [10, -24],
    wrist: [12, 0],
    ankle: [0, 7],
  },
  llama: {
    neck: [1, -25],
    shoulderBack: [-6, -3],
    shoulderFront: [6, -1],
    hipBack: [-8, 10],
    hipFront: [8, 10],
    earBack: [-10, -22],
    earFront: [8, -23],
    wrist: [12, 0],
    ankle: [0, 7],
  },
  zorro: {
    neck: [1, -18],
    shoulderBack: [-7, -2],
    shoulderFront: [7, 0],
    hipBack: [-10, 11],
    hipFront: [9, 11],
    earBack: [-13, -23],
    earFront: [8, -24],
    wrist: [12, 0],
    ankle: [0, 7],
  },
  ronsoco: {
    neck: [0, -15],
    shoulderBack: [-9, -2],
    shoulderFront: [9, 0],
    hipBack: [-12, 11],
    hipFront: [11, 11],
    earBack: [-16, -21],
    earFront: [7, -23],
    wrist: [12, 0],
    ankle: [0, 7],
  },
} satisfies Record<Species, Record<string, number[]>>;

/** The same ordered silhouettes and joint transforms drive SVG proofs and Phaser. */
export const BODY_LAYERS = [
  "tail",
  "legBack",
  "legFront",
  "armBack",
  "body",
  "weapon",
  "armFront",
  "head",
] as const;
export function armPose(
  species: Species,
  front: boolean,
  angle: number,
  weapon?: WeaponId,
) {
  const shoulder = joints[species][front ? "shoulderFront" : "shoulderBack"];
  const rest = {
    cuy: { front: -0.35, back: 1.3, length: 0.85 },
    llama: { front: 1.15, back: 1.65, length: 1.15 },
    zorro: { front: 0.15, back: 2.15, length: 0.95 },
    ronsoco: { front: 0.8, back: 1.9, length: 0.85 },
  }[species];
  // Tossed tools are held in one paw; the other retains the species' stance.
  if (
    !weapon ||
    (!front &&
      (weapon === "grenade" || weapon === "sticky" || weapon === "dynamite"))
  )
    return { angle: front ? rest.front : rest.back, length: rest.length };
  const grip = WEAPON_ART[weapon][front ? "frontGrip" : "backGrip"];
  const x = Math.cos(angle) * grip[0] - Math.sin(angle) * grip[1];
  const y = Math.sin(angle) * grip[0] + Math.cos(angle) * grip[1];
  const dx = x - shoulder[0],
    dy = y - shoulder[1];
  return { angle: Math.atan2(dy, dx), length: Math.hypot(dx, dy) / 12 };
}
