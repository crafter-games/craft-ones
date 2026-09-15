import { mkdir } from "node:fs/promises";
import {
  COATS,
  type CoatId,
  PROJECTILES,
  type ProjectileKind,
  SPECIES,
} from "@craft-ones/shared";
import {
  PARTS,
  partMarkup,
  partSvg,
  referenceCharacter,
} from "../src/game/characters/design";

import { weaponMarkup, weaponSvg } from "../src/game/weapons/design";

const root = new URL("../public/art/", import.meta.url);
const portraitFrames = {
  freddy: "-56 -78 112 112",
  michi: "-58 -86 116 116",
  railly: "-56 -86 112 112",
  cuy: "-50 -70 100 100",
  llama: "-56 -83 112 112",
  zorro: "-60 -85 120 120",
  ronsoco: "-50 -65 100 100",
  puma: "-60 -85 120 120",
  alpaca: "-56 -80 112 112",
};
const characterNotes = {
  freddy: "Exclusive / red chullo / green poncho / dimensional rift",
  michi: "Exclusive / white cat / orange nose / cosmic meow",
  railly: "Exclusive / dark spikes / black tee / triangle barrage",
  cuy: "Knitted brows / clenched teeth / raised paw",
  llama: "Slanted brows / stubborn pout / split hooves",
  zorro: "Sharp glare / tense muzzle / dark angular paws",
  ronsoco: "Heavy scowl / compressed mouth / broad fists",
  puma: "Rounded ears / broad cheeks / compact feline muzzle / heavy tail",
  alpaca: "Stubby ears / soft pout / pom-pom tail",
};
const rows: string[] = [];
for (const [i, species] of SPECIES.entries()) {
  await mkdir(new URL(`${species}/`, root), { recursive: true });
  for (const part of PARTS)
    await Bun.write(
      new URL(`${species}/${part}.svg`, root),
      partSvg(species, part),
    );
  for (const coat of Object.keys(COATS) as CoatId[]) {
    await mkdir(new URL(`${species}/${coat}/`, root), { recursive: true });
    for (const part of PARTS)
      await Bun.write(
        new URL(`${species}/${coat}/${part}.svg`, root),
        partSvg(species, part, coat),
      );
    await Bun.write(
      new URL(`${species}/${coat}/portrait.svg`, root),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${portraitFrames[species]}" width="250" height="250"><title>${COATS[coat].name} ${species} / original articulated character</title>${referenceCharacter(species, coat)}</svg>`,
    );
  }
  const y = 132 + i * 350;
  rows.push(
    `<path d="M36 ${y}H1244" stroke="#dfceb4"/><text x="42" y="${y + 32}" fill="#49332f" font-size="25" font-weight="bold">${String(i + 1).padStart(2, "0")} / ${species.toUpperCase()}</text><text x="42" y="${y + 54}" fill="#8b6b5a" font-size="11">${characterNotes[species]}</text><g transform="translate(150 ${y + 242}) scale(2.2)">${referenceCharacter(species)}</g>`,
  );
  Object.entries(COATS).forEach(([coat, palette], n) => {
    rows.push(
      `<g transform="translate(${62 + n * 45} ${y + 309})"><circle r="8" fill="${palette.fur}" stroke="#49332f" stroke-width="1.5"/><text y="22" text-anchor="middle" font-size="9" fill="#8b6b5a">${coat}</text></g>`,
    );
  });
  PARTS.forEach((part, n) => {
    rows.push(
      `<g transform="translate(${366 + (n % 7) * 134} ${y + 100 + Math.floor(n / 7) * 144})"><rect x="-42" y="-53" width="84" height="106" rx="8" fill="#fff8e9" stroke="#e5d6bf"/>${partMarkup(species, part)}<circle r="2" fill="#df6c50" stroke="#fff8e9" stroke-width=".8"/><text y="71" text-anchor="middle" font-size="11" fill="#8b6b5a">${part}${part === "tail" && (species === "cuy" || species === "ronsoco") ? " (none)" : ""}</text></g>`,
    );
  });
}
await Bun.write(
  new URL("character-reference.svg", root),
  `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="${180 + SPECIES.length * 350}" viewBox="0 0 1280 ${180 + SPECIES.length * 350}"><title>Craft Ones original character reference and cutouts</title><rect width="1280" height="${180 + SPECIES.length * 350}" rx="28" fill="#f8eedb"/><g font-family="Arial, sans-serif"><text x="42" y="51" font-size="30" font-weight="bold" fill="#49332f">CRAFT ONES / CHARACTER WORKSHOP</text><text x="42" y="80" font-size="14" fill="#8b6b5a">Six original critters + three adapted exclusive guests · warm contours · cream markings · inset color planes</text><text x="42" y="105" font-size="12" fill="#8b6b5a">80 × 100 transparent cutouts / coral dots mark the shared pivots / five coat palettes</text>${rows.join("")}<text x="42" y="${152 + SPECIES.length * 350}" font-size="12" fill="#8b6b5a">Same source shapes in the arena and the gallery. Independent ears, eyes, floating hands and feet. Floating hands. Guest signature outfits. Flat inset shadows.</text></g></svg>`,
);
await Bun.write(
  new URL("duel-poster.svg", root),
  `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="620" viewBox="0 0 720 620"><title>Cuy and Llama friendly duel</title><rect width="720" height="620" fill="#b6e3df"/><circle cx="570" cy="105" r="55" fill="#fff4c4"/><path d="M-50 420L135 140L320 399L451 181L750 430V640H-50Z" fill="#87b6af"/><path d="M96 200L135 140L175 200L144 187L130 206L115 188Z" fill="#eef1da"/><path d="M-50 452L150 326L283 399L506 309L750 405V640H-50Z" fill="#6f9e89"/><path d="M0 473Q190 415 360 487T720 459V620H0Z" fill="#7b594d"/><path d="M0 473Q190 415 360 487T720 459" fill="none" stroke="#91b46b" stroke-width="17"/><g transform="translate(180 420) scale(2.6)">${referenceCharacter("cuy", "caramel", "rocket", -0.2)}</g><g transform="translate(550 438) scale(-2.4 2.4)">${referenceCharacter("llama", "cream", "grapple", -0.18)}</g><path d="M236 367Q375 125 518 358" fill="none" stroke="#fff7d9" stroke-width="5" stroke-dasharray="3 16" stroke-linecap="round"/><g transform="translate(383 249) rotate(-4)">${weaponMarkup("rocket", true)}</g><text x="38" y="52" font-family="Arial" font-size="13" font-weight="bold" letter-spacing="2" fill="#3a5149">TINY CRITTERS / SERIOUS RIVALRY</text><g font-family="Arial" font-size="13" font-weight="bold" fill="#f8e7bb"><text x="92" y="558">CUY / SMALL BUT SPICY</text><text x="430" y="574">LLAMA / ZERO DRAMA*</text></g></svg>`,
);

