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
import { avatarKey, plates } from "./identity";
import { DEFAULT_OPTIONS, type MatchOptions } from "./match";
import {
  art,
  avatar,
  fillRound,
  HUD,
  SEAT_COLORS,
  strokeRound,
} from "./render";

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
  // The same screen also picks the guest's critter and the rematch: which rows this player may change, and the text.
  editMap: boolean;
  editOne: boolean;
  editTwo: boolean;
  title: string;
  subtitle: string;
  startLabel: string;
  // Under each seat's heading ("YOU", "RIVAL").
  tags: string[];
  // Replaces the START button while a pick is sent and the peer has not answered.
  waiting: string;
  // This device's control scheme (controls.ts): "sling" or "aim". The chip under START switches it.
  controls: string;
}

export type SetupKey = "up" | "down" | "left" | "right" | "confirm";

export function createSetup(
  options: MatchOptions = DEFAULT_OPTIONS,
  online = false,
): Setup {
  return {
    row: ROWS.length - 1,
    options: structuredClone(options),
    online,
    editMap: true,
    editOne: true,
    editTwo: true,
    title: "CRAFT ONES",
    subtitle: "Seven critters, six tools and a power, fifteen-second turns.",
    startLabel: "START DUEL",
    tags: ["", ""],
    waiting: "",
    controls: "sling",
  };
}

const editable = (setup: Setup, row: Row): boolean =>
  row === "start" ||
  (row === "map"
    ? setup.editMap
    : row === "one-species" || row === "one-coat"
      ? setup.editOne
      : setup.editTwo);

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
  if (setup.waiting !== "") return [];
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

// The control scheme chip under the buttons.
const CHIP = { w: 340, h: 26 };
const chipY = (H: number): number => H - 70;
export const CONTROL_LABELS: Record<string, string> = {
  sling: "CONTROLS: SLINGSHOT",
  aim: "CONTROLS: MOUSE AIM + SHIFT",
};
const CONTROL_HINTS: Record<string, string> = {
  sling: "Press on the field, pull back and let go · the pull is the power",
  aim: "The mouse aims · hold Shift to charge, let go to fire",
};

export type SetupChoice = { mode: "local" | "online"; options: MatchOptions };

// A tap or click at (x, y) in logical pixels: arrows change a row, the buttons start.
export function tap(
  setup: Setup,
  x: number,
  y: number,
  W: number,
  H: number,
): SetupChoice | null {
  if (
    Math.abs(x - W / 2) <= CHIP.w / 2 &&
    y >= chipY(H) &&
    y <= chipY(H) + CHIP.h
  ) {
    setup.controls = setup.controls === "aim" ? "sling" : "aim";
    return null;
  }
  if (setup.waiting !== "") return null;
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
  // Tapping the map preview cycles the map, as tapping a critter cycles it.
  const ph = previewHeight();
  if (
    setup.editMap &&
    Math.abs(x - W / 2) <= PREVIEW.w / 2 &&
    y >= PREVIEW.y &&
    y <= PREVIEW.y + ph
  ) {
    setup.row = ROWS.indexOf("map");
    press(setup, "right");
    return null;
  }
  // Tapping a seat's critter cycles it too.
  for (const seat of SEATS)
    if (
      Math.abs(x - seatX(W, seat)) < 90 &&
      Math.abs(y - 270) < 90 &&
      editable(setup, `${seat}-species`)
    ) {
      setup.row = ROWS.indexOf(`${seat}-species`);
      press(setup, "right");
    }
  return null;
}

// Puts the cursor on the first row this player can change, so a confirm key does not land on START at once.
export function focusFirst(setup: Setup): void {
  setup.row = ROWS.length - 1;
  press(setup, "down");
}

const cycle = <T>(list: readonly T[], value: T, step: number): T =>
  list[(list.indexOf(value) + step + list.length) % list.length];

