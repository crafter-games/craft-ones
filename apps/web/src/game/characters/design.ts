import { COATS, type CoatId } from "@craft-ones/shared";
/** Original vector cutouts. Coordinates are relative to each named joint.
 * Transparent 80 × 100 viewbox: pivot (40, 50), consistent scale and lighting.
 * Keep this source and regenerate assets with bun apps/web/scripts/character-art.ts.
 */
export type Species = "cuy" | "llama";
export const PARTS = [
  "body",
  "head",
  "earBack",
  "earFront",
  "armBack",
  "armFront",
  "handBack",
  "handFront",
  "legBack",
  "legFront",
  "footBack",
  "footFront",
  "eyes",
  "tail",
] as const;
export type Part = (typeof PARTS)[number];
export const INK = "#3b2b38";
export const joints = {
  cuy: {
    neck: [0, -14],
    shoulderBack: [-6, -2],
    shoulderFront: [6, 0],
    hipBack: [-10, 10],
    hipFront: [8, 10],
    earBack: [-15, -20],
    earFront: [9, -22],
    wrist: [12, 0],
    ankle: [0, 7],
  },
  llama: {
    neck: [1, -26],
    shoulderBack: [-6, -3],
    shoulderFront: [6, -1],
    hipBack: [-8, 10],
    hipFront: [8, 10],
    earBack: [-9, -19],
    earFront: [7, -19],
    wrist: [12, 0],
    ankle: [0, 7],
  },
} satisfies Record<Species, Record<string, number[]>>;

export function partMarkup(
  species: Species,
  part: Part,
  coat?: CoatId,
): string {
  const cuy = species === "cuy";
  const { fur, light, shade } = COATS[coat ?? (cuy ? "caramel" : "cream")];
  const limb = part.endsWith("Back") ? shade : fur;
  const stroke = `stroke="${INK}" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round"`;
  const shape = (s: string) => `<g ${stroke}>${s}</g>`;
  if (part.startsWith("ear"))
    return shape(
      cuy
        ? `<path fill="${fur}" d="M-5 5C-15-11 3-17 8-6L7 5Z"/><path fill="#edab96" stroke="none" d="M-3 1C-9-8 1-10 3-5L4 1Z"/>`
        : `<path fill="${fur}" d="M-5 4C-10-9-7-26-2-27C5-26 8-6 5 5Z"/><path stroke="none" fill="#e9aa98" d="M-1-20Q4-13 2 0L-2 0Z"/>`,
    );
  if (part === "body")
    return shape(
      cuy
        ? `<path fill="${fur}" d="M-16-9Q-21 1-14 13Q0 20 16 11Q22-1 12-12Q0-19-16-9Z"/><ellipse fill="${light}" stroke="none" cx="3" cy="4" rx="11" ry="10"/><path stroke="${shade}" d="M-12 0l3 2m-4 3 3 2"/>`
        : `<path fill="${fur}" d="M-10-30L8-30L11-12Q22-7 16 10Q13 18-9 15Q-21 10-17-3L-9-14Z"/><path fill="${light}" stroke="none" d="M-5-23H5L7 3Q2 12-8 7Z"/>`,
    );
  if (part === "head")
    return shape(
      cuy
        ? `<path fill="${fur}" d="M-19-20Q-8-30 8-24Q24-23 24-10Q32-1 24 8Q10 16-11 10Q-26 6-24-9Z"/><path fill="${light}" stroke="none" d="M4-23Q18-20 17-8Q29-1 21 7Q10 13-1 6Q-7-3 1-7Z"/><ellipse fill="#efb895" stroke="none" cx="16" cy="2" rx="7" ry="4"/><path fill="${INK}" d="M22-2l5 1-3 3Z"/><path fill="none" d="M20 7q-5 3-8-1"/><path fill="#fff9e7" stroke-width="1.2" d="M14 7h5v5h-5z"/>`
        : `<path fill="${fur}" d="M-17-17Q-16-26-6-26L-1-29L5-26L10-28L13-23Q21-22 19-9L26-6Q32-1 26 7Q16 13 4 8Q-14 11-19 0Z"/><path fill="${light}" stroke="none" d="M2-22Q14-20 13-9L23-3Q25 5 14 6L0 1Z"/><path fill="${shade}" d="M15-5Q32-8 30 1Q29 9 16 7Q9 4 15-5Z"/><path fill="${INK}" stroke="none" d="M24-3l4 1-3 3Z"/><path fill="none" d="M18 3q2 3 5 1"/>`,
    );
  if (part === "eyes")
    return shape(
      `<ellipse fill="#fffdf1" cx="2" cy="-10" rx="7" ry="8"/><ellipse fill="${INK}" stroke="none" cx="4" cy="-9" rx="3.2" ry="4.5"/><circle fill="white" stroke="none" cx="5" cy="-11" r="1.2"/><path fill="none" d="M-5-20q6-4 11 0"/>`,
    );
  if (part.startsWith("arm"))
    return shape(`<path fill="${limb}" d="M-3-5Q6-7 14-3L15 4Q6 8-3 4Z"/>`);
  if (part.startsWith("hand"))
    return shape(
      `<path fill="${limb}" d="M-4-4Q3-8 8-3Q12 2 6 6L-3 5Z"/><path fill="none" stroke-width="1.3" d="M3 2l3 2M5-1l3 2"/>`,
    );
  if (part.startsWith("leg"))
    return shape(`<path fill="${limb}" d="M-5-3H5L6 9H-5Z"/>`);
  if (part.startsWith("foot"))
    return shape(
      `<path fill="${cuy ? limb : INK}" d="M-5-2Q2-5 9 0L10 5H-6Z"/><path stroke="${cuy ? INK : "#8c6c6a"}" stroke-width="1.3" d="M3 1v3M6 2v2"/>`,
    );
  return cuy
    ? ""
    : shape(`<path fill="${fur}" d="M-14 1Q-31-5-24-12Q-13-11-10-5Z"/>`);
}

export function partSvg(species: Species, part: Part, coat?: CoatId) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-40 -50 80 100" width="160" height="200"><title>${species} ${part}</title>${partMarkup(species, part, coat)}</svg>`;
}

export function referenceCharacter(species: Species, coat?: CoatId) {
  const j = joints[species];
  const at = (part: Part, x = 0, y = 0, rotation = 0) =>
    `<g transform="translate(${x} ${y}) rotate(${rotation})">${partMarkup(species, part, coat)}</g>`;
  return (
    at("tail") +
    at("legBack", ...j.hipBack) +
    at("footBack", j.hipBack[0], 17) +
    at("armBack", ...j.shoulderBack, -25) +
    at("handBack", 6, -8) +
    at("body") +
    at("legFront", ...j.hipFront) +
    at("footFront", j.hipFront[0], 17) +
    `<g transform="translate(${j.neck.join(" ")})">${at("earBack", ...j.earBack)}${at("head")}${at("earFront", ...j.earFront)}${at("eyes")}</g>` +
    at("armFront", ...j.shoulderFront, -15) +
    at("handFront", 18, -4)
  );
}
