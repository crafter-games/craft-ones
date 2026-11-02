// Visuals for the slot 7 powers: the name callout, per-power effects, the shield bubble and the hotbar glyphs.
// Everything here only reads: flashes are queued by updateEffects (effects.ts) when the sim raises an ability event,
// and drawing derives its look from the flash age, so a snapped frame always looks the same.
import type { Draw2D } from "dotframe/src/draw2d";
import {
  ABILITY_STRIKES,
  ARENA,
  type PlayerView,
  type Species,
} from "../../packages/shared/src";
import { FLASH_FRAMES, type Flash } from "./effects";

const TAU = Math.PI * 2;
const ease = (t: number): number => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3; // dotframe-allow-math

// Callout color and the palette of the muzzle ring, per ability event.
const LOOK: Record<string, { text: string; ring: string; edge: string }> = {
  papa: { text: "#ffe08a", ring: "#e0a85a", edge: "#6b4724" },
  rift: { text: "#e6c9ff", ring: "#a97bd0", edge: "#4a2d66" },
  meow: { text: "#c9f4e6", ring: "#8fd9c6", edge: "#2f6b61" },
  shuriken: { text: "#e8e8f6", ring: "#a6a9c6", edge: "#383a52" },
  shield: { text: "#bff3ea", ring: "#7fe0d0", edge: "#2d6b66" },
  heal: { text: "#b8f5c4", ring: "#7de39b", edge: "#2f6d45" },
  dash: { text: "#ffd6a0", ring: "#ff9d4d", edge: "#7a3a14" },
  bite: { text: "#ffd0b0", ring: "#ff7a4d", edge: "#7a2a14" },
  leap: { text: "#fff0b0", ring: "#f1d36b", edge: "#6b5a1f" },
  pounce: { text: "#ffd9a8", ring: "#e89a4a", edge: "#6b3a14" },
  stomp: { text: "#ffe9a8", ring: "#f1c56a", edge: "#6b4a14" },
  claw: { text: "#ffb8b0", ring: "#ff5d55", edge: "#6b1a1a" },
};
const FALLBACK = LOOK.leap;

function plus(d: Draw2D, x: number, y: number, size: number): void {
  d.setFillStyle("#2f6d45");
  d.fillRect(x - size - 2, y - size / 2 - 2, size * 2 + 4, size + 4);
  d.fillRect(x - size / 2 - 2, y - size - 2, size + 4, size * 2 + 4);
  d.setFillStyle("#b8f5c4");
  d.fillRect(x - size, y - size / 2, size * 2, size);
  d.fillRect(x - size / 2, y - size, size, size * 2);
}

function ring(
  d: Draw2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  width: number,
  alpha: number,
): void {
  d.setGlobalAlpha(Math.max(0, alpha));
  d.setStrokeStyle(color);
  d.setLineWidth(width);
  d.beginPath();
  d.ellipse(x, y, rx, ry, 0, 0, TAU, false);
  d.stroke();
  d.setGlobalAlpha(1);
}

function puffs(
  d: Draw2D,
  x: number,
  y: number,
  age: number,
  count: number,
  color: string,
  spread: number,
): void {
  const t = ease(age / 26);
  for (let n = 0; n < count; n++) {
    const side = n % 2 === 0 ? -1 : 1;
    const reach = (14 + (n >> 1) * 13) * t;
    d.setGlobalAlpha(0.8 * (1 - t));
    d.setFillStyle(color);
    d.beginPath();
    d.ellipse(
      x + side * reach * spread,
      y - 4 - (n % 3) * 5 * t,
      7 + (n >> 1) * 3 + 6 * t,
      5 + 4 * t,
      0,
      0,
      TAU,
      false,
    );
    d.fill();
  }
  d.setGlobalAlpha(1);
}

function teeth(
  d: Draw2D,
  cx: number,
  cy: number,
  gap: number,
  down: number,
): void {
  for (let i = -1; i <= 1; i++) {
    const bx = cx + i * 17;
    const base = cy + down * (gap + 15);
    const tip = cy + down * gap;
    d.setFillStyle("#fff8e8");
    d.setStrokeStyle("#3b2a2a");
    d.setLineWidth(3);
    d.beginPath();
    d.moveTo(bx - 8, base);
    d.lineTo(bx + 8, base);
    d.lineTo(bx, tip);
    d.closePath();
    d.fill();
    d.stroke();
  }
}

