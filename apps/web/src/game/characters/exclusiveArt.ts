import type { Species } from "@craft-ones/shared";
import type { Part } from "./design";

/** Hand-drawn guest adaptations; source references never enter the asset pipeline. */
export function exclusivePart(species: Species, part: Part): string | null {
  if (!["freddy", "michi", "railly"].includes(species)) return null;
  const back = part.endsWith("Back");
  const ink = "#49332f";
  const skin =
    species === "michi"
      ? "#fff8e9"
      : species === "freddy"
        ? "#dcc1a3"
        : "#ebc2a4";
  const shade =
    species === "michi"
      ? "#c9c9b8"
      : species === "freddy"
        ? "#ab8971"
        : "#c3937d";
  const shape = (s: string) =>
    `<g stroke="${ink}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${s}</g>`;
  if (part.startsWith("hand"))
    return shape(
      `<path fill="${back ? shade : skin}" d="M-6-3Q-6-7-2-6L1-8L5-6L6-2Q12-2 11 3Q10 8 4 7L-1 5Q-7 4-6-3Z"/><path d="M1-3L5-1M2 2L6 3" fill="none" stroke-width="1.4"/><path fill="${shade}" stroke="none" d="M-3 3Q4 6 9 2L8 5L4 6Z"/>`,
    );
  if (part.startsWith("leg"))
    return shape(
      `<path fill="${species === "railly" ? (back ? "#292b34" : "#41414a") : back ? shade : skin}" d="M-5-5Q0-7 5-4L4 9H-4Z"/><path d="M1-2L1 6" stroke="${species === "railly" ? "#6c6870" : shade}" stroke-width="2"/>`,
    );
  if (part.startsWith("foot"))
    return shape(
      `<path fill="${species === "freddy" ? (back ? "#9b4142" : "#c95e50") : species === "railly" ? "#36333c" : skin}" d="M-6-3L4-4L8-1Q16-2 16 4Q14 8 5 8H-8Q-11 3-6-3Z"/><path fill="${species === "michi" ? shade : "#e9d7bb"}" stroke="none" d="M-8 4Q4 7 15 3L14 6L5 7H-8Z"/><path d="M2-1L6 1M6-1L10 1" fill="none" stroke-width="1.3"/>`,
    );
  if (species === "freddy") {
    if (part.startsWith("ear") || part === "tail") return "";
    if (part === "body")
      return shape(
        `<path fill="${skin}" d="M-19-18Q-5-24 13-18Q27-8 25 8Q23 23 6 24L-12 21Q-26 17-25 3Z"/><path fill="${shade}" stroke="none" d="M-22-4Q-19 15-8 17L14 19Q5 26-13 19Q-25 14-22-4Z"/><path fill="#467c4c" d="M-22-13L-3-18L18-14L28-3L6 16L-28-6Z"/><path fill="#2d553c" stroke="none" d="M-24-5L5 12L25-3L6 15Z"/><path fill="#81a05d" stroke="none" d="M-18-11L-6-14L2-11L-2-6Z"/>`,
      );
    if (part === "head")
      return shape(
        `<path fill="${skin}" d="M-22-23Q-20-32-3-32Q17-31 22-20L23-2Q26 9 13 15Q1 20-13 13Q-25 9-24-4Z"/><path fill="${shade}" stroke="none" d="M-21-16L-16-15L-17 1Q-15 11 0 14L11 14Q0 19-12 11Q-23 8-22-4Z"/><path fill="#c55448" d="M-27-15Q-29-36-10-38L10-38Q27-37 29-23L29 6L20 9L17-23Q1-20-17-23L-17 6L-27 5Z"/><path fill="#8e3c39" stroke="none" d="M22-25L27-23L27 4L22 6Z M-26-15L-21-18L-21 3H-25Z"/><path fill="#e48063" stroke="none" d="M-21-29Q-11-36 9-34L19-31L-1-32Z"/><path fill="#ead3b6" stroke="none" d="M-4-1Q5-6 15 0L18 6Q11 15 0 10Q-7 7-4-1Z"/><path fill="${ink}" stroke="none" d="M4-3Q8-5 12-2L9 1L6 1Z"/><path d="M8 1L8 4Q3 7-1 3M8 4Q13 7 17 2" fill="none" stroke-width="1.7"/><path fill="${ink}" stroke-width="1.4" d="M2 6Q9 9 15 5Q12 13 7 12Z"/><path fill="#fff8de" stroke="none" d="M5 7L10 8L9 10L6 9Z"/>`,
      );
    if (part === "eyes")
      return shape(
        `<ellipse fill="${ink}" stroke="none" cx="-7" cy="-9" rx="2.3" ry="3.1"/><ellipse fill="${ink}" stroke="none" cx="13" cy="-10" rx="2.1" ry="2.9"/><path d="M-12-15Q-7-18-3-15M10-16Q14-19 17-16" fill="none" stroke-width="1.8"/>`,
      );
  }
  if (species === "michi") {
    if (part.startsWith("ear"))
      return shape(
        `<path fill="${back ? shade : skin}" d="M-8 6L-9-18Q-7-26-3-22L11-4L8 7Z"/><path fill="#dab2a2" stroke="none" d="M-4 1L-5-15L5-2Z"/>`,
      );
    if (part === "tail")
      return shape(
        `<path fill="${skin}" d="M-13 10Q-35 14-36-3Q-37-21-29-22Q-23-21-27-14Q-31 0-18 0L-10 2Z"/><path d="M-31-10Q-34 6-18 6" fill="none" stroke="${shade}" stroke-width="3"/>`,
      );
    if (part === "body")
      return shape(
        `<path fill="${skin}" d="M-11-24Q0-29 11-22L14-9Q22 0 16 16L6 21L-10 17Q-20 9-15-4Z"/><path fill="${shade}" stroke="none" d="M-12-16L-8-17L-10-3Q-16 10-4 15L9 17L4 20L-10 15Q-19 8-13-5Z"/><path fill="#fffef6" stroke="none" d="M0-19Q10-20 10-10L8 9L2 12L-3 8Z"/>`,
      );
    if (part === "head")
      return shape(
        `<path fill="${skin}" d="M-21-22L-12-27L1-25L11-27L23-19L24-7L29-2L24 6L17 13L0 15L-16 11L-26 1L-24-11Z"/><path fill="${shade}" stroke="none" d="M-22-13L-18-9L-19 1L-10 7L6 11L19 9L15 12L0 13L-15 9L-23 1Z"/><path fill="#d78c64" d="M6-3Q12-8 17-3L13 3L9 3Z"/><path fill="#fffef6" stroke="none" d="M-10-4Q-3-8 5-3L9 3L15 3L20-1L22 5Q9 16-4 8Z"/><path fill="${ink}" d="M-3 5Q8 10 20 3L14 12L5 12Z"/><path fill="#fffef6" stroke="none" d="M1 7L7 8L6 12ZM15 6L18 5L14 10Z"/><path d="M-12 1L-24-1M-12 5L-24 7M22 1L29-2M23 5L30 6" fill="none" stroke-width="1.3"/>`,
      );
    if (part === "eyes")
      return shape(
        `<path fill="#fffef6" stroke-width="1.7" d="M-14-16L1-12L0-5Q-10-2-14-10ZM6-12L20-17L19-8Q13-3 8-6Z"/><ellipse fill="${ink}" stroke="none" cx="-4" cy="-10" rx="2.8" ry="4.5"/><ellipse fill="${ink}" stroke="none" cx="13" cy="-11" rx="2.7" ry="4"/><path d="M-15-21L2-15M6-16L19-22" stroke-width="3"/>`,
      );
  }
  if (species === "railly") {
    if (part === "tail") return "";
    if (part.startsWith("ear"))
      return shape(
        `<path fill="${back ? shade : skin}" d="M-5-7Q4-10 6-3L5 6L0 9L-5 4Z"/><path d="M-1-3Q4-4 1 3" fill="none" stroke-width="1.3"/>`,
      );
    if (part === "body")
      return shape(
        `<path fill="#34333d" d="M-10-24L8-24L15-18L23-10L18 1L14-1L15 18Q0 23-18 16L-17 0L-22 0L-25-10L-18-18Z"/><path fill="#1f252c" stroke="none" d="M-18-15L-12-13L-12 10L7 17L-16 16L-16-2L-21-2L-22-9Z"/><path fill="${skin}" d="M-7-25L7-25L7-19Q1-13-7-20Z"/><path fill="#696873" stroke="none" d="M4-6L10 5H-2Z"/><path fill="#45454f" stroke="none" d="M9-13L15-11L15-5L11-7Z"/>`,
      );
    if (part === "head")
      return shape(
        `<path fill="${skin}" d="M-20-25Q0-33 22-24L23-7L20 7L11 17L-3 17L-17 8L-22-6Z"/><path fill="${shade}" stroke="none" d="M-19-18L-13-15L-14 0L-4 12L10 14L6 16L-3 15L-16 6L-20-7Z"/><path fill="#24262b" d="M-22-5L-27-24L-23-24L-26-31L-19-29L-19-37L-11-34L-8-41L-3-36L4-42L9-36L17-40L18-34L26-34L23-27L27-23L23-7L18-14L17-23L10-20L5-25L-2-20L-8-23L-16-18L-16-7Z"/><path fill="#454347" stroke="none" d="M-19-28L-12-29L-9-35L-5-31L3-35L0-29L-9-26Z"/><path d="M8-10L12-2L7 0" fill="none" stroke-width="1.6"/><path fill="#503b35" stroke="none" d="M-3 5L4 2L8 4L12 3L16 6L10 6L6 5L1 7Z M-3 12L4 10L11 12L10 16L1 16Z"/><path d="M2 8L11 8" fill="none" stroke-width="1.6"/>`,
      );
    if (part === "eyes")
      return shape(
        `<path fill="#fff4db" stroke-width="1.4" d="M-13-13L0-11L-2-6L-10-7ZM7-11L19-14L17-8L9-6Z"/><path d="M-4-11V-7M13-12V-8" stroke-width="3.5"/><path fill="#29282d" stroke="none" d="M-15-20L-6-19L2-15L0-12L-7-16L-15-16Z M6-15L15-20L21-20L21-16L14-16L7-12Z"/>`,
      );
  }
  return "";
}