await mkdir(new URL("weapons/", root), { recursive: true });
for (const kind of Object.keys(PROJECTILES) as ProjectileKind[])
  for (const projectile of [false, true])
    await Bun.write(
      new URL(`weapons/${kind}${projectile ? "-projectile" : ""}.svg`, root),
      weaponSvg(kind, projectile),
    );
const proofs: string[] = [];
const poses = [
  { kind: "rocket", angle: -1.25, stride: 0, facing: 1 },
  { kind: "grapple", angle: -0.35, stride: 18, facing: 1 },
  { kind: "grenade", angle: 0.7, stride: 0, facing: -1 },
  { kind: "mortar", angle: -0.8, stride: 0, facing: 1 },
  { kind: "dynamite", angle: 0.35, stride: -18, facing: -1 },
  { kind: "sticky", angle: -0.4, stride: 0, facing: 1 },
] as const;
for (const [row, species] of SPECIES.entries())
  for (const [col, pose] of poses.entries()) {
    proofs.push(
      `<g transform="translate(${150 + col * 290} ${220 + row * 250}) scale(${pose.facing * 2} 2)">${referenceCharacter(species, undefined, pose.kind, pose.angle, pose.stride)}</g><text x="${150 + col * 290}" y="${292 + row * 250}" text-anchor="middle">${species.toUpperCase()} / ${pose.kind}</text><text x="${150 + col * 290}" y="${312 + row * 250}" text-anchor="middle" font-size="11" font-weight="normal">${Math.round((pose.angle * 180) / Math.PI)}° aim · ${pose.facing === 1 ? "right" : "left"} facing${pose.stride ? " · stride" : ""}</text>`,
    );
  }