// A bubble the whole turn long: the blast shield is the one power that stays on the field.
export function drawShield(d: Draw2D, p: PlayerView, frame: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(frame / 9); // dotframe-allow-math
  const strength = Math.min(1, p.shield / 30);
  d.setGlobalAlpha(0.2 + 0.1 * pulse);
  d.setFillStyle("#7fe0d0");
  d.beginPath();
  d.ellipse(p.x, p.y - 15, 36, 47, 0, 0, TAU, false);
  d.fill();
  d.setGlobalAlpha(1);
  d.setStrokeStyle("#d4fff6");
  d.setLineWidth(3 + strength * 2);
  d.beginPath();
  d.ellipse(p.x, p.y - 15, 36, 47, 0, 0, TAU, false);
  d.stroke();
  d.setStrokeStyle("#ffffff");
  d.setLineWidth(3);
  d.beginPath();
  d.arc(p.x, p.y - 15, 29, Math.PI * 1.1, Math.PI * 1.45, false);
  d.stroke();
}

function callout(
  d: Draw2D,
  f: Flash,
  age: number,
  x: number,
  y: number,
  zoom: number,
): void {
  const look = LOOK[f.kind] ?? FALLBACK;
  const k = age / FLASH_FRAMES;
  const rise = ease(age / 30);
  const pop = 1 + 0.35 * (1 - ease(age / 8));
  d.setGlobalAlpha(k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35);
  d.save();
  // The name keeps its screen size at any camera zoom.
  d.translate(x, y - 24 * rise);
  d.scale(pop / zoom, pop / zoom);
  d.setFont("32px Bangers");
  d.setTextAlign("center");
  d.setTextBaseline("middle");
  d.setStrokeStyle("#2b2330");
  d.setLineWidth(9);
  d.strokeText(f.label, 0, 0);
  d.setStrokeStyle(look.edge);
  d.setLineWidth(5);
  d.strokeText(f.label, 0, 0);
  d.setFillStyle(look.text);
  d.fillText(f.label, 0, 0);
  d.restore();
  d.setGlobalAlpha(1);
}

