// Pre-match setup on canvas: map, then each seat's critter and coat, like the web lobby's MatchSetup.
// Client-only state; the match itself starts from the chosen MatchOptions.
import type { Draw2D } from "dotframe/src/draw2d";
import {
  CHARACTERS,
  COATS,
  type CoatId,
  PLAYABLE_MAP_IDS,
  SELECTABLE_SPECIES,
  type Species,
  WORLD_HEIGHT,
  WORLD_MAPS,
  WORLD_WIDTH,
} from "../../packages/shared/src";
import { DEFAULT_OPTIONS, type MatchOptions } from "./match";
import { art } from "./render";

const COAT_IDS = Object.keys(COATS) as CoatId[];
const ROWS = [
  "map",
  "one-species",
  "one-coat",
  "two-species",
  "two-coat",
  "start",
] as const;

export interface Setup {
  row: number;
  options: MatchOptions;
}

export type SetupKey = "up" | "down" | "left" | "right" | "confirm";

export function createSetup(options: MatchOptions = DEFAULT_OPTIONS): Setup {
  return { row: ROWS.length - 1, options: structuredClone(options) };
}

const cycle = <T>(list: readonly T[], value: T, step: number): T =>
  list[(list.indexOf(value) + step + list.length) % list.length];

// Returns the options to start with when the player confirms on START.
export function press(setup: Setup, key: SetupKey): MatchOptions | null {
  if (key === "up") setup.row = (setup.row + ROWS.length - 1) % ROWS.length;
  if (key === "down") setup.row = (setup.row + 1) % ROWS.length;
  if (key === "confirm") {
    // Confirming on any other row jumps to START, so Enter twice always begins.
    if (ROWS[setup.row] === "start") return structuredClone(setup.options);
    setup.row = ROWS.length - 1;
    return null;
  }
  if (key !== "left" && key !== "right") return null;
  const step = key === "left" ? -1 : 1;
  const o = setup.options;
  const row = ROWS[setup.row];
  if (row === "map") o.map = cycle(PLAYABLE_MAP_IDS, o.map, step);
  if (row === "one-species")
    o.one.species = cycle(
      SELECTABLE_SPECIES as readonly Species[],
      o.one.species,
      step,
    );
  if (row === "one-coat") o.one.coat = cycle(COAT_IDS, o.one.coat, step);
  if (row === "two-species")
    o.two.species = cycle(
      SELECTABLE_SPECIES as readonly Species[],
      o.two.species,
      step,
    );
  if (row === "two-coat") o.two.coat = cycle(COAT_IDS, o.two.coat, step);
  return null;
}

function label(
  d: Draw2D,
  value: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align = "center",
): void {
  d.setFont(font);
  d.setTextAlign(align);
  d.setTextBaseline("middle");
  d.setFillStyle(color);
  d.fillText(value, x, y);
}

function critter(
  d: Draw2D,
  species: string,
  coat: string,
  x: number,
  y: number,
  size: number,
  flip: boolean,
): void {
  d.save();
  d.translate(x, y);
  d.scale(flip ? -1 : 1, 1);
  for (const part of [
    "tail",
    "legBack",
    "legFront",
    "handBack",
    "body",
    "handFront",
    "head",
    "eyes",
  ]) {
    const t = art.textures.get(`${species}-${coat}-${part}`);
    if (t)
      d.drawImage(
        t,
        0,
        0,
        t.width,
        t.height,
        -size * 0.4,
        -size * 0.5,
        size * 0.8,
        size,
      );
  }
  d.restore();
}

export function renderSetup(
  setup: Setup,
  d: Draw2D,
  W: number,
  H: number,
): void {
  const o = setup.options;
  const map = WORLD_MAPS[o.map];
  d.setFillStyle("#2b2330");
  d.fillRect(0, 0, W, H);
  label(d, "CRAFT ONES", W / 2, 54, "54px Bangers", "#ffdf82");
  label(
    d,
    "Six critters, six tools, fifteen-second turns.",
    W / 2,
    92,
    "13px Archivo Black",
    "#a99aa6",
  );
  // Map preview.
  const pw = 520;
  const ph = (pw * WORLD_HEIGHT) / WORLD_WIDTH;
  const px = W / 2 - pw / 2;
  const py = 130;
  const preview = art.textures.get(`map-${o.map}`);
  d.setFillStyle(map.palette.sky);
  d.fillRect(px, py, pw, ph);
  if (preview)
    d.drawImage(preview, 0, 0, preview.width, preview.height, px, py, pw, ph);
  const rowColor = (row: string): string =>
    ROWS[setup.row] === row ? "#ffdf82" : "#fff2d3";
  label(
    d,
    `<  ${map.name.toUpperCase()}  >`,
    W / 2,
    py + ph + 28,
    "18px Archivo Black",
    rowColor("map"),
  );
  label(d, map.subtitle, W / 2, py + ph + 52, "11px Archivo Black", "#a99aa6");
  // Seats.
  const seats: [string, "one" | "two", number, string][] = [
    ["PLAYER 1", "one", W * 0.17, "#f5c367"],
    ["PLAYER 2", "two", W * 0.83, "#6ad1b7"],
  ];
  for (const [title, seat, x, color] of seats) {
    const pick = o[seat];
    label(d, title, x, 150, "14px Archivo Black", color);
    critter(d, pick.species, pick.coat, x, 270, 170, seat === "two");
    label(
      d,
      `<  ${CHARACTERS[pick.species].name.toUpperCase()}  >`,
      x,
      390,
      "16px Archivo Black",
      rowColor(`${seat}-species`),
    );
    label(
      d,
      CHARACTERS[pick.species].role,
      x,
      412,
      "11px Archivo Black",
      "#a99aa6",
    );
    label(
      d,
      `<  ${COATS[pick.coat].name.toUpperCase()}  >`,
      x,
      444,
      "14px Archivo Black",
      rowColor(`${seat}-coat`),
    );
  }
  const start = ROWS[setup.row] === "start";
  d.setFillStyle(start ? "#ffdf82" : "#3a2f3c");
  d.fillRect(W / 2 - 110, H - 130, 220, 52);
  label(
    d,
    "START DUEL",
    W / 2,
    H - 104,
    "22px Bangers",
    start ? "#2b2330" : "#fff2d3",
  );
  label(
    d,
    "Up / Down pick a row · Left / Right change it · Enter starts",
    W / 2,
    H - 50,
    "12px Archivo Black",
    "#a99aa6",
  );
}