await Bun.write(
  new URL("pose-review.svg", root),
  `<svg xmlns="http://www.w3.org/2000/svg" width="1750" height="${110 + SPECIES.length * 250}" viewBox="0 0 1750 ${110 + SPECIES.length * 250}"><title>Character joints and all six weapon grips</title><rect width="1750" height="${110 + SPECIES.length * 250}" fill="#f8eedb"/><g font-family="Arial" font-size="13" font-weight="bold" fill="#49332f"><text x="36" y="35" font-size="21">CRAFT ONES / JOINTS + AIM REVIEW</text><text x="36" y="59" font-size="12" font-weight="normal">Shared rig transforms / independent floating paws / no arms / tool follows the leading hand / mirrored and walking poses</text>${proofs.join("")}</g></svg>`,
);
const weapons = (Object.keys(PROJECTILES) as ProjectileKind[])
  .map(
    (kind, i) =>
      `<g transform="translate(${115 + i * 180} 100) scale(2.3)">${weaponMarkup(kind)}</g><text x="${115 + i * 180}" y="165" text-anchor="middle">${PROJECTILES[kind].name}</text><g transform="translate(${115 + i * 180} 220) scale(1.4)">${weaponMarkup(kind, true)}</g>`,
  )
  .join("");
await Bun.write(
  new URL("weapons/reference.svg", root),
  `<svg xmlns="http://www.w3.org/2000/svg" width="${Object.keys(PROJECTILES).length * 180 + 50}" height="280"><title>Original arsenal and projectiles</title><rect width="${Object.keys(PROJECTILES).length * 180 + 50}" height="280" rx="16" fill="#e6e2c9"/><g font-family="Arial" font-size="14" font-weight="bold" fill="#354137"><text x="30" y="30">CRAFT ONES / ORIGINAL ARSENAL</text>${weapons}</g></svg>`,
);

await Bun.write(
  new URL("exclusive-guests.svg", root),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 460" width="1080" height="460"><title>Craft Ones exclusive guest adaptations</title><rect width="1080" height="460" rx="24" fill="#f8eedb"/><g font-family="Arial" fill="#49332f"><text x="38" y="48" font-size="23" font-weight="bold">EXCLUSIVE GUESTS / CRAFT ONES</text>${(["freddy", "michi", "railly"] as const).map((species, i) => `<g transform="translate(${170 + i * 360} 285) scale(2.4)">${referenceCharacter(species, "cream")}</g><text x="${170 + i * 360}" y="398" text-anchor="middle" font-size="19" font-weight="bold">${species === "railly" ? "RAILLY HUGO" : species.toUpperCase()}</text><text x="${170 + i * 360}" y="427" text-anchor="middle" font-size="13">${species === "freddy" ? "DIMENSIONAL RIFT" : species === "michi" ? "COSMIC MEOW" : "TRIANGLE BARRAGE"}</text>`).join("")}</g></svg>`,
);

await Bun.write(
  new URL("roster-grips.svg", root),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1020" width="1080" height="1020"><title>All nine character grips</title><rect width="1080" height="1020" fill="#f8eedb"/><g font-family="Arial" fill="#49332f"><text x="30" y="40" font-size="23" font-weight="bold">CRAFT ONES / CLOSE GRIPS</text>${SPECIES.map((species, i) => `<g transform="translate(${120 + (i % 3) * 360} ${245 + Math.floor(i / 3) * 315}) scale(1.7)">${referenceCharacter(species)}</g><g transform="translate(${260 + (i % 3) * 360} ${245 + Math.floor(i / 3) * 315}) scale(1.7)">${referenceCharacter(species, undefined, "rocket")}</g><text x="${180 + (i % 3) * 360}" y="${310 + Math.floor(i / 3) * 315}" text-anchor="middle" font-size="17">${species.toUpperCase()}</text>`).join("")}</g></svg>`,
);
