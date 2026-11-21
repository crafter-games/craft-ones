import type { Draw2D } from "dotframe/src/draw2d";
import { type Input, Key } from "dotframe/src/input";
import type { Speakers } from "./audio";

export type PauseAction = "none" | "resume" | "menu";

export interface PauseMenu {
  open: boolean;
  row: number;
  poll: (
    W: number,
    H: number,
    speakers: Speakers | null,
    canMenu: boolean,
  ) => PauseAction;
  checkButton: (W: number, H: number) => boolean;
  render: (
    d: Draw2D,
    W: number,
    H: number,
    speakers: Speakers | null,
    mapName: string,
    canMenu: boolean,
  ) => void;
}

const STEP = 0.1;

function rect(
  x: number,
  y: number,
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } {
  return { x, y, w, h };
}

function inside(
  r: { x: number; y: number; w: number; h: number },
  px: number,
  py: number,
): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function pauseButton(W: number): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  return rect(W - 96, 76, 80, 32);
}

export function drawPauseButton(d: Draw2D, W: number): void {
  const b = pauseButton(W);
  d.setFillStyle("rgba(43, 35, 48, 0.86)");
  d.fillRect(b.x, b.y, b.w, b.h);
  d.setStrokeStyle("#5d4d68");
  d.setLineWidth(2);
  d.strokeRect(b.x, b.y, b.w, b.h);
  d.setFont("12px Archivo Black");
  d.setTextAlign("center");
  d.setTextBaseline("middle");
  d.setFillStyle("#fff2d3");
  d.fillText("II PAUSE", b.x + b.w / 2, b.y + b.h / 2 + 1);
}

function layout(W: number, H: number, canMenu: boolean) {
  const cardW = 460;
  const cardH = canMenu ? 330 : 272;
  const x = W / 2 - cardW / 2;
  const y = H / 2 - cardH / 2;
  const barX = x + 152;
  const barW = 200;
  const barH = 18;
  const musicY = y + 116;
  const sfxY = y + 166;
  const resumeBtn = rect(x + 90, y + 212, cardW - 180, 44);
  const menuBtn = rect(x + 90, y + 266, cardW - 180, 42);
  return {
    card: rect(x, y, cardW, cardH),
    musicBar: rect(barX, musicY - barH / 2, barW, barH),
    musicHit: rect(barX - 28, musicY - 20, barW + 56, 40),
    musicMinus: rect(barX - 34, musicY - 16, 26, 32),
    musicPlus: rect(barX + barW + 8, musicY - 16, 26, 32),
    sfxBar: rect(barX, sfxY - barH / 2, barW, barH),
    sfxHit: rect(barX - 28, sfxY - 20, barW + 56, 40),
    sfxMinus: rect(barX - 34, sfxY - 16, 26, 32),
    sfxPlus: rect(barX + barW + 8, sfxY - 16, 26, 32),
    musicY,
    sfxY,
    resumeBtn,
    menuBtn,
  };
}

function snapStep(v: number): number {
  return Math.round(Math.max(0, Math.min(1, v)) * 10) / 10;
}