// One ability event: its effect on the field, then the name callout over whoever used it.
export function drawFlash(
  d: Draw2D,
  f: Flash,
  frame: number,
  players: PlayerView[],
  zoom: number,
): void {
  const age = frame - f.frame;
  if (age < 0 || age >= FLASH_FRAMES) return;
  const actor = players[f.seat];
  if (!actor) return;
  const foe = players[1 - f.seat];
  const look = LOOK[f.kind] ?? FALLBACK;
  const feet = f.y + ARENA.playerRadius;
  const t = ease(age / 24);
  switch (f.kind) {
    case "papa":
    case "rift":
    case "meow":
    case "shuriken":
      ring(
        d,
        actor.x,
        actor.y - 20,
        14 + 54 * t,
        14 + 54 * t,
        look.ring,
        7 * (1 - t) + 2,
        1 - t,
      );
      ring(
        d,
        actor.x,
        actor.y - 20,
        8 + 30 * t,
        8 + 30 * t,
        "#ffffff",
        3,
        0.9 * (1 - t),
      );
      break;
    case "shield":
      ring(
        d,
        actor.x,
        actor.y - 15,
        30 + 60 * t,
        40 + 70 * t,
        look.ring,
        8 * (1 - t) + 2,
        1 - t,
      );
      ring(
        d,
        actor.x,
        actor.y - 15,
        20 + 40 * t,
        28 + 50 * t,
        "#ffffff",
        3,
        0.8 * (1 - t),
      );
      break;
    case "heal": {
      ring(
        d,
        actor.x,
        actor.y - 15,
        26 + 26 * t,
        36 + 30 * t,
        look.ring,
        5 * (1 - t) + 1,
        1 - t,
      );
      for (let n = 0; n < 7; n++) {
        const start = n * 3;
        if (age < start) continue;
        const k = ease((age - start) / 40);
        d.setGlobalAlpha(1 - k);
        plus(
          d,
          actor.x + (n - 3) * 15,
          actor.y - 14 - 82 * k - (n % 2) * 12,
          5 + (n % 3),
        );
      }
      d.setGlobalAlpha(1);
      break;
    }
    case "dash":
    case "bite": {
      const from = f.x;
      const to = f.x1;
      const fade = 1 - ease(age / 36);
      for (let n = 0; n < 5; n++) {
        const y = f.y - 34 + n * 11;
        d.setGlobalAlpha(0.85 * fade);
        d.setStrokeStyle(n % 2 === 0 ? "#fff3d6" : look.ring);
        d.setLineWidth(5 - (n % 2) * 2);
        d.beginPath();
        d.moveTo(from + (to - from) * (0.1 + 0.08 * n), y);
        d.lineTo(to - (to - from) * 0.04 * n, y);
        d.stroke();
      }
      for (let n = 1; n <= 4; n++) {
        d.setGlobalAlpha(0.28 * fade * (1 - n / 5));
        d.setFillStyle(look.ring);
        d.beginPath();
        d.ellipse(
          to - (to - from) * (n / 5),
          f.y - 16,
          22,
          30,
          0,
          0,
          TAU,
          false,
        );
        d.fill();
      }
      d.setGlobalAlpha(1);
      puffs(d, from, feet, age, 4, "#e8d9b8", 1);
      if (f.kind === "bite" && foe) {
        const gap = 34 * (1 - ease((age - 4) / 8)) + 3;
        const open = age < 4 ? 40 : gap;
        d.setGlobalAlpha(age < 26 ? 1 : 1 - (age - 26) / 12);
        teeth(d, foe.x, foe.y - 22, open, -1);
        teeth(d, foe.x, foe.y - 22, open, 1);
        d.setGlobalAlpha(1);
        if (age >= 10)
          ring(
            d,
            foe.x,
            foe.y - 22,
            10 + 40 * ease((age - 10) / 16),
            10 + 40 * ease((age - 10) / 16),
            "#fff3d6",
            4,
            1 - ease((age - 10) / 16),
          );
      }
      break;
    }
    case "leap":
      puffs(d, f.x, feet, age, 6, "#e8d9b8", 1.2);
      for (let n = 0; n < 3; n++) {
        const k = ease((age - n * 3) / 30);
        if (age < n * 3) continue;
        d.setGlobalAlpha(1 - k);
        d.setStrokeStyle(look.ring);
        d.setLineWidth(5);
        d.beginPath();
        d.moveTo(f.x - 16, f.y - 20 - 60 * k - n * 14 + 8);
        d.lineTo(f.x, f.y - 20 - 60 * k - n * 14 - 4);
        d.lineTo(f.x + 16, f.y - 20 - 60 * k - n * 14 + 8);
        d.stroke();
      }
      d.setGlobalAlpha(1);
      break;
    case "pounce": {
      puffs(d, f.x, feet, age, 4, "#d9c49a", 1.4);
      const fade = 1 - ease(age / 30);
      for (let n = 0; n < 3; n++) {
        d.setGlobalAlpha(0.9 * fade);
        d.setStrokeStyle(n === 1 ? "#fff3d6" : look.ring);
        d.setLineWidth(4);
        d.beginPath();
        d.moveTo(f.x - f.dir * (8 + 60 * ease(age / 12)), f.y - 38 + n * 14);
        d.lineTo(f.x - f.dir * 4, f.y - 38 + n * 14);
        d.stroke();
      }
      d.setGlobalAlpha(1);
      break;
    }
    case "stomp": {
      const reach = 150 * ease(age / 16);
      ring(
        d,
        f.x,
        feet,
        reach,
        reach * 0.22,
        look.ring,
        8 * (1 - t) + 2,
        1 - ease(age / 30),
      );
      ring(
        d,
        f.x,
        feet,
        reach * 0.7,
        reach * 0.15,
        "#ffffff",
        3,
        0.9 * (1 - ease(age / 24)),
      );
      puffs(d, f.x, feet, age, 8, "#dccba2", 3);
      for (let n = 0; n < 8; n++) {
        const k = ease(age / 28);
        const dx = (n - 3.5) * 16 * (0.6 + k);
        const dy = -(30 + (n % 3) * 20) * Math.sin(k * Math.PI); // dotframe-allow-math
        d.setGlobalAlpha(1 - k);
        d.setFillStyle(n % 2 === 0 ? "#8b6240" : "#b58a5c");
        d.fillRect(f.x + dx, feet + dy - 6, 7, 7);
      }
      d.setGlobalAlpha(1);
      break;
    }
    case "claw": {
      const grow = Math.min(1, age / 7);
      const fade = age < 30 ? 1 : 1 - (age - 30) / 20;
      for (let n = 0; n < 3; n++) {
        const ox = f.x1 - 24 + n * 18;
        const oy = f.y1 - 46;
        const ex = ox + 30 * grow;
        const ey = oy + 70 * grow;
        d.setGlobalAlpha(Math.max(0, fade));
        d.setStrokeStyle("#3b1414");
        d.setLineWidth(10);
        d.beginPath();
        d.moveTo(ox, oy);
        d.lineTo(ex, ey);
        d.stroke();
        d.setStrokeStyle(look.ring);
        d.setLineWidth(6);
        d.beginPath();
        d.moveTo(ox, oy);
        d.lineTo(ex, ey);
        d.stroke();
        d.setStrokeStyle("#fff3d6");
        d.setLineWidth(2);
        d.beginPath();
        d.moveTo(ox, oy);
        d.lineTo(ex, ey);
        d.stroke();
      }
      d.setGlobalAlpha(1);
      ring(d, f.x1, f.y1 - 14, 10 + 44 * t, 10 + 44 * t, "#fff3d6", 4, 1 - t);
      break;
    }
    default:
      break;
  }
  callout(
    d,
    f,
    age,
    actor.x,
    actor.y - (actor.species === "cuy" ? 96 : 122),
    zoom,
  );
}

