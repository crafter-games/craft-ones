export const WEAPONS = {
  rocket: {
    name: "Rocket",
    description: "Impact blast · balanced",
    icon: "rocket",
    minSpeed: 240,
    maxSpeed: 1000,
    gravity: 1,
    radius: 100,
    damage: 55,
    crater: 64,
    fuse: 8000,
    bounce: 0,
  },
  grenade: {
    name: "Grenade",
    description: "Bounces · 3 second fuse",
    icon: "grenade",
    minSpeed: 200,
    maxSpeed: 820,
    gravity: 1,
    radius: 130,
    damage: 65,
    crater: 88,
    fuse: 3000,
    bounce: 0.58,
  },
  mortar: {
    name: "Mortar",
    description: "Heavy shell · wide crater",
    icon: "mortar",
    minSpeed: 280,
    maxSpeed: 940,
    gravity: 1.3,
    radius: 145,
    damage: 72,
    crater: 100,
    fuse: 8000,
    bounce: 0,
  },
  dynamite: {
    name: "Dynamite",
    description: "Short toss · 2 second fuse",
    icon: "dynamite",
    minSpeed: 80,
    maxSpeed: 340,
    gravity: 1,
    radius: 170,
    damage: 85,
    crater: 124,
    fuse: 2000,
    bounce: 0.18,
  },
  grapple: {
    name: "Grapple",
    description: "Pull to terrain · spends turn",
    icon: "grapple",
    minSpeed: 1100,
    maxSpeed: 1100,
    gravity: 0,
    radius: 0,
    damage: 0,
    crater: 0,
    fuse: 800,
    bounce: 0,
  },
} as const;
export type WeaponId = keyof typeof WEAPONS;
export function isWeapon(value: unknown): value is WeaponId {
  return typeof value === "string" && Object.hasOwn(WEAPONS, value);
}
export const ABILITIES = {
  cuy: {
    name: "Second wind",
    description: "Recover 25 HP. Costs this turn; 2-turn cooldown.",
  },
  llama: {
    name: "Andean leap",
    description: "Leap toward your aim. Costs this turn; 2-turn cooldown.",
  },
} as const;
export type Species = keyof typeof ABILITIES;
export const COATS = {
  caramel: {
    name: "Caramel",
    fur: "#d88b51",
    light: "#ffe0a1",
    shade: "#a45e47",
  },
  cream: { name: "Cream", fur: "#f8e9c9", light: "#fff9e7", shade: "#d6baa0" },
  slate: { name: "Slate", fur: "#91a9be", light: "#dce8ec", shade: "#60768f" },
  rose: { name: "Rose", fur: "#dc959e", light: "#ffdde0", shade: "#a9647c" },
  sage: { name: "Sage", fur: "#97b08a", light: "#e0e8bb", shade: "#637e64" },
} as const;
export type CoatId = keyof typeof COATS;
export type PlayerOptions = { species: Species; coat: CoatId };
export function validPlayerOptions(value: unknown): value is PlayerOptions {
  if (!value || typeof value !== "object") return false;
  const { species, coat } = value as Record<string, unknown>;
  return (
    (species === "cuy" || species === "llama") &&
    typeof coat === "string" &&
    Object.hasOwn(COATS, coat)
  );
}
