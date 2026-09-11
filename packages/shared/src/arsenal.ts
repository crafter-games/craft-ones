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
  sticky: {
    name: "Sticky bomb",
    description: "Sticks to terrain & critters · 3 second fuse",
    icon: "sticky",
    minSpeed: 160,
    maxSpeed: 680,
    gravity: 1,
    radius: 120,
    damage: 60,
    crater: 76,
    fuse: 3000,
    bounce: 0,
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
export const SPECIES = [
  "cuy",
  "llama",
  "zorro",
  "ronsoco",
  "puma",
  "alpaca",
  "freddy",
  "michi",
  "railly",
] as const;
// Freddy and Michi remain implemented for licensed/private builds, but are not
// offered by the public setup flow until their usage rights are confirmed.
export const SELECTABLE_SPECIES = SPECIES.filter(
  (species) => species !== "freddy" && species !== "michi",
);
export const EXCLUSIVE_SPECIES = ["freddy", "michi", "railly"] as const;
export function isExclusive(species: Species) {
  return (EXCLUSIVE_SPECIES as readonly string[]).includes(species);
}
export const CHARACTERS = {
  freddy: {
    name: "Freddy",
    role: "Interdimensional guest",
    tagline: "One cuy. Too many dimensions.",
  },
  michi: {
    name: "Michi",
    role: "Cosmic troublemaker",
    tagline: "White fur. Loud consequences.",
  },
  railly: {
    name: "Railly Hugo",
    role: "Triangle master",
    tagline: "Ship fast. Aim faster.",
  },
  cuy: {
    name: "Guinea Pig",
    role: "All-rounder",
    tagline: "No tricks. Just good aim.",
  },
  llama: {
    name: "Llama",
    role: "High ground",
    tagline: "Always looking down on trouble.",
  },
  zorro: { name: "Fox", role: "Flanker", tagline: "One step ahead. Always." },
  ronsoco: {
    name: "Capybara",
    role: "Defender",
    tagline: "Immovable. Unimpressed.",
  },
  puma: {
    name: "Puma",
    role: "Ambusher",
    tagline: "Quiet feet. Loud landings.",
  },
  alpaca: {
    name: "Alpaca",
    role: "Survivor",
    tagline: "Fluffy, stubborn, hard to finish.",
  },
} as const;
export const ABILITIES = {
  freddy: {
    name: "Dimensional rift",
    description:
      "Aim and charge a rift orb. Its impact deals up to 70 area damage and carves a crater. Costs this turn; 2-turn cooldown.",
  },
  michi: {
    name: "Cosmic meow",
    description:
      "Aim a fast, low-gravity sonic pulse. Deals up to 55 area damage. Costs this turn; 2-turn cooldown.",
  },
  railly: {
    name: "Triangle barrage",
    description:
      "Aim and charge, then release three triangular shurikens along the same line. Up to 24 damage each. Costs one turn; 2-turn cooldown.",
  },
  cuy: null,
  zorro: {
    name: "Quickstep",
    description:
      "Dash up to 320 units along the ground toward your aim. Stops at walls, ledges and other critters. Costs this turn; 2-turn cooldown.",
  },
  ronsoco: {
    name: "Iron hide",
    description:
      "Absorb the next 30 blast damage. Shield lasts until used and cannot stack. Costs this turn; 2-turn cooldown.",
  },
  llama: {
    name: "Andean leap",
    description: "Leap toward your aim. Costs this turn; 2-turn cooldown.",
  },
  puma: {
    name: "Pounce",
    description:
      "Spring low and far toward your aim, further than a leap but closer to the ground. Costs this turn; 2-turn cooldown.",
  },
  alpaca: {
    name: "Second wind",
    description:
      "Shake off 25 damage, up to full health. Costs this turn; 2-turn cooldown.",
  },
} as const;
export type Species = (typeof SPECIES)[number];
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
    typeof species === "string" &&
    Object.hasOwn(CHARACTERS, species) &&
    typeof coat === "string" &&
    Object.hasOwn(COATS, coat)
  );
}

// Skills have their own projectile specs, never accepted by the public fire action.
export const ABILITY_PROJECTILES = {
  rift: {
    name: "Dimensional rift",
    minSpeed: 300,
    maxSpeed: 1080,
    gravity: 0.8,
    radius: 150,
    damage: 70,
    crater: 90,
    fuse: 8000,
    bounce: 0,
  },
  meow: {
    name: "Cosmic meow",
    minSpeed: 600,
    maxSpeed: 1200,
    gravity: 0.18,
    radius: 110,
    damage: 55,
    crater: 38,
    fuse: 5000,
    bounce: 0,
  },
  shuriken: {
    name: "Triangle barrage",
    minSpeed: 700,
    maxSpeed: 1300,
    gravity: 0.12,
    radius: 58,
    damage: 24,
    crater: 24,
    fuse: 3000,
    bounce: 0,
  },
} as const;
export const PROJECTILES = { ...WEAPONS, ...ABILITY_PROJECTILES };
export type ProjectileKind = keyof typeof PROJECTILES;
export function abilityProjectile(
  species: Species,
): keyof typeof ABILITY_PROJECTILES | null {
  return species === "freddy"
    ? "rift"
    : species === "michi"
      ? "meow"
      : species === "railly"
        ? "shuriken"
        : null;
}
export function isMovementAbility(
  species: Species,
): species is "llama" | "zorro" | "puma" {
  return species === "llama" || species === "zorro" || species === "puma";
}
export function abilityNeedsAim(species: Species) {
  return abilityProjectile(species) !== null || isMovementAbility(species);
}
