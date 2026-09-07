import { COATS, type CoatId, type WeaponId } from "@craft-ones/shared";
import { weaponMarkup } from "../weapons/design";
/** Original vector cutouts. Coordinates are relative to each named joint.
 * Transparent 80 × 100 viewbox: pivot (40, 50), consistent scale and lighting.
 * Keep this source and regenerate assets with bun apps/web/scripts/character-art.ts.
 */
import { armPose, BODY_LAYERS, HEAD_SCALE, joints, type Species } from "./pose";

export { joints, type Species } from "./pose";
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
  if (species === "zorro") {
    if (part.startsWith("ear"))
      return shape(
        `<path fill="${fur}" d="M-7 5L-10-22L-5-30L9-7L6 6Z"/><path fill="${shade}" stroke="none" d="M-4-21L4-5L-3 0Z"/>`,
      );
    if (part === "body")
      return shape(
        `<path fill="${fur}" d="M-13-16L2-20L14-13L18 3L12 15L-11 15L-18 3Z"/><path fill="${light}" stroke="none" d="M-5-13L6-15L12-5L8 0L11 7L3 13L-6 7L-4 0L-9-4Z"/>`,
      );
    if (part === "head")
      return shape(
        `<path fill="${fur}" d="M-19-21L-9-26L4-25L15-21L20-10L33-3L29 5L12 10L-4 9L-23 2L-18-3L-25-10Z"/><path fill="${light}" stroke="none" d="M-20-1L-10-7L-1 0L17-4L31-1L27 5L11 9L-3 8Z"/><path fill="${INK}" d="M27-5L35-3L31 1L27 0Z"/><path fill="none" stroke-width="1.6" d="M12 5L25 3M12 5l-3 2"/>`,
      );
    if (part === "tail")
      return shape(
        `<path fill="${fur}" d="M-12 7Q-30 11-35-6L-34-24L-25-18L-19-6L-10-3Z"/><path fill="${light}" d="M-35-7L-34-24L-25-18L-21-9L-28-12L-27-4Z" stroke="none"/>`,
      );
  }
  if (species === "ronsoco") {
    if (part.startsWith("ear"))
      return shape(
        `<path fill="${fur}" d="M-6 5L-8-5Q-6-14 2-12Q9-10 7 0L5 6Z"/><path fill="${shade}" stroke="none" d="M-3 1Q-6-8 1-8Q5-6 3 1Z"/>`,
      );
    if (part === "body")
      return shape(
        `<path fill="${fur}" d="M-18-13Q-25-3-20 12L-12 17H15L22 9L20-10L9-17Z"/><path fill="${light}" stroke="none" d="M-3-11L11-9L16 3L12 12H-2L-9 4Z"/><path fill="none" stroke="${shade}" d="M-15-1l3 5"/>`,
      );
    if (part === "head")
      return shape(
        `<path fill="${fur}" d="M-22-18L-14-25L3-27L20-20L29-10L31 5L23 10L-8 11L-24 4L-26-7Z"/><path fill="${shade}" stroke="none" d="M15-8L29-9L31 5L23 10H9L13 4Z"/><path fill="${INK}" stroke="none" d="M24-7L30-6L29-2L24-3Z"/><path fill="none" stroke-width="1.7" d="M12 5H25M12 5l-3 2"/>`,
      );
    if (part === "tail") return "";
  }
  if (part.startsWith("ear"))
    return shape(
      cuy
        ? `<path fill="${fur}" d="M-6 6C-14-7-9-16 0-15C9-14 12-4 6 6Z"/><path fill="#edab96" stroke="none" d="M-3 2Q-9-10-1-11Q6-11 4 2Z"/>`
        : `<path fill="${fur}" d="M-5 4C-10-9-7-26-2-27C5-26 8-6 5 5Z"/><path stroke="none" fill="#e9aa98" d="M-1-20Q4-13 2 0L-2 0Z"/>`,
    );
  if (part === "body")
    return shape(
      cuy
        ? `<path fill="${fur}" d="M-16-12Q-22-3-16 13Q-2 21 17 12Q22 1 14-13L3-17Z"/><path fill="${light}" stroke="none" d="M-5-9Q10-12 13 1L10 12Q-3 16-9 7Z"/><path stroke="${shade}" d="M-12 0l3 2m-4 3 3 2"/>`
        : `<path fill="${fur}" d="M-10-30L8-30L11-12Q22-7 16 10Q13 18-9 15Q-21 10-17-3L-9-14Z"/><path fill="${light}" stroke="none" d="M-5-23H5L7 3Q2 12-8 7Z"/>`,
    );
  if (part === "head")
    return shape(
      cuy
        ? `<path fill="${fur}" d="M-19-21L-9-27L2-25L9-27Q23-23 23-11L28-3L25 7L14 12L-10 9Q-25 5-24-9Z"/><path fill="${light}" stroke="none" d="M4-23Q18-20 17-8Q29-1 21 7Q10 13-1 6Q-7-3 1-7Z"/><path fill="${shade}" stroke="none" d="M13 5L25 1L23 8L14 11L2 8Z"/><path fill="${INK}" d="M22-2l5 1-3 3Z"/><path fill="none" stroke-width="1.7" d="M10 6Q16 4 22 6M10 6l-2 2"/>`
        : `<path fill="${fur}" d="M-17-17Q-16-26-6-26L-1-29L5-26L10-28L13-23Q21-22 19-9L26-6Q32-1 26 7Q16 13 4 8Q-14 11-19 0Z"/><path fill="${light}" stroke="none" d="M2-22Q14-20 13-9L23-3Q25 5 14 6L0 1Z"/><path fill="${shade}" d="M15-5Q32-8 30 1Q29 9 16 7Q9 4 15-5Z"/><path fill="${INK}" stroke="none" d="M24-3l4 1-3 3Z"/><path fill="none" stroke-width="1.7" d="M16 4Q21 2 26 4M16 4l-2 2"/>`,
    );
  if (part === "eyes")
    return shape(
      `<path fill="#efe8d1" d="M-5-14L10-10L8-4Q0 0-5-7Z"/><path fill="${INK}" stroke="none" d="M3-11Q8-11 7-5Q3-1 1-6Z"/><circle fill="#fff9e6" stroke="none" cx="5" cy="-8" r=".8"/><path fill="none" stroke-width="3.3" d="M-7-18L10-13"/><path fill="none" stroke="${shade}" stroke-width="1.3" d="M-4-1Q1 1 6-1"/>`,
    );
  if (part.startsWith("arm"))
    return shape(
      `<path fill="${limb}" stroke="none" d="M-4-3Q-6 0-3 4Q5 7 14 3L14-3Q4-7-4-3Z"/><path fill="none" stroke-width="1.8" d="M0-5Q8-6 14-3M0 5Q8 6 14 3"/>`,
    );
  if (part.startsWith("hand"))
    return shape(
      `<path fill="${limb}" stroke="none" d="M-5-4Q1-7 6-4Q11-2 9 3Q7 7 0 5L-5 3Z"/><path fill="none" stroke-width="1.8" d="M-1-5Q5-7 9-2Q12 3 6 5Q2 7-2 4"/><path fill="none" stroke-width="1.2" d="M4-1l4 2M2 2l4 2"/>`,
    );
  if (part.startsWith("leg"))
    return shape(`<path fill="${limb}" d="M-5-5Q0-8 5-4L4 8Q0 11-4 8Z"/>`);
  if (part.startsWith("foot"))
    return shape(
      `<path fill="${species === "llama" ? "#51444c" : limb}" d="M-5-1Q-2-5 4-3Q10-2 11 3Q10 6 6 6H-5Q-8 4-5-1Z"/><path fill="none" stroke="${species === "llama" ? "#a68b7d" : INK}" stroke-width="1.2" d="M3 2v3M7 2v3"/>`,
    );
  return cuy
    ? ""
    : shape(`<path fill="${fur}" d="M-14 1Q-31-5-24-12Q-13-11-10-5Z"/>`);
}

