import { mkdir } from "node:fs/promises";
import {
  COATS,
  type CoatId,
  SPECIES,
  WEAPONS,
  type WeaponId,
} from "@craft-ones/shared";
import {
  PARTS,
  partMarkup,
  partSvg,
  referenceCharacter,
} from "../src/game/characters/design";

import { weaponMarkup, weaponSvg } from "../src/game/weapons/design";

const root = new URL("../public/art/", import.meta.url);
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
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-65 -105 130 135"><title>${coat} ${species}</title><g transform="translate(-3 0)">${referenceCharacter(species, coat)}</g></svg>`,
    );
  }
  const y = 210 + i * 320;
  rows.push(
    `<text x="60" y="${y - (i === 1 ? 135 : 80)}" fill="#3b2b38" font-size="24" font-weight="bold">${species.toUpperCase()}</text><g transform="translate(140 ${y + 45}) scale(2.2)">${referenceCharacter(species)}</g>`,
  );
  PARTS.forEach((part, n) => {
    rows.push(
      `<g transform="translate(${335 + (n % 7) * 99} ${y - 40 + Math.floor(n / 7) * 140})">${partMarkup(species, part)}<circle r="2" fill="#f47666"/><text y="45" x="-32" font-size="10" fill="#77616b">${part}</text></g>`,
    );
  });
}
await Bun.write(
  new URL("character-reference.svg", root),
  `<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="1420" viewBox="0 0 1040 1420"><title>Craft Ones original character reference and cutouts</title><rect width="1040" height="1420" rx="28" fill="#f8eedb"/><g font-family="Arial, sans-serif"><text x="55" y="55" font-size="30" font-weight="bold" fill="#3b2b38">CRAFT ONES / CHARACTER WORKSHOP</text><text x="55" y="83" font-size="14" fill="#77616b">Original vector cutouts · warm ink · no external shadows · red dots = pivots</text>${rows.join("")}<text x="55" y="1395" font-size="13" fill="#77616b">Four original rivals · hidden limb roots · distinct silhouettes · no clothing.</text></g></svg>`,
);
await Bun.write(
  new URL("duel-poster.svg", root),
  `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="620" viewBox="0 0 720 620"><title>Cuy and Llama friendly duel</title><rect width="720" height="620" fill="#b6e3df"/><circle cx="570" cy="105" r="55" fill="#fff4c4"/><path d="M-50 420L135 140L320 399L451 181L750 430V640H-50Z" fill="#87b6af"/><path d="M96 200L135 140L175 200L144 187L130 206L115 188Z" fill="#eef1da"/><path d="M-50 452L150 326L283 399L506 309L750 405V640H-50Z" fill="#6f9e89"/><path d="M0 473Q190 415 360 487T720 459V620H0Z" fill="#7b594d"/><path d="M0 473Q190 415 360 487T720 459" fill="none" stroke="#91b46b" stroke-width="17"/><g transform="translate(180 420) scale(2.6)">${referenceCharacter("cuy", "caramel", "rocket", -0.2)}</g><g transform="translate(550 438) scale(-2.4 2.4)">${referenceCharacter("llama", "cream", "grapple", -0.18)}</g><path d="M236 367Q375 125 518 358" fill="none" stroke="#fff7d9" stroke-width="5" stroke-dasharray="3 16" stroke-linecap="round"/><g transform="translate(383 249) rotate(-4)">${weaponMarkup("rocket", true)}</g><text x="38" y="52" font-family="Arial" font-size="13" font-weight="bold" letter-spacing="2" fill="#3a5149">TINY CRITTERS / SERIOUS RIVALRY</text><g font-family="Arial" font-size="13" font-weight="bold" fill="#f8e7bb"><text x="92" y="558">CUY / SMALL BUT SPICY</text><text x="430" y="574">LLAMA / ZERO DRAMA*</text></g></svg>`,
);

await mkdir(new URL("weapons/", root), { recursive: true });
for (const kind of Object.keys(WEAPONS) as WeaponId[])
  for (const projectile of [false, true])
    await Bun.write(
      new URL(`weapons/${kind}${projectile ? "-projectile" : ""}.svg`, root),
      weaponSvg(kind, projectile),
    );
const proofs: string[] = [];
for (const [row, species] of SPECIES.entries())
  for (const [col, angle] of [-1.25, -0.35, 0.7].entries()) {
    const kind = (["rocket", "grapple", "grenade"] as const)[col];
    proofs.push(
      `<g transform="translate(${150 + col * 290} ${200 + row * 250}) scale(${col === 2 ? -2 : 2} 2)">${referenceCharacter(species, species === "llama" ? "cream" : "caramel", kind, angle, col === 1 ? 18 : 0)}</g><text x="${65 + col * 290}" y="${270 + row * 250}">${species.toUpperCase()} · ${kind}</text>`,
    );
  }
await Bun.write(
  new URL("pose-review.svg", root),
  `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1090" viewBox="0 0 900 1090"><title>Character joints and aim poses</title><rect width="900" height="1090" fill="#e6e2c9"/><g font-family="Arial" font-size="13" font-weight="bold" fill="#354137"><text x="36" y="35">CRAFT ONES / JOINTS + AIM REVIEW</text>${proofs.join("")}</g></svg>`,
);
const weapons = (Object.keys(WEAPONS) as WeaponId[])
  .map(
    (kind, i) =>
      `<g transform="translate(${115 + i * 180} 100) scale(2.3)">${weaponMarkup(kind)}</g><text x="${115 + i * 180}" y="165" text-anchor="middle">${WEAPONS[kind].name}</text><g transform="translate(${115 + i * 180} 220) scale(1.4)">${weaponMarkup(kind, true)}</g>`,
  )
  .join("");
await Bun.write(
  new URL("weapons/reference.svg", root),
  `<svg xmlns="http://www.w3.org/2000/svg" width="950" height="280"><title>Original arsenal and projectiles</title><rect width="950" height="280" rx="16" fill="#e6e2c9"/><g font-family="Arial" font-size="14" font-weight="bold" fill="#354137"><text x="30" y="30">CRAFT ONES / ORIGINAL ARSENAL</text>${weapons}</g></svg>`,
);