// Hotbar glyphs, one per power, drawn with shapes so no extra textures are loaded.
export function drawAbilityIcon(
  d: Draw2D,
  species: Species,
  cx: number,
  cy: number,
  s: number,
): void {
  const u = s / 40;
  const line = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    w: number,
    c: string,
  ): void => {
    d.setStrokeStyle(c);
    d.setLineWidth(w * u);
    d.beginPath();
    d.moveTo(cx + x0 * u, cy + y0 * u);
    d.lineTo(cx + x1 * u, cy + y1 * u);
    d.stroke();
  };
  const blob = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    fill: string,
    edge: string,
  ): void => {
    d.setFillStyle(fill);
    d.setStrokeStyle(edge);
    d.setLineWidth(2.5 * u);
    d.beginPath();
    d.ellipse(cx + x * u, cy + y * u, rx * u, ry * u, 0, 0, TAU, false);
    d.fill();
    d.stroke();
  };
  const poly = (pts: number[][], fill: string, edge: string): void => {
    d.setFillStyle(fill);
    d.setStrokeStyle(edge);
    d.setLineWidth(2.5 * u);
    d.beginPath();
    d.moveTo(cx + pts[0][0] * u, cy + pts[0][1] * u);
    for (let i = 1; i < pts.length; i++)
      d.lineTo(cx + pts[i][0] * u, cy + pts[i][1] * u);
    d.closePath();
    d.fill();
    d.stroke();
  };
  switch (species) {
    case "cuy":
      blob(-9, 6, 9, 7, "#d8a85c", "#4a3320");
      blob(2, -2, 10, 8, "#d8a85c", "#4a3320");
      blob(12, -10, 8, 6.5, "#d8a85c", "#4a3320");
      d.setFillStyle("#6b4724");
      for (const [x, y] of [
        [-11, 7],
        [4, -1],
        [13, -9],
      ]) {
        d.beginPath();
        d.ellipse(cx + x * u, cy + y * u, 1.6 * u, 1.2 * u, 0, 0, TAU, false);
        d.fill();
      }
      break;
    case "llama":
      line(0, 12, 0, -12, 6, "#2b2330");
      line(-11, -2, 0, -14, 6, "#2b2330");
      line(11, -2, 0, -14, 6, "#2b2330");
      line(0, 12, 0, -12, 3.5, "#fff0b0");
      line(-11, -2, 0, -14, 3.5, "#fff0b0");
      line(11, -2, 0, -14, 3.5, "#fff0b0");
      line(-16, 16, 16, 16, 3, "#c9a15a");
      break;
    case "zorro":
      line(-16, -8, 2, -8, 4, "#ffb066");
      line(-18, 0, 6, 0, 4, "#ffd9a8");
      line(-16, 8, 2, 8, 4, "#ffb066");
      poly(
        [
          [4, -13],
          [18, 0],
          [4, 13],
        ],
        "#fff3d6",
        "#2b2330",
      );
      break;
    case "ronsoco":
      poly(
        [
          [-13, -12],
          [13, -12],
          [13, 2],
          [0, 15],
          [-13, 2],
        ],
        "#7fe0d0",
        "#2b2330",
      );
      line(-7, -6, -7, 3, 3, "#ffffff");
      line(0, -12, 0, 11, 2, "#2d6b66");
      break;
    case "puma":
      for (const x of [-9, 0, 9]) {
        line(x - 4, -14, x + 5, 13, 6.5, "#2b2330");
        line(x - 4, -14, x + 5, 13, 3.5, "#ff7a4d");
      }
      break;
    case "alpaca":
      poly(
        [
          [-4, -14],
          [4, -14],
          [4, -4],
          [14, -4],
          [14, 4],
          [4, 4],
          [4, 14],
          [-4, 14],
          [-4, 4],
          [-14, 4],
          [-14, -4],
          [-4, -4],
        ],
        "#9be7a8",
        "#2f6d45",
      );
      break;
    case "freddy":
      blob(0, 0, 15, 14, "#876da0", "#2b2330");
      blob(0, 0, 9, 8, "#38364d", "#cfb9ec");
      line(-18, 2, -22, 0, 3, "#b0d5a1");
      line(16, -12, 21, -16, 3, "#b0d5a1");
      break;
    case "michi":
      for (let n = 0; n < 3; n++) {
        d.setStrokeStyle(n === 0 ? "#ffffff" : "#8fd9c6");
        d.setLineWidth(3.5 * u);
        d.beginPath();
        d.arc(cx - 12 * u, cy, (8 + n * 8) * u, -0.9, 0.9, false);
        d.stroke();
      }
      blob(-13, 0, 4, 4, "#f9f4de", "#2b2330");
      break;
    case "railly":
      poly(
        [
          [0, -15],
          [14, 11],
          [-14, 11],
        ],
        "#f4eedf",
        "#2b2330",
      );
      poly(
        [
          [0, -6],
          [6, 6],
          [-6, 6],
        ],
        "#34333e",
        "#34333e",
      );
      break;
  }
}