export function partSvg(species: Species, part: Part, coat?: CoatId) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-40 -50 80 100" width="160" height="200"><title>${species} ${part}</title>${partMarkup(species, part, coat)}</svg>`;
}

export function referenceCharacter(
  species: Species,
  coat?: CoatId,
  weapon?: WeaponId,
  angle = -0.25,
  stride = 0,
) {
  const j = joints[species];
  const at = (part: Part, x = 0, y = 0) =>
    `<g transform="translate(${x} ${y})">${partMarkup(species, part, coat)}</g>`;
  const leg = (front: boolean) =>
    `<g transform="translate(${j[front ? "hipFront" : "hipBack"].join(" ")}) rotate(${stride * (front ? -1 : 1)})">${at(front ? "legFront" : "legBack")}${at(front ? "footFront" : "footBack", ...j.ankle)}</g>`;
  const arm = (front: boolean) => {
    const p = armPose(species, front, angle, weapon);
    return `<g transform="translate(${j[front ? "shoulderFront" : "shoulderBack"].join(" ")}) rotate(${(p.angle * 180) / Math.PI})">${`<g transform="scale(${p.length} 1)">${at(front ? "armFront" : "armBack")}</g>`}${at(front ? "handFront" : "handBack", 12 * p.length, 0)}</g>`;
  };
  const layers = {
    tail: at("tail"),
    legBack: leg(false),
    legFront: leg(true),
    armBack: arm(false),
    body: at("body"),
    weapon: weapon
      ? `<g transform="rotate(${(angle * 180) / Math.PI})">${weaponMarkup(weapon)}</g>`
      : "",
    armFront: arm(true),
    head: `<g transform="translate(${j.neck.join(" ")}) scale(${HEAD_SCALE})">${at("earBack", ...j.earBack)}${at("earFront", ...j.earFront)}${at("head")}${at("eyes")}</g>`,
  };
  return BODY_LAYERS.map((key) => layers[key]).join("");
}