// Returns the options to start with when the player confirms on START.
export function press(setup: Setup, key: SetupKey): MatchOptions | null {
  if (setup.waiting !== "") return null;
  if (key === "up" || key === "down") {
    const move = key === "up" ? ROWS.length - 1 : 1;
    for (let n = 0; n < ROWS.length; n++) {
      setup.row = (setup.row + move) % ROWS.length;
      if (editable(setup, ROWS[setup.row])) break;
    }
  }
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
  if (!editable(setup, row)) return null;
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
  // Native builds load only portraits for setup (see the texture budget in render.ts).
  const face = art.textures.get(`${species}-${coat}-portrait`);
  if (face && !art.textures.has(`${species}-${coat}-body`)) {
    d.drawImage(
      face,
      0,
      0,
      face.width,
      face.height,
      -size * 0.45,
      -size * 0.45,
      size * 0.9,
      size * 0.9,
    );
    d.restore();
    return;
  }
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
  // The chosen map fills the screen, dimmed, behind glass cards.
  const backdrop = art.textures.get(`map-${o.map}`);
  d.setFillStyle(HUD.ink);
  d.fillRect(0, 0, W, H);
  if (backdrop) {
    const scale = Math.max(W / backdrop.width, H / backdrop.height);
    const bw = backdrop.width * scale;
    const bh = backdrop.height * scale;
    d.drawImage(
      backdrop,
      0,
      0,
      backdrop.width,
      backdrop.height,
      (W - bw) / 2,
      (H - bh) / 2,
      bw,
      bh,
    );
  }
  d.setFillStyle("rgba(10,6,20,0.62)");
  d.fillRect(0, 0, W, H);
  label(d, setup.title, W / 2, 54, "54px Bangers", HUD.cream);
  d.setFillStyle(HUD.gold);
  d.fillRect(W / 2 - 40, 78, 80, 3);
  label(
    d,
    setup.subtitle.toUpperCase(),
    W / 2,
    96,
    "11px Archivo Black",
    HUD.dim,
  );
  // Map preview.
  const pw = PREVIEW.w;
  const ph = previewHeight();
  const px = W / 2 - pw / 2;
  const py = PREVIEW.y;
  const preview = art.textures.get(`map-${o.map}`);
  fillRound(d, px - 10, py - 10, pw + 20, ph + 76, 12, HUD.glass);
  d.setFillStyle(map.palette.sky);
  d.fillRect(px, py, pw, ph);
  if (preview)
    d.drawImage(preview, 0, 0, preview.width, preview.height, px, py, pw, ph);
  strokeRound(d, px, py, pw, ph, 2, "rgba(255,255,255,0.18)", 2);
  const rowColor = (row: Row): string =>
    !editable(setup, row)
      ? HUD.dim
      : ROWS[setup.row] === row
        ? HUD.gold
        : HUD.cream;
  const arrows = (row: Row, text: string): string =>
    editable(setup, row) ? `<  ${text}  >` : text;
  label(
    d,
    arrows("map", map.name.toUpperCase()),
    W / 2,
    py + ph + 28,
    "18px Archivo Black",
    rowColor("map"),
  );
  label(d, map.subtitle, W / 2, py + ph + 52, "11px Archivo Black", HUD.dim);
  // Seats.
  const seats = [
    { title: "PLAYER 1", seat: "one" as Seat, color: SEAT_COLORS[0] },
    { title: "PLAYER 2", seat: "two" as Seat, color: SEAT_COLORS[1] },
  ];
  for (const s of seats) {
    const { title, seat, color } = s;
    const x = seatX(W, seat);
    const pick = seat === "one" ? o.one : o.two;
    fillRound(d, x - 150, 126, 300, 340, 12, HUD.glass);
    d.setFillStyle(color);
    d.fillRect(x - 130, 463, 260, 3);
    // Online, the seat's Discord name and avatar replace "PLAYER n" once they are known.
    const index = seat === "one" ? 0 : 1;
    const name = plates[index].name;
    const heading =
      name === "" ? title : name.length > 16 ? `${name.slice(0, 15)}…` : name;
    const face = name !== "" && art.textures.has(avatarKey(index));
    if (face) avatar(d, index, x - 138, 132, 36, color);
    label(
      d,
      setup.tags[index] === "" ? heading : `${heading} · ${setup.tags[index]}`,
      face ? x + 14 : x,
      150,
      "14px Archivo Black",
      color,
    );
    critter(d, pick.species, pick.coat, x, 270, 170, seat === "two");
    label(
      d,
      arrows(`${seat}-species`, CHARACTERS[pick.species].name.toUpperCase()),
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
      HUD.dim,
    );
    label(
      d,
      arrows(`${seat}-coat`, COATS[pick.coat].name.toUpperCase()),
      x,
      444,
      "14px Archivo Black",
      rowColor(`${seat}-coat`),
    );
  }
  const start = ROWS[setup.row] === "start";
  for (const b of buttons(setup, W, H)) {
    const lit = b.id === "start" ? start : false;
    const color = b.id === "online" ? SEAT_COLORS[1] : SEAT_COLORS[0];
    fillRound(d, b.x, b.y, b.w, b.h, 10, lit ? color : HUD.glassHot);
    strokeRound(d, b.x, b.y, b.w, b.h, 10, color, 2);
    label(
      d,
      b.id === "online" ? "PLAY ONLINE" : setup.startLabel,
      b.x + b.w / 2,
      b.y + b.h / 2,
      "22px Bangers",
      lit ? HUD.ink : color,
    );
  }
  if (setup.waiting !== "")
    label(d, setup.waiting, W / 2, H - 104, "20px Bangers", HUD.gold);
  const cy = chipY(H);
  const scheme = setup.controls === "aim" ? "aim" : "sling";
  fillRound(
    d,
    W / 2 - CHIP.w / 2,
    cy,
    CHIP.w,
    CHIP.h,
    CHIP.h / 2,
    HUD.glassHot,
  );
  strokeRound(
    d,
    W / 2 - CHIP.w / 2,
    cy,
    CHIP.w,
    CHIP.h,
    CHIP.h / 2,
    "rgba(255,255,255,0.22)",
    1,
  );
  label(
    d,
    `<  ${CONTROL_LABELS[scheme]}  >`,
    W / 2,
    cy + CHIP.h / 2,
    "11px Archivo Black",
    HUD.cream,
  );
  label(d, CONTROL_HINTS[scheme], W / 2, H - 30, "11px Archivo Black", HUD.dim);
}
