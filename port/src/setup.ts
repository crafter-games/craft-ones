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
type Row =
  | "map"
  | "one-species"
  | "one-coat"
  | "two-species"
  | "two-coat"
  | "start";
type Seat = "one" | "two";
// Plain arrays, not tuples: scriptc (native and iOS) lowers neither tuple loops nor tuple indexing.
const ROWS: Row[] = [
  "map",
  "one-species",
  "one-coat",
  "two-species",
  "two-coat",
  "start",
];
const SEATS: Seat[] = ["one", "two"];

export interface Setup {
  row: number;
  options: MatchOptions;
  // Whether a PLAY ONLINE button is offered (web only: native builds have no WebSocket).
  online: boolean;
}

export type SetupKey = "up" | "down" | "left" | "right" | "confirm";

export function createSetup(
  options: MatchOptions = DEFAULT_OPTIONS,
  online = false,
): Setup {
  return { row: ROWS.length - 1, options: structuredClone(options), online };
}

// Layout shared by drawing and pointer hit tests.
const PREVIEW = { w: 520, y: 130 };
const previewHeight = (): number => (PREVIEW.w * WORLD_HEIGHT) / WORLD_WIDTH;
const seatX = (W: number, seat: "one" | "two"): number =>
  seat === "one" ? W * 0.17 : W * 0.83;
function buttons(
  setup: Setup,
  W: number,
  H: number,
): { id: "start" | "online"; x: number; y: number; w: number; h: number }[] {
  const y = H - 130;
  return setup.online
    ? [
        { id: "start", x: W / 2 - 240, y, w: 220, h: 52 },
        { id: "online", x: W / 2 + 20, y, w: 220, h: 52 },
      ]
    : [{ id: "start", x: W / 2 - 110, y, w: 220, h: 52 }];
}
// Each row's arrows as tap targets: the left and right halves of a band around its label.
function rowBands(W: number): { row: Row; x: number; y: number; w: number }[] {
  const mapY = PREVIEW.y + previewHeight() + 28;
  const bands: {
    row: Row;
    x: number;
    y: number;
    w: number;
  }[] = [{ row: "map", x: W / 2, y: mapY, w: 460 }];
  for (const seat of SEATS) {
    bands.push({ row: `${seat}-species`, x: seatX(W, seat), y: 390, w: 300 });
    bands.push({ row: `${seat}-coat`, x: seatX(W, seat), y: 444, w: 260 });
  }
  return bands;
}

export type SetupChoice = { mode: "local" | "online"; options: MatchOptions };

// A tap or click at (x, y) in logical pixels: arrows change a row, the buttons start.
export function tap(
  setup: Setup,
  x: number,
  y: number,
  W: number,
  H: number,
): SetupChoice | null {
  for (const b of buttons(setup, W, H))
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)
      return {
        mode: b.id === "online" ? "online" : "local",
        options: structuredClone(setup.options),
      };
  for (const band of rowBands(W)) {
    if (Math.abs(y - band.y) > 24 || Math.abs(x - band.x) > band.w / 2)
      continue;
    setup.row = ROWS.indexOf(band.row);
    press(setup, x < band.x ? "left" : "right");
    return null;
  }
  // Tapping a seat's critter cycles it too.
  for (const seat of SEATS)
    if (Math.abs(x - seatX(W, seat)) < 90 && Math.abs(y - 270) < 90) {
      setup.row = ROWS.indexOf(`${seat}-species`);
      press(setup, "right");
    }
  return null;
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
  const pw = PREVIEW.w;
  const ph = previewHeight();
  const px = W / 2 - pw / 2;
  const py = PREVIEW.y;
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
  const seats = [
    { title: "PLAYER 1", seat: "one" as Seat, color: "#f5c367" },
    { title: "PLAYER 2", seat: "two" as Seat, color: "#6ad1b7" },
  ];
  for (const s of seats) {
    const { title, seat, color } = s;
    const x = seatX(W, seat);
    const pick = seat === "one" ? o.one : o.two;
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
  for (const b of buttons(setup, W, H)) {
    const lit = b.id === "start" ? start : false;
    d.setFillStyle(b.id === "online" ? "#6ad1b7" : lit ? "#ffdf82" : "#f5c367");
    d.fillRect(b.x, b.y, b.w, b.h);
    label(
      d,
      b.id === "online" ? "PLAY ONLINE" : "START DUEL",
      b.x + b.w / 2,
      b.y + b.h / 2,
      "22px Bangers",
      "#2b2330",
    );
  }
  label(
    d,
    "Tap the arrows to pick · Keyboard: Up / Down, Left / Right, Enter",
    W / 2,
    H - 50,
    "12px Archivo Black",
    "#a99aa6",
  );
}
