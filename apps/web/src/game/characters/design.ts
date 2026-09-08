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
export const INK = "#49332f";

export function partMarkup(
  species: Species,
  part: Part,
  coat?: CoatId,
): string {
  const { fur, light, shade } =
    COATS[coat ?? (species === "llama" ? "cream" : "caramel")];
  const back = part.endsWith("Back");
  const limb = back ? shade : fur;
  const cream = "#fff0cf";
  const creamShade = "#dfbd94";
  const innerEar = back ? "#bd7d6e" : "#e5a18a";
  const paw = "#755047";
  const stroke = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"`;
  const shape = (...paths: string[]) => `<g ${stroke}>${paths.join("")}</g>`;

  if (species === "cuy") {
    if (part.startsWith("ear"))
      return shape(
        `<path fill="${limb}" d="${back ? "M-6 6C-13 0-14-9-7-13C0-17 8-12 9-5Q10 2 5 7Z" : "M-7 6C-12 0-12-11-5-14C3-18 13-10 10-3L6 7Z"}"/>`,
        `<path fill="${innerEar}" stroke="none" d="M-4 3Q-10-8-4-10Q4-13 6-5L3 3Z"/>`,
        `<path fill="none" stroke="${creamShade}" stroke-width="1.6" d="M-6-7Q-4-11 0-9"/>`,
        `<path fill="none" stroke-width="1.4" d="M-3 2Q-5-4 1-4"/>`,
      );
    if (part === "body")
      return shape(
        `<path fill="${fur}" d="M-15-14Q-5-20 10-16C20-13 24 2 18 12Q15 18 1 18Q-14 19-19 11C-25 0-23-8-15-14Z"/>`,
        `<path fill="${shade}" stroke="none" d="M-19-5Q-18 8-8 12L6 16Q-9 18-16 10Q-21 3-19-5Z"/>`,
        `<path fill="${cream}" stroke="none" d="M-3-11C8-15 16-7 16 3Q16 12 7 15Q-2 17-10 9C-14 3-11-6-3-11Z"/>`,
        `<path fill="${creamShade}" stroke="none" d="M14 1Q14 11 5 12Q-1 13-6 10Q-2 16 7 14Q16 11 14 1Z"/>`,
        `<path fill="${light}" stroke="none" d="M-17-7Q-15-12-10-12L-12-7L-16-3Z"/>`,
        `<path fill="none" stroke="${shade}" stroke-width="1.5" d="M-16 2l2 2m-1 2 2 1"/>`,
      );
    if (part === "head")
      return shape(
        `<path fill="${fur}" d="M-24-13Q-24-24-13-27L-7-26L-3-30L2-28L7-30L10-26Q23-24 24-13L25-8Q32-4 29 5Q27 13 15 14L-1 12Q-15 14-22 7Q-30 1-26-8Z"/>`,
        `<path fill="${shade}" stroke="none" d="M-23-9Q-25 2-17 6Q-7 12 8 10L21 9Q15 15-1 10Q-16 12-22 4Q-27-1-23-9Z"/>`,
        `<path fill="${light}" stroke="none" d="M-18-20Q-13-25-7-23L-10-19L-16-17Z"/>`,
        `<path fill="${cream}" stroke="none" d="M8-25Q17-24 19-18L17-10Q19-7 26-6Q31 1 26 8Q22 13 13 11Q7 14 0 8Q-8 3-4-4Q-1-8 6-7Q11-13 8-25Z"/>`,
        `<path fill="${creamShade}" stroke="none" d="M-2 5Q3 9 10 9Q19 13 27 5Q25 13 14 12Q4 13-2 5Z"/>`,
        `<path fill="${INK}" stroke="none" d="M22-3Q26-5 29-2Q29 0 25 2Q22 1 22-3Z"/>`,
        `<path fill="none" stroke="${creamShade}" stroke-width="1.3" d="M23-3l2-.4"/>`,
        `<path fill="${INK}" stroke-width="1.3" d="M6 9Q12 1 21 5L25 9Q16 6 8 11Z"/>`,
        `<path fill="#fff9e9" stroke="none" d="M12 6L19 6L20 8L12 8Z"/>`,
        `<path fill="none" stroke-width="1.4" d="M5 8l-1 3M25 1v3"/>`,
        `<path fill="${creamShade}" stroke="none" d="M1 0h1.6v1.6H1Zm4-2h1.6v1.6H5Z"/>`,
      );
    if (part === "eyes")
      return shape(
        `<path fill="#fff9e9" stroke-width="1.7" d="M16-12L23-17L23-10Q21-5 17-7Z"/>`,
        `<path fill="${INK}" stroke="none" d="M20-14Q23-14 23-10Q23-6 20-7Q18-10 20-14Z"/>`,
        `<path fill="#fff9e9" stroke-width="2" d="M-8-18L10-11Q8-2 1-4Q-8-5-8-18Z"/>`,
        `<path fill="${INK}" stroke="none" d="M3-13Q8-13 7-8Q5-4 2-6Q0-9 3-13Z"/>`,
        `<ellipse fill="#fff9e9" stroke="none" cx="4.6" cy="-10" rx="1.3" ry="1.8"/>`,
        `<path fill="${INK}" stroke="none" d="M-10-24Q-1-22 11-14L10-10Q0-16-10-19Z M15-15L23-22L25-18L16-11Z"/><path fill="none" stroke-width="1.4" d="M10-23l3 4M15-24l-1 4"/>`,
        `<path fill="none" stroke="${shade}" stroke-width="1.2" d="M-7-1Q-2 1 2 0"/>`,
      );
    if (part === "tail") return "";
  }

  if (species === "llama") {
    if (part.startsWith("ear"))
      return shape(
        `<path fill="${limb}" d="${back ? "M-5 6Q-10-4-10-17Q-10-26-4-30Q2-30 2-23L1-16Q7-6 5 6Z" : "M-5 6Q-8-8-3-23Q0-31 6-31Q11-30 7-24L4-18Q8-4 5 7Z"}"/>`,
        `<path fill="${innerEar}" stroke="none" d="${back ? "M-2 1Q-7-10-6-21L-4-25L-3-15Q2-6 1 1Z" : "M-1 2Q-4-9 1-23L4-26L1-16Q4-7 2 2Z"}"/>`,
        `<path fill="none" stroke-width="1.3" d="M-2 3L1-3"/>`,
      );
    if (part === "body")
      return shape(
        `<path fill="${fur}" d="M-10-32L9-32L9-16L13-12L12-9Q21-7 20 1L18 4Q21 11 14 14L10 14Q7 19 1 16Q-6 20-11 15Q-19 15-19 8Q-24 1-18-5L-15-6Q-15-13-10-16Z"/>`,
        `<path fill="${shade}" stroke="none" d="M-9-27L-5-25L-5-9Q-14-4-14 5Q-11 13 0 14Q-7 18-11 12Q-18 13-16 6Q-20 2-15-3L-12-4Q-13-10-8-14Z"/>`,
        `<path fill="${cream}" stroke="none" d="M-4-28H5L5-12L9-8L7-4L12 0L9 4L10 8L4 13L0 10L-4 13L-8 8L-6 4L-9 0L-5-5Z"/>`,
        `<path fill="${creamShade}" stroke="none" d="M5-9L7-7L5-3L9 1L6 4L7 7L3 10L0 8L-3 9L-2 5L3 3Z"/>`,
        `<path fill="none" stroke="${shade}" stroke-width="1.4" d="M-8-22l3 2m-11 21 2-2 2 1m22 7-2 2"/>`,
      );
    if (part === "head")
      return shape(
        `<path fill="${fur}" d="M-19-14Q-21-22-14-25L-9-25L-6-30L-1-27L4-30L7-26L12-28L14-23Q23-20 20-10L26-7Q33-5 31 3Q29 11 19 11L7 8Q-1 13-8 8Q-17 9-20 3L-18-1L-22-6Z"/>`,
        `<path fill="${shade}" stroke="none" d="M-17-13Q-20-4-13 0L-14 3Q-8 8-2 5L4 7Q-3 11-8 6Q-15 8-18 2L-16-2L-19-6Z"/>`,
        `<path fill="${light}" stroke="none" d="M-14-21L-8-23L-5-26L-1-24L3-26L2-21L-4-20L-7-18Z"/>`,
        `<path fill="${cream}" stroke="none" d="M4-23Q17-24 17-15L14-8L21-5L19 4Q14 8 5 5L-2 0L1-7Z"/>`,
        `<path fill="${creamShade}" stroke-width="1.6" d="M15-7Q23-10 29-5Q34 0 28 7Q23 12 14 6Q9 2 15-7Z"/>`,
        `<path fill="${cream}" stroke="none" d="M16-5Q23-8 28-3Q24-4 20-2L15 1Q13-1 16-5Z"/>`,
        `<path fill="${INK}" stroke="none" d="M25-4Q29-4 29-1L26 1L23-1Z"/>`,
        `<path fill="none" stroke-width="1.7" d="M26 0v2M15 6Q21 1 27 5M15 5l-1 2"/>`,
        `<path fill="none" stroke="${shade}" stroke-width="1.3" d="M-13-7l3 1m-2 3 3 1"/>`,
      );
    if (part === "eyes")
      return shape(
        `<path fill="#fff9e9" stroke-width="1.6" d="M14-11L21-16L20-9Q18-5 15-7Z"/>`,
        `<path fill="${INK}" stroke="none" d="M17-13Q20-13 19-9Q18-6 16-9Z"/>`,
        `<path fill="#fff9e9" stroke-width="2" d="M-9-17L9-11L8-8Q5-2-2-5Q-8-7-9-17Z"/>`,
        `<path fill="${INK}" stroke="none" d="M3-15Q8-14 7-8Q5-4 2-6Q0-9 3-15Z"/>`,
        `<circle fill="#fff9e9" stroke="none" cx="4.8" cy="-11.5" r="1.1"/>`,
        `<path fill="${fur}" stroke="none" d="M-8-17L9-12L8-10L-8-14Z"/>`,
        `<path fill="none" stroke-width="2.2" d="M-9-16L9-10"/>`,
        `<path fill="${INK}" stroke="none" d="M-11-24L-6-23L10-16L9-12L-10-19Z M14-15L20-22L23-19L15-11Z"/><path fill="none" stroke-width="1.3" d="M8-24l4 3"/>`,
      );
    if (part === "tail")
      return shape(
        `<path fill="${fur}" d="M-12 7Q-23 6-28-2L-26-5L-29-9L-24-11L-20-8L-18-9Q-12-6-10 1Z"/>`,
        `<path fill="${shade}" stroke="none" d="M-24-5Q-20 1-13 2L-13 5Q-22 3-24-5Z"/>`,
        `<path fill="${light}" stroke="none" d="M-24-8L-21-6L-18-6L-16-3L-21-4Z"/>`,
      );
  }

  if (species === "zorro") {
    if (part.startsWith("ear"))
      return shape(
        `<path fill="${limb}" d="${back ? "M-7 6L-13-22Q-14-29-10-29L7-12L9 4Z" : "M-8 6L-6-25Q-5-32-1-29Q11-19 12-6L7 7Z"}"/>`,
        `<path fill="${paw}" stroke="none" d="${back ? "M-11-24L-10-26L1-15L-3-13Z" : "M-4-25L-2-27L5-19L0-18Z"}"/>`,
        `<path fill="${innerEar}" stroke="none" d="${back ? "M-4 1L-9-20L3-10L4 1Z" : "M-4 1L-3-22Q6-14 7-5L3 2Z"}"/>`,
        `<path fill="${cream}" stroke="none" d="M-5 4L-3-3L0 0L2-4L5 3Z"/>`,
      );
    if (part === "body")
      return shape(
        `<path fill="${fur}" d="M-12-17L-5-20L2-17L8-19L14-13L13-8Q21-2 17 7L12 15Q1 18-12 14L-17 7Q-20 1-16-7L-18-10Z"/>`,
        `<path fill="${shade}" stroke="none" d="M-15-5Q-16 7-8 10L6 14Q-3 17-11 12L-15 6Q-18 1-15-5Z"/>`,
        `<path fill="${cream}" stroke="none" d="M-8-13L-3-15L1-11L7-15L8-9L13-7L9-3L12 0L8 4L9 9L3 14L-3 11L-4 5L-9 1L-6-3L-11-7Z"/>`,
        `<path fill="${creamShade}" stroke="none" d="M8-6L5-2L8 1L4 5L6 9L2 11L-1 10L-2 4L-5 1L-1 3L4 0Z"/>`,
        `<path fill="none" stroke="${shade}" stroke-width="1.4" d="M-13 3l2 2m22 2-1 3"/>`,
      );
    if (part === "head")
      return shape(
        `<path fill="${fur}" d="M-21-17L-16-24L-7-27L-2-25L3-28L8-25Q20-24 21-12L27-7L34-4L32 3L25 8L10 12L-8 10L-22 5L-18 1L-27-3L-22-7L-27-13Z"/>`,
        `<path fill="${shade}" stroke="none" d="M13-22Q19-18 18-10L27-5L27 0L16 2L11-4L14-11Z"/>`,
        `<path fill="${light}" stroke="none" d="M-19-18L-14-22L-7-24L-10-19L-15-16Z"/>`,
        `<path fill="${cream}" stroke="none" d="M-23-4L-13-8L-5-2Q7 1 20-7L30-4L29 3Q20 11 8 10L-10 8L-19 4L-15 2Z"/>`,
        `<path fill="${creamShade}" stroke="none" d="M-14 3Q-3 8 8 7Q21 8 29 1Q25 8 10 10L-8 7Z"/>`,
        `<path fill="${INK}" stroke-width="1.2" d="M29-5L35-3Q36 0 31 2L28-1Z"/>`,
        `<path fill="none" stroke="${creamShade}" stroke-width="1.2" d="M30-4l2 .5"/>`,
        `<path fill="none" stroke-width="1.7" d="M30 2L28 5Q19 0 11 7M11 5l-2 3"/>`,
        `<path fill="${creamShade}" stroke="none" d="M-2 1l2 1-1 1-2-1Zm5 1h2v1.5H3Z"/>`,
      );
    if (part === "eyes")
      return shape(
        `<path fill="#fff9e9" stroke-width="1.6" d="M16-11L23-17L22-10L19-7Z"/>`,
        `<path fill="${INK}" stroke="none" d="M20-13L22-12L20-8L18-8Z"/>`,
        `<path fill="#fff9e9" stroke-width="2" d="M-9-14Q0-17 10-11Q7-2 0-5Q-7-6-9-14Z"/>`,
        `<path fill="${INK}" stroke="none" d="M4-14Q9-12 7-7Q4-3 1-7Q0-11 4-14Z"/>`,
        `<circle fill="#fff9e9" stroke="none" cx="5" cy="-10.5" r="1.1"/>`,
        `<path fill="${INK}" stroke="none" d="M-12-24L-3-21L12-14L10-10L0-15L-11-19Z"/>`,
        `<path fill="none" stroke-width="3.6" d="M16-14l8-7"/>`,
        `<path fill="none" stroke="${shade}" stroke-width="1.3" d="M-10-4l4 2"/>`,
      );
    if (part === "tail")
      return shape(
        `<path fill="${fur}" d="M-11 9Q-25 18-34 7Q-39 0-37-14Q-35-26-29-31L-29-21L-23-25L-24-15Q-12-12-9-2Z"/>`,
        `<path fill="${shade}" stroke="none" d="M-35-4Q-32 9-21 9Q-14 7-12 0L-13 8Q-25 16-32 6Z"/>`,
        `<path fill="${cream}" stroke="none" d="M-35-16Q-33-22-31-25L-31-17L-26-20L-28-10L-32-7L-29-2L-35-6Q-36-10-35-16Z"/>`,
        `<path fill="${creamShade}" stroke="none" d="M-34-17L-33-11L-30-9L-32-7L-31-5L-34-7Z"/>`,
        `<path fill="${light}" stroke="none" d="M-23-12Q-14-10-13-5L-18-8L-23-7Z"/>`,
      );
  }

  if (species === "ronsoco") {
    if (part.startsWith("ear"))
      return shape(
        `<path fill="${limb}" d="${back ? "M-6 5Q-11-1-8-7Q-6-12 1-10Q8-9 8-3L5 6Z" : "M-7 5L-8-3Q-9-10-2-11Q7-12 9-5Q10 1 6 6Z"}"/>`,
        `<path fill="${innerEar}" stroke="none" d="M-4 2Q-7-6-1-7Q6-8 5-2L3 2Z"/>`,
        `<path fill="none" stroke-width="1.3" d="M-3 2Q-4-3 1-3"/>`,
      );
    if (part === "body")
      return shape(
        `<path fill="${fur}" d="M-17-14Q-6-19 9-16Q22-14 24-3L24 7Q23 16 12 18L-10 18Q-22 17-24 7L-24-3Q-23-11-17-14Z"/>`,
        `<path fill="${shade}" stroke="none" d="M-21-4Q-22 9-13 12L11 15Q-1 18-12 15Q-23 14-21-4Z"/>`,
        `<path fill="${cream}" stroke="none" d="M0-11Q12-13 17-4Q21 4 16 11Q13 16 3 15Q-9 15-11 6Q-14-4 0-11Z"/>`,
        `<path fill="${creamShade}" stroke="none" d="M17 1Q18 12 7 12L-5 10Q0 16 9 14Q19 13 17 1Z"/>`,
        `<path fill="${light}" stroke="none" d="M-18-8L-12-11L-8-10L-12-7L-17-5Z"/>`,
        `<path fill="none" stroke="${shade}" stroke-width="1.5" d="M-17 1l1 3m3-2 1 3"/>`,
      );
    if (part === "head")
      return shape(
        `<path fill="${fur}" d="M-25-15Q-23-25-12-26L-5-26L-1-29L4-26L15-25Q25-23 30-13L33-6L34 4Q33 12 24 13L-5 13Q-22 12-26 4Q-29-5-25-15Z"/>`,
        `<path fill="${shade}" stroke="none" d="M-24-12Q-26 1-18 5Q-8 10 10 10L25 10Q20 13 5 11L-7 11Q-24 9-24 1Z"/>`,
        `<path fill="${light}" stroke="none" d="M-20-18Q-16-23-9-22L-5-21L-11-18L-17-15Z"/>`,
        `<path fill="${cream}" stroke="none" d="M8-8Q22-13 29-7L31-2L31 5Q29 11 20 10L6 10Q-5 9-6 2Q-7-5 8-8Z"/>`,
        `<path fill="${creamShade}" stroke="none" d="M-4 4Q8 10 26 7L29 3Q30 10 21 10H7Q-1 9-4 4Z"/>`,
        `<path fill="${shade}" stroke="none" d="M23-12Q29-11 31-6L27-5L22-7Z"/>`,
        `<path fill="${INK}" stroke="none" d="M26-8Q29-9 29-5L26-4Z M31-7L32-4L30-3L29-6Z"/>`,
        `<path fill="none" stroke-width="1.7" d="M9 8Q18 2 29 7M9 6L7 9"/>`,
        `<path fill="${creamShade}" stroke="none" d="M3 0h1.5v1.5H3Zm4-2h1.5v1.5H7Zm1 4h1.5v1.5H8Z"/>`,
        `<path fill="none" stroke="${shade}" stroke-width="1.3" d="M-18-4l3 1m-2 3 3 1"/>`,
      );
    if (part === "eyes")
      return shape(
        `<path fill="#fff9e9" stroke-width="1.6" d="M17-11L23-15L22-9L18-8Z"/>`,
        `<path fill="${INK}" stroke="none" d="M20-15L23-14L22-10L20-10Z"/>`,
        `<path fill="#fff9e9" stroke-width="2" d="M-9-15Q-1-17 8-14L7-7Q0-2-7-7Z"/>`,
        `<path fill="${INK}" stroke="none" d="M2-15L7-14L6-8Q3-5 1-8Z"/>`,
        `<circle fill="#fff9e9" stroke="none" cx="4.5" cy="-10.5" r="1"/>`,
        `<path fill="${fur}" stroke="none" d="M-9-17L8-12L7-9L-8-13Z"/>`,
        `<path fill="none" stroke-width="2.1" d="M-9-14L8-9M17-10l6-3"/>`,
        `<path fill="${INK}" stroke="none" d="M-11-23L-3-22L10-16L9-11L-2-16L-11-18Z M16-15L22-21L25-18L17-11Z"/><path fill="none" stroke-width="1.5" d="M9-25l3 4M16-25l-2 4"/>`,
        `<path fill="none" stroke="${shade}" stroke-width="1.3" d="M-7-3l5 1"/>`,
      );
    if (part === "tail") return "";
  }

  if (part.startsWith("arm")) {
    // Open shoulder/wrist seams disappear inside the torso and paw. Species
    // have distinct tapers, with a continuous contour rather than floating bars.
    const outline = {
      cuy: "M-3-5Q5-7 13-3L14 3Q7 6-3 5",
      llama: "M-3-4L0-6L3-4L7-5L14-2L14 3L9 4L6 3L3 5L0 4L-3 5",
      zorro: "M-3-4L2-5L5-3L13-2L14 2L5 4L1 6L-3 4",
      ronsoco: "M-3-6Q4-9 10-5L14-3L14 4Q8 8 1 7L-3 5",
    }[species];
    return shape(
      `<path fill="${limb}" stroke="none" d="${outline}Z"/>`,
      `<path fill="${back ? paw : shade}" stroke="none" d="M0 2L6 3L13 1L13 3Q6 6 0 4Z"/>`,
      `<path fill="none" stroke-width="2" d="${outline}"/>`,
    );
  }
  if (part.startsWith("hand")) {
    if (species === "llama")
      return shape(
        `<path fill="${limb}" d="M-4-4L0-5L4-4L8-5L11-2L10 5L4 6L0 4L-4 4"/>`,
        `<path fill="${paw}" stroke="none" d="M3-4L8-4L10-1L9 4L4 5L2 2Z"/>`,
        `<path fill="none" stroke="${creamShade}" stroke-width="1.4" d="M7-2L6 3"/>`,
      );
    if (species === "ronsoco")
      return shape(
        `<path fill="${limb}" d="M-4-5L0-5L1-7L6-7L10-4L12-1L11 6L6 8L-1 6L-4 4"/>`,
        `<path fill="${shade}" stroke="none" d="M0 3L6 4L10 1L10 5L6 7L0 5Z"/>`,
        `<path fill="none" stroke-width="1.3" d="M2-3L5-1L9-1M4 2l5 1M5 5l3 1"/>`,
      );
    if (species === "zorro")
      return shape(
        `<path fill="${paw}" d="M-4-3L-1-4L1-7L4-6L5-3L9-4L12-1L10 2L11 4L7 6L1 4L-4 3"/>`,
        `<path fill="#a78068" stroke="none" d="M-2-2L1-3L3-5L3 0L1 2L-2 1Z"/>`,
        `<path fill="none" stroke="${creamShade}" stroke-width="1.2" d="M6-1l3 1M5 2l3 1"/>`,
      );
    return shape(
      `<path fill="${limb}" d="M-4-3Q-1-5 1-4Q1-7 4-6L6-3Q10-3 10 1Q10 6 5 6Q1 7-1 4L-4 3"/>`,
      `<path fill="${back ? paw : shade}" stroke="none" d="M-1 2Q5 4 9 0Q10 5 5 5L1 5Z"/>`,
      `<path fill="none" stroke-width="1.2" d="M2-2l3 2M4 2l3 1"/>`,
    );
  }
  if (part.startsWith("leg"))
    return shape(
      `<path fill="${limb}" d="${species === "ronsoco" ? "M-6-5Q0-8 6-4L5 8Q0 11-5 8Z" : species === "llama" ? "M-5-5L0-7L5-4L4 0L5 3L3 9H-4L-5 3L-4 0Z" : "M-5-5Q1-8 6-3L4 8Q0 11-5 7Z"}"/>`,
      `<path fill="${back ? paw : shade}" stroke="none" d="M1-3L4-1L3 7L0 8L-2 6L1 5Z"/>`,
    );
  if (part.startsWith("foot")) {
    if (species === "llama")
      return shape(
        `<path fill="${paw}" d="M-5-2L-1-4L4-3L6-1Q10-1 11 3L10 6H-5Q-8 4-5-2Z"/>`,
        `<path fill="#a78068" stroke="none" d="M-4-1L0-2L4-1L5 2H-5Z"/>`,
        `<path fill="${INK}" stroke="none" d="M-5 4H10L9 5H-4Z"/>`,
        `<path fill="none" stroke-width="1.5" d="M5 1L4 5"/>`,
      );
    const broad = species === "ronsoco";
    return shape(
      `<path fill="${species === "zorro" ? paw : limb}" d="${broad ? "M-6-1Q-5-5 1-4L6-2Q12-3 13 2Q15 6 8 6H-5Q-9 5-6-1Z" : "M-5-1Q-5-5 1-4L5-2Q10-3 12 2Q14 6 7 6H-5Q-8 4-5-1Z"}"/>`,
      `<path fill="${species === "zorro" ? "#a78068" : back ? fur : light}" stroke="none" d="M-4-1L0-2L4 0L9 0L10 2H4L0 1L-4 2Z"/>`,
      `<path fill="${species === "zorro" ? INK : shade}" stroke="none" d="M-5 3Q3 5 11 3L10 5H-4Z"/>`,
      `<path fill="none" stroke="${species === "zorro" ? creamShade : INK}" stroke-width="1.3" d="M4 2l-.5 3M8 2l-.5 3"/>`,
    );
  }
  return "";
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