// Leap launch speeds and the flat-ground gravity they imply (Battle.ability, worldMotion); the preview is an estimate on
// level ground, the sim decides the real landing.
const LEAPS: Record<string, { vx: number; vy: number }> = {
  llama: { vx: 360, vy: -480 },
  puma: { vx: 470, vy: -360 },
};
const LEAP_GRAVITY = 418;

// Where the armed movement power will carry the critter, and the zone it can hit on arrival.
export function drawMovePreview(d: Draw2D, p: PlayerView, dir: number): void {
  const feet = p.y + ARENA.playerRadius;
  const leap = LEAPS[p.species];
  const reach = (kind: "bite" | "stomp" | "claw"): number =>
    ABILITY_STRIKES[kind].range;
  let ex = p.x;
  let strike: "bite" | "stomp" | "claw" = "bite";
  if (leap) {
    strike = p.species === "llama" ? "stomp" : "claw";
    const air = (2 * -leap.vy) / LEAP_GRAVITY;
    ex = p.x + dir * leap.vx * air;
    d.setFillStyle("#292733");
    for (let n = 1; n < 14; n++) {
      const t = (air * n) / 14;
      const x = p.x + dir * leap.vx * t;
      const y = p.y + leap.vy * t + 0.5 * LEAP_GRAVITY * t * t;
      d.beginPath();
      d.arc(x, y, n % 2 === 0 ? 6 : 4.5, 0, TAU, false);
      d.fill();
    }
  } else {
    ex = p.x + dir * 320;
    const y = feet - 14;
    for (const stroke of [
      { color: "rgba(41,39,51,0.92)", width: 9 },
      { color: "#ffdf82", width: 5 },
    ]) {
      d.setStrokeStyle(stroke.color);
      d.setLineWidth(stroke.width);
      d.beginPath();
      d.moveTo(p.x + dir * 38, y);
      d.lineTo(ex, y);
      d.stroke();
    }
    d.setFillStyle("#ffdf82");
    d.beginPath();
    d.moveTo(ex + dir * 14, y);
    d.lineTo(ex - dir * 6, y - 13);
    d.lineTo(ex - dir * 6, y + 13);
    d.closePath();
    d.fill();
  }
  const r = reach(strike);
  ring(d, ex, feet, r, r * 0.22, "#ff7a4d", 4, 0.9);
  ring(d, ex, feet, 6, 3, "#ffdf82", 4, 1);
}