export function createPauseMenu(input: Input): PauseMenu {
  const held = new Set<number>();
  let pointerWas = false;
  let dragging: "none" | "music" | "sfx" = "none";
  let lastSfxStep = -1;

  const tapped = (keys: number[]): boolean => {
    let down = false;
    let was = false;
    for (const k of keys) {
      if (held.has(k)) was = true;
      if (input.down(k)) {
        down = true;
        held.add(k);
      } else held.delete(k);
    }
    return down && !was;
  };

  const pointer = (
    W: number,
    H: number,
  ): { down: boolean; pressed: boolean; x: number; y: number } => {
    const fingers = input.touches();
    const p = input.pointer();
    const down = fingers.length > 0 || (p.buttons & 1) !== 0;
    const x = (fingers.length > 0 ? fingers[0].x : p.x) * W;
    const y = (fingers.length > 0 ? fingers[0].y : p.y) * H;
    const pressed = down && !pointerWas;
    pointerWas = down;
    return { down, pressed, x, y };
  };

  const menu: PauseMenu = {
    open: false,
    row: 0,
    checkButton: (W: number, H: number): boolean => {
      const esc = tapped([Key.Escape, Key.P]);
      const ptr = pointer(W, H);
      if (esc || (ptr.pressed && inside(pauseButton(W), ptr.x, ptr.y))) {
        menu.open = true;
        menu.row = 0;
        dragging = "none";
        return true;
      }
      return false;
    },
    poll: (
      W: number,
      H: number,
      speakers: Speakers | null,
      canMenu: boolean,
    ): PauseAction => {
      const rows = canMenu ? 4 : 3;
      if (tapped([Key.Escape, Key.P])) {
        menu.open = false;
        dragging = "none";
        return "resume";
      }
      if (tapped([Key.Up, Key.W])) menu.row = (menu.row + rows - 1) % rows;
      if (tapped([Key.Down, Key.S])) menu.row = (menu.row + 1) % rows;

      const left = tapped([Key.Left, Key.A]);
      const right = tapped([Key.Right, Key.D]);
      if ((left || right) && speakers) {
        const delta = right ? STEP : -STEP;
        if (menu.row === 0)
          speakers.setMusicVolume(snapStep(speakers.musicVolume() + delta));
        else if (menu.row === 1) {
          speakers.setSfxVolume(snapStep(speakers.sfxVolume() + delta));
          speakers.previewSfx();
        }
      }

      if (tapped([Key.Enter, Key.Space])) {
        if (menu.row === 2) {
          menu.open = false;
          dragging = "none";
          return "resume";
        }
        if (canMenu && menu.row === 3) {
          menu.open = false;
          dragging = "none";
          return "menu";
        }
      }

      const l = layout(W, H, canMenu);
      const ptr = pointer(W, H);
      if (!ptr.down) {
        dragging = "none";
        lastSfxStep = -1;
        return "none";
      }

      if (ptr.pressed) {
        if (inside(l.resumeBtn, ptr.x, ptr.y)) {
          menu.open = false;
          dragging = "none";
          return "resume";
        }
        if (canMenu && inside(l.menuBtn, ptr.x, ptr.y)) {
          menu.open = false;
          dragging = "none";
          return "menu";
        }
        if (speakers && inside(l.musicMinus, ptr.x, ptr.y)) {
          menu.row = 0;
          speakers.setMusicVolume(snapStep(speakers.musicVolume() - STEP));
          return "none";
        }
        if (speakers && inside(l.musicPlus, ptr.x, ptr.y)) {
          menu.row = 0;
          speakers.setMusicVolume(snapStep(speakers.musicVolume() + STEP));
          return "none";
        }
        if (speakers && inside(l.sfxMinus, ptr.x, ptr.y)) {
          menu.row = 1;
          speakers.setSfxVolume(snapStep(speakers.sfxVolume() - STEP));
          speakers.previewSfx();
          return "none";
        }
        if (speakers && inside(l.sfxPlus, ptr.x, ptr.y)) {
          menu.row = 1;
          speakers.setSfxVolume(snapStep(speakers.sfxVolume() + STEP));
          speakers.previewSfx();
          return "none";
        }
        if (inside(l.musicHit, ptr.x, ptr.y)) {
          menu.row = 0;
          dragging = "music";
        } else if (inside(l.sfxHit, ptr.x, ptr.y)) {
          menu.row = 1;
          dragging = "sfx";
        }
      }

      if (speakers && dragging === "music") {
        const ratio = (ptr.x - l.musicBar.x) / l.musicBar.w;
        speakers.setMusicVolume(snapStep(ratio));
      } else if (speakers && dragging === "sfx") {
        const ratio = (ptr.x - l.sfxBar.x) / l.sfxBar.w;
        const next = snapStep(ratio);
        const stepIdx = Math.round(next * 10);
        speakers.setSfxVolume(next);
        if (stepIdx !== lastSfxStep) {
          lastSfxStep = stepIdx;
          speakers.previewSfx();
        }
      }

      return "none";
    },
    render: (
      d: Draw2D,
      W: number,
      H: number,
      speakers: Speakers | null,
      mapName: string,
      canMenu: boolean,
    ): void => {
      const l = layout(W, H, canMenu);
      const c = l.card;
      d.setFillStyle("rgba(24, 18, 28, 0.72)");
      d.fillRect(0, 0, W, H);
      d.setFillStyle("#2b2330");
      d.fillRect(c.x, c.y, c.w, c.h);
      d.setStrokeStyle("#5d4d68");
      d.setLineWidth(3);
      d.strokeRect(c.x, c.y, c.w, c.h);

      d.setTextAlign("center");
      d.setTextBaseline("middle");
      d.setFont("36px Bangers");
      d.setFillStyle("#ffdf82");
      d.fillText("PAUSED", W / 2, c.y + 40);

      d.setFont("12px Archivo Black");
      d.setFillStyle("#a99aa6");
      d.fillText(mapName.toUpperCase(), W / 2, c.y + 72);

      const drawSlider = (
        label: string,
        y: number,
        bar: { x: number; y: number; w: number; h: number },
        value: number,
        color: string,
        selected: boolean,
      ): void => {
        d.setFont("14px Archivo Black");
        d.setTextAlign("left");
        d.setFillStyle(selected ? "#ffdf82" : "#fff2d3");
        d.fillText(label, c.x + 32, y);

        d.setTextAlign("center");
        d.setFillStyle(selected ? "#ffdf82" : "#a99aa6");
        d.fillText("-", bar.x - 18, y);
        d.fillText("+", bar.x + bar.w + 18, y);

        d.setFillStyle("#43374c");
        d.fillRect(bar.x, bar.y, bar.w, bar.h);
        const fillW = Math.round(bar.w * value);
        if (fillW > 0) {
          d.setFillStyle(color);
          d.fillRect(bar.x, bar.y, fillW, bar.h);
        }
        d.setStrokeStyle(selected ? "#ffdf82" : "#5d4d68");
        d.setLineWidth(2);
        d.strokeRect(bar.x, bar.y, bar.w, bar.h);

        d.setFillStyle("#fff2d3");
        d.fillRect(bar.x + fillW - 4, bar.y - 3, 8, bar.h + 6);

        d.setTextAlign("right");
        d.setFillStyle(selected ? "#ffdf82" : "#fff2d3");
        d.fillText(`${Math.round(value * 100)}%`, c.x + c.w - 28, y);
      };

      const musicVol = speakers ? speakers.musicVolume() : 0.3;
      const sfxVol = speakers ? speakers.sfxVolume() : 0.35;
      drawSlider(
        "MUSIC",
        l.musicY,
        l.musicBar,
        musicVol,
        "#f5c367",
        menu.row === 0,
      );
      drawSlider("SFX", l.sfxY, l.sfxBar, sfxVol, "#6ad1b7", menu.row === 1);

      const drawBtn = (
        b: { x: number; y: number; w: number; h: number },
        label: string,
        primary: boolean,
        selected: boolean,
      ): void => {
        d.setFillStyle(primary ? "#f5c367" : "#43374c");
        d.fillRect(b.x, b.y, b.w, b.h);
        if (selected) {
          d.setStrokeStyle("#fff2d3");
          d.setLineWidth(3);
          d.strokeRect(b.x, b.y, b.w, b.h);
        }
        d.setFont("16px Archivo Black");
        d.setTextAlign("center");
        d.setTextBaseline("middle");
        d.setFillStyle(primary ? "#2b2330" : "#fff2d3");
        d.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1);
      };

      drawBtn(l.resumeBtn, "RESUME", true, menu.row === 2);
      if (canMenu) drawBtn(l.menuBtn, "MAIN MENU", false, menu.row === 3);
    },
  };

  return menu;
}
