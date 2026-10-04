// Draws a match. Reads Match, never writes it: every peer and every snap must see the same simulation.
// Animation runs off match.frame, so a snapped frame always looks the same.
import type { Draw2D } from "dotframe/src/draw2d";
import type { Gpu, RenderGpu, Texture } from "dotframe/src/gpu";
import {
  BODY_LAYERS,
  HEAD_SCALE,
  handPose,
  joints,
  weaponPose,
} from "../../apps/web/src/game/characters/pose";
import { WEAPON_ART } from "../../apps/web/src/game/weapons/design";
import {
  ABILITIES,
  ARENA,
  abilityProjectile,
  type BattleView,
  CELL,
  CHARACTERS,
  isMovementAbility,
  PLAYABLE_MAP_IDS,
  type PlayerView,
  PROJECTILES,
  type ProjectileKind,
  shotTrajectory,
  terrainContours,
  WORLD_HEIGHT,
  WORLD_MAPS,
  WORLD_WIDTH,
} from "../../packages/shared/src";
import { POPUP_LIFE } from "./effects";
import {
  FRAME,
  HUD_HEIGHT,
  type Match,
  power01,
  seatOf,
  view,
  WEAPON_IDS,
} from "./match";

const PARTS = [
  "body",
  "head",
  "earBack",
  "earFront",
  "handBack",
  "handFront",
  "legBack",
  "legFront",
  "footBack",
  "footFront",
  "eyes",
  "tail",
];
export const TEXEL = 4;
const SEAT_COLORS = ["#f5c367", "#6ad1b7"];

export interface Art {
  textures: Map<string, Texture>;
}

export const art: Art = { textures: new Map() };

export type LoadBytes = (path: string) => Promise<Uint8Array>;

// Fonts, map backgrounds and weapons, by texture key. Paths are relative to the port root.
const FONTS: { names: string[]; file: string }[] = [
  { names: ["Archivo Black", "sans-serif"], file: "archivo-black" },
  { names: ["Bangers"], file: "bangers" },
];
function artImages(): { key: string; path: string }[] {
  const list: { key: string; path: string }[] = [];
  for (const id of PLAYABLE_MAP_IDS)
    list.push({
      key: `map-${id}`,
      path: WORLD_MAPS[id].background.replace(/\.svg$/, ""),
    });
  for (const kind of Object.keys(PROJECTILES)) {
    list.push({ key: `weapon-${kind}`, path: `weapons/${kind}` });
    list.push({
      key: `projectile-${kind}`,
      path: `weapons/${kind}-projectile`,
    });
  }
  return list;
}

// Loads fonts, the maps and weapons. Paths are relative to the port root.
export async function loadArt(
  gpu: Gpu,
  draw: Draw2D,
  load: LoadBytes,
  root: string,
): Promise<void> {
  const decoder = new TextDecoder();
  const fonts = `${root}/node_modules/dotframe/assets/fonts`;
  for (const font of FONTS)
    draw.addFont(
      font.names,
      await gpu.createImage(await load(`${fonts}/${font.file}.png`), true),
      decoder.decode(await load(`${fonts}/${font.file}.json`)),
    );
  await Promise.all(
    artImages().map(async (img): Promise<void> => {
      art.textures.set(
        img.key,
        await gpu.createImage(
          await load(`${root}/assets/art/${img.path}.png`),
          true,
        ),
      );
    }),
  );
}

// Parts load per species and coat on first use, like the web client: only critters in the match.
export function loadCritter(
  gpu: Gpu,
  load: LoadBytes,
  root: string,
  species: string,
  coat: string,
): Promise<void> {
  return Promise.all(
    PARTS.map(async (part): Promise<void> => {
      const key = `${species}-${coat}-${part}`;
      if (!art.textures.has(key))
        art.textures.set(
          key,
          await gpu.createImage(
            await load(`${root}/assets/art/${species}/${coat}/${part}.png`),
            true,
          ),
        );
    }),
  ).then((): void => undefined);
}

// The same loading, synchronous, for hosts without promises (scriptc library mode on iOS).
export function loadArtSync(
  draw: Draw2D,
  read: (path: string) => Uint8Array,
  image: (png: Uint8Array) => Texture,
  root: string,
  critters: { species: string; coat: string }[],
): void {
  const decoder = new TextDecoder();
  const fonts = `${root}/node_modules/dotframe/assets/fonts`;
  for (const font of FONTS)
    draw.addFont(
      font.names,
      image(read(`${fonts}/${font.file}.png`)),
      decoder.decode(read(`${fonts}/${font.file}.json`)),
    );
  for (const img of artImages())
    art.textures.set(
      img.key,
      image(read(`${root}/assets/art/${img.path}.png`)),
    );
  for (const c of critters)
    for (const part of PARTS)
      art.textures.set(
        `${c.species}-${c.coat}-${part}`,
        image(read(`${root}/assets/art/${c.species}/${c.coat}/${part}.png`)),
      );
}

export function critterLoaded(species: string, coat: string): boolean {
  return PARTS.every((part) => art.textures.has(`${species}-${coat}-${part}`));
}

function hexRgb(hex: string): number[] {
  let n = 0;
  for (let i = 1; i < hex.length; i++) {
    const c = hex.charCodeAt(i);
    n = n * 16 + (c <= 57 ? c - 48 : (c | 32) - 87);
  }
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function createRenderer(
  gpu: RenderGpu,
  window: { width: number; height: number },
) {
  // Baked once per crater at TEXEL world units per texel from the shared contour loops (the same ones the web
  // client strokes), filled with nonzero winding: outer loops run clockwise and caves counterclockwise.
  // Four sub-scanlines per texel row and fractional span ends give antialiased edges.
  let terrainKey = "";
  let terrain: Texture | null = null;
  const bakeTerrain = (state: BattleView): void => {
    const key = `${state.mapId}:${state.terrainRevision}`;
    if (key === terrainKey) return;
    terrainKey = key;
    const rows = state.terrainRows;
    const cellsY = rows.length;
    const cellsX = cellsY ? rows[0].length : 0;
    if (!cellsX) return;
    const id =
      PLAYABLE_MAP_IDS.find((m) => m === state.mapId) ?? PLAYABLE_MAP_IDS[0];
    const p = WORLD_MAPS[id].palette;
    const [earth, shade, light, rim, rimLight, outline] = [
      p.earth,
      p.shade,
      p.light,
      p.rim,
      p.rimLight,
      p.outline,
    ].map(hexRgb);
    const width = (cellsX * CELL) / TEXEL;
    const height = (cellsY * CELL) / TEXEL;
    const coverage = rasterizeLoops(terrainContours(rows), width, height);
    const solid = (wx: number, wy: number): boolean => {
      const x = Math.floor(wx / TEXEL);
      const y = Math.floor(wy / TEXEL);
      return (
        x >= 0 &&
        x < width &&
        y >= 0 &&
        y < height &&
        coverage[y * width + x] >= 0.5
      );
    };
    const pixels = new Uint8Array(width * height * 4);
    for (let py = 0; py < height; py++)
      for (let px = 0; px < width; px++) {
        const alpha = coverage[py * width + px];
        if (alpha <= 0) continue;
        const wx = (px + 0.5) * TEXEL;
        const wy = (py + 0.5) * TEXEL;
        let color: number[];
        if (!solid(wx, wy - 5)) color = outline;
        else if (!solid(wx, wy - 9)) color = rimLight;
        else if (!solid(wx, wy - 17)) color = rim;
        else if (!solid(wx - 6, wy) || !solid(wx + 6, wy) || !solid(wx, wy + 6))
          color = outline;
        else {
          const band = Math.floor((wy + 22 * Math.sin(wx / 128)) / 96) % 3;
          color = band === 0 ? shade : band === 1 ? light : earth;
        }
        const i = (py * width + px) * 4;
        pixels[i] = color[0];
        pixels[i + 1] = color[1];
        pixels[i + 2] = color[2];
        pixels[i + 3] = Math.round(Math.min(1, alpha) * 255);
      }
    // dotframe has no texture update or destroy yet, so each crater allocates a new one (~1 MB).
    terrain = gpu.createTexture(width, height, pixels, true);
  };

  const image = (
    d: Draw2D,
    key: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void => {
    const t = art.textures.get(key);
    if (t) d.drawImage(t, 0, 0, t.width, t.height, x, y, w, h);
  };

  const drawCritter = (
    d: Draw2D,
    match: Match,
    player: PlayerView,
    angle: number,
    power: number,
    kind: ProjectileKind | null,
  ): void => {
    const species = player.species;
    const j = joints[species];
    const key = (part: string): string => `${species}-${player.coat}-${part}`;
    const part = (name: string): void => image(d, key(name), -40, -50, 80, 100);
    const t = match.frame * (1000 / 60);
    const idle = Math.sin(t / 320 + player.number);
    const facing = Math.cos(angle) >= 0 ? 1 : -1;
    const local = Math.atan2(Math.sin(angle), Math.abs(Math.cos(angle)));
    const dead = player.hp <= 0;
    d.save();
    d.translate(player.x, player.y);
    d.scale(facing, 1);
    if (dead) d.setGlobalAlpha(0.7);
    d.translate(0, idle * 0.45 + (dead ? 5 : 0));
    if (dead) d.rotate(1.3);
    d.scale(1 - power * 0.025, 1 + idle * 0.012 + power * 0.025);
    const pivot = (
      name: string,
      xy: readonly number[],
      child?: string,
      childXy?: readonly number[],
      rotation = 0,
    ): void => {
      d.save();
      d.translate(xy[0], xy[1]);
      d.rotate(rotation);
      part(name);
      if (child && childXy) {
        d.translate(childXy[0], childXy[1]);
        part(child);
      }
      d.restore();
    };
    const hand = (front: boolean): void => {
      const pose = handPose(species, front, local, kind ?? undefined);
      d.save();
      d.translate(pose.x, pose.y);
      d.rotate(pose.angle);
      part(front ? "handFront" : "handBack");
      d.restore();
    };
    for (const layer of BODY_LAYERS) {
      if (layer === "tail") part("tail");
      else if (layer === "legBack")
        pivot("legBack", j.hipBack, "footBack", j.ankle);
      else if (layer === "legFront")
        pivot("legFront", j.hipFront, "footFront", j.ankle);
      else if (layer === "handBack") hand(false);
      else if (layer === "handFront") hand(true);
      else if (layer === "body") part("body");
      else if (layer === "weapon" && kind && !dead) {
        const origin = weaponPose(species, local);
        d.save();
        d.translate(origin.x, origin.y);
        d.rotate(local);
        image(d, `weapon-${kind}`, -32, -24, 64, 48);
        d.restore();
      } else if (layer === "head") {
        d.save();
        d.translate(j.neck[0], j.neck[1] + idle * 0.4);
        d.rotate(local * 0.07 + idle * 0.015);
        d.scale(HEAD_SCALE, HEAD_SCALE);
        pivot("earBack", j.earBack);
        pivot(
          "earFront",
          j.earFront,
          undefined,
          undefined,
          Math.sin(t / 440) * 0.04,
        );
        part("head");
        if (!dead) {
          const blink = Math.sin(t / 780 + player.number) > 0.998 ? 0.32 : 0.5;
          d.save();
          d.scale(1, blink * 2);
          part("eyes");
          d.restore();
        }
        d.restore();
      }
    }
    d.restore();
  };

  // touch: draw the on-screen walk and jump buttons (a finger has touched the screen).
  const render = (match: Match, d: Draw2D, touch = false): void => {
    const W = window.width;
    const H = window.height;
    const state = view(match);
    const id =
      PLAYABLE_MAP_IDS.find((m) => m === state.mapId) ?? PLAYABLE_MAP_IDS[0];
    const palette = WORLD_MAPS[id].palette;
    d.setFillStyle(palette.sky);
    d.fillRect(0, 0, W, H);
    // World to screen through the sim's camera, centered in the area below the HUD bar.
    const zoom = match.camera.zoom;
    const left = match.camera.x - FRAME.width / 2 / zoom;
    const top = match.camera.y - FRAME.height / 2 / zoom;
    d.save();
    d.translate(0, HUD_HEIGHT);
    d.scale(zoom, zoom);
    d.translate(-left, -top);
    const newest = match.fx.bursts.at(-1);
    const shakeAge = newest ? (match.frame - newest.frame) * (1000 / 60) : 1000;
    if (shakeAge < 140) {
      const amount = (0.003 * FRAME.width) / zoom;
      d.translate(
        Math.sin(match.frame * 2.1) * amount,
        Math.cos(match.frame * 1.7) * amount,
      );
    }
    // Stretch the scenery over whatever the camera sees, so pulling back past the world shows no seam.
    const coverLeft = Math.min(0, left);
    const coverTop = Math.min(0, top);
    const coverRight = Math.max(WORLD_WIDTH, left + FRAME.width / zoom);
    const coverBottom = Math.max(WORLD_HEIGHT, top + FRAME.height / zoom);
    image(
      d,
      `map-${id}`,
      coverLeft,
      coverTop,
      coverRight - coverLeft,
      coverBottom - coverTop,
    );
    bakeTerrain(state);
    if (terrain)
      d.drawImage(
        terrain,
        0,
        0,
        terrain.width,
        terrain.height,
        0,
        0,
        terrain.width * TEXEL,
        terrain.height * TEXEL,
      );

    const seat = seatOf(match);
    const aiming = state.phase === "aiming";
    state.players.forEach((player, i) => {
      const active = state.currentPlayer === player.sessionId;
      const charge = active && aiming ? power01(match.charge[i]) : 0;
      const kind = player.abilityArmed
        ? abilityProjectile(player.species)
        : player.selectedWeapon;
      d.setFillStyle("rgba(59,43,56,0.18)");
      d.beginPath();
      d.ellipse(
        player.x,
        player.y + ARENA.playerRadius + 3,
        22,
        4,
        0,
        0,
        Math.PI * 2,
        false,
      );
      d.fill();
      drawCritter(d, match, player, match.angle[i], charge, kind ?? null);
      if (player.shield > 0) {
        d.setStrokeStyle("rgba(180,217,210,0.8)");
        d.setLineWidth(2);
        d.beginPath();
        d.ellipse(player.x, player.y - 15, 32, 41, 0, 0, Math.PI * 2, false);
        d.stroke();
      }
      const headTop = player.y - (player.species === "cuy" ? 76 : 103);
      if (active && state.phase !== "finished") {
        const y = headTop - 6 + Math.sin(match.frame / 11) * 2;
        d.setFillStyle(SEAT_COLORS[i]);
        d.beginPath();
        d.moveTo(player.x - 14, y - 16);
        d.lineTo(player.x + 14, y - 16);
        d.lineTo(player.x, y);
        d.closePath();
        d.fill();
      }
      // Labels keep their screen size at any zoom.
      d.save();
      d.translate(player.x, player.y + 22 + 16 / zoom);
      d.scale(1 / zoom, 1 / zoom);
      d.setFont("11px Archivo Black");
      d.setTextAlign("center");
      d.setTextBaseline("middle");
      const label = `${CHARACTERS[player.species].name.toUpperCase()} · P${player.number}`;
      const w = d.measureText(label).width + 14;
      d.setFillStyle("#493d46");
      d.fillRect(-w / 2, -10, w, 20);
      d.setFillStyle("#fff2d3");
      d.fillText(label, 0, 1);
      d.restore();

      if (active && aiming && i === seat) {
        // Walking range, anchored where the turn began.
        const feet = player.y + ARENA.playerRadius + 7;
        d.setStrokeStyle("rgba(247,228,171,0.75)");
        d.setLineWidth(5);
        d.beginPath();
        d.moveTo(player.originX - ARENA.moveBudget, feet);
        d.lineTo(player.originX + ARENA.moveBudget, feet);
        d.stroke();
        if (!isMovementAbility(player.species) || !player.abilityArmed) {
          const points = shotTrajectory(
            state,
            state.players,
            player,
            match.angle[i],
            charge || 0.5,
            kind ?? player.selectedWeapon,
          );
          d.setFillStyle("rgba(41,39,51,0.85)");
          points.slice(0, 6).forEach((p, n) => {
            d.beginPath();
            d.arc(p.x, p.y, n % 2 === 0 ? 6 : 4.5, 0, Math.PI * 2, false);
            d.fill();
          });
        } else {
          // Where a leap, pounce or dash will carry the critter, as the web arena draws it.
          const species = player.species;
          const direction = Math.cos(match.angle[i]) >= 0 ? 1 : -1;
          const lift = species === "zorro" ? 0 : species === "puma" ? 72 : 118;
          const distance =
            species === "zorro" ? 185 : species === "puma" ? 155 : 125;
          const sx = player.x + direction * 38;
          const sy = player.y - 28;
          const ex = player.x + direction * distance;
          const ey = player.y - 28 - lift;
          const a = Math.atan2(ey - sy, ex - sx);
          const head = (wing: number, tip: number): void => {
            d.beginPath();
            d.moveTo(ex + Math.cos(a) * tip, ey + Math.sin(a) * tip);
            d.lineTo(
              ex - Math.cos(a - 0.62) * wing,
              ey - Math.sin(a - 0.62) * wing,
            );
            d.lineTo(
              ex - Math.cos(a + 0.62) * wing,
              ey - Math.sin(a + 0.62) * wing,
            );
            d.closePath();
            d.fill();
          };
          for (const stroke of [
            { color: "rgba(41,39,51,0.92)", width: 9 },
            { color: "#ffdf82", width: 5 },
          ]) {
            d.setStrokeStyle(stroke.color);
            d.setLineWidth(stroke.width);
            d.beginPath();
            d.moveTo(sx, sy);
            d.lineTo(ex, ey);
            d.stroke();
          }
          d.setFillStyle("#292733");
          head(23, 4);
          d.setFillStyle("#ffdf82");
          head(18, 0);
        }
        if (charge > 0) {
          d.setStrokeStyle("#ffef9f");
          d.setLineWidth(6);
          d.beginPath();
          d.arc(
            player.x,
            player.y,
            64,
            -Math.PI / 2,
            -Math.PI / 2 + charge * Math.PI * 2,
            false,
          );
          d.stroke();
        }
      }
    });

    const shot = state.projectile;
    const owner = state.players.find(
      (p) => p.sessionId === state.currentPlayer,
    );
    if (
      owner &&
      ((shot.active && shot.kind === "grapple") || state.phase === "grappling")
    ) {
      for (const stroke of [
        { color: "#4c473b", width: 4 },
        { color: "#e9cf9f", width: 1 },
      ]) {
        d.setStrokeStyle(stroke.color);
        d.setLineWidth(stroke.width);
        d.beginPath();
        d.moveTo(owner.x, owner.y);
        d.lineTo(shot.x, shot.y);
        d.stroke();
      }
    }
    const trailColor =
      shot.kind === "rift"
        ? "183,155,209"
        : shot.kind === "meow"
          ? "204,235,220"
          : shot.kind === "shuriken"
            ? "196,194,210"
            : "255,245,216";
    const trail = match.fx.trail;
    trail.forEach((point, n) => {
      d.setFillStyle(
        `rgba(${trailColor},${((n / trail.length) * 0.6).toFixed(3)})`,
      );
      d.beginPath();
      d.arc(
        point.x,
        point.y,
        2 + (1 - n / trail.length) * 5,
        0,
        Math.PI * 2,
        false,
      );
      d.fill();
    });
    if (shot.active) {
      const size = WEAPON_ART[shot.kind as ProjectileKind]?.shotSize ?? [
        28, 22,
      ];
      const timed =
        shot.kind === "grenade" ||
        shot.kind === "dynamite" ||
        shot.kind === "sticky";
      const spin =
        shot.kind === "shuriken" || shot.kind === "rift"
          ? shot.elapsedMs / (shot.kind === "shuriken" ? 70 : 400)
          : timed
            ? shot.stuck
              ? 0
              : shot.elapsedMs / 180
            : Math.atan2(shot.vy, shot.vx);
      d.save();
      d.translate(shot.x, shot.y);
      d.rotate(spin);
      image(
        d,
        `projectile-${shot.kind}`,
        -size[0] / 2,
        -size[1] / 2,
        size[0],
        size[1],
      );
      d.restore();
      if (timed) {
        const fuse = Math.max(
          0,
          (PROJECTILES[shot.kind as ProjectileKind].fuse - shot.elapsedMs) /
            1000,
        ).toFixed(1);
        d.setFont("16px Archivo Black");
        d.setTextAlign("center");
        d.setTextBaseline("middle");
        d.setStrokeStyle("#45332d");
        d.setLineWidth(4);
        d.strokeText(`${fuse}s`, shot.x, shot.y - 29);
        d.setFillStyle("#fff4c8");
        d.fillText(`${fuse}s`, shot.x, shot.y - 29);
      }
    }
    // Bursts: an expanding ring and twenty sparks per explosion, as the web arena tweens them.
    for (const b of match.fx.bursts) {
      const age = (match.frame - b.frame) * (1000 / 60);
      const palette =
        b.kind === "rift"
          ? ["#8555aa", "#d1a3f0", "#f3dcff"]
          : b.kind === "meow"
            ? ["#6faea6", "#b3efd7", "#fffbdd"]
            : b.kind === "shuriken"
              ? ["#484954", "#b2b5cc", "#f0edf8"]
              : ["#786362", "#ffb35f", "#ffedac"];
      const ease = (t: number): number => 1 - (1 - Math.min(1, t)) ** 3;
      if (age < 420) {
        const t = ease(age / 420);
        d.setGlobalAlpha(0.7 * (1 - t));
        d.setFillStyle(palette[2]);
        d.beginPath();
        d.arc(b.x, b.y, 10 + (b.radius - 10) * t, 0, Math.PI * 2, false);
        d.fill();
        d.setGlobalAlpha(1 - t);
        d.setStrokeStyle("#fff6d1");
        d.setLineWidth(3);
        d.stroke();
        d.setGlobalAlpha(1);
      }
      for (let n = 0; n < 20; n++) {
        const life = 380 + (n % 5) * 100;
        if (age >= life) continue;
        const t = ease(age / life);
        const angle = n * 2.399;
        const distance = 24 + (n % 5) * 17;
        d.setGlobalAlpha(1 - t);
        d.setFillStyle(palette[n % 3]);
        d.beginPath();
        d.arc(
          b.x + Math.cos(angle) * distance * t,
          b.y + (Math.sin(angle) * distance - 18) * t,
          (3 + (n % 5)) * (1 - 0.85 * t),
          0,
          Math.PI * 2,
          false,
        );
        d.fill();
      }
      d.setGlobalAlpha(1);
    }
    // Damage and healing numbers float up and fade.
    for (const t of match.fx.popups) {
      const k = Math.min(1, (match.frame - t.frame) / POPUP_LIFE);
      const rise = 1 - (1 - k) ** 3;
      const label = t.amount > 0 ? `-${t.amount}` : `+${-t.amount}`;
      d.setGlobalAlpha(1 - rise);
      d.setFont("25px Archivo Black");
      d.setTextAlign("center");
      d.setTextBaseline("middle");
      d.setStrokeStyle(t.amount > 0 ? "#713e49" : "#3c805e");
      d.setLineWidth(5);
      d.strokeText(label, t.x, t.y - 45 * rise);
      d.setFillStyle("#fff9db");
      d.fillText(label, t.x, t.y - 45 * rise);
      d.setGlobalAlpha(1);
    }
    d.restore();
    drawHud(d, match, state, W, window.height, touch);
  };

  return { render };
}

const HUD = {
  ink: "#2b2330",
  panel: "#3a2f3c",
  cream: "#fff2d3",
  dim: "#a99aa6",
  gold: "#ffdf82",
};

function panel(
  d: Draw2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = HUD.panel,
): void {
  d.setFillStyle("rgba(20,16,24,0.35)");
  d.fillRect(x + 2, y + 3, w, h);
  d.setFillStyle(fill);
  d.fillRect(x, y, w, h);
}

function text(
  d: Draw2D,
  value: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align = "left",
): void {
  d.setFont(font);
  d.setTextAlign(align);
  d.setTextBaseline("middle");
  d.setFillStyle(color);
  d.fillText(value, x, y);
}

function portrait(
  d: Draw2D,
  p: PlayerView,
  x: number,
  y: number,
  size: number,
): void {
  const head = art.textures.get(`${p.species}-${p.coat}-head`);
  const eyes = art.textures.get(`${p.species}-${p.coat}-eyes`);
  for (const t of [head, eyes])
    if (t)
      d.drawImage(
        t,
        0,
        0,
        t.width,
        t.height,
        x - size * 0.4,
        y - size * 0.55,
        size * 0.8,
        size,
      );
}

// Screen rectangles of hotbar slots 1-7, shared by drawing and pointer hit tests.
export function hotbarSlots(
  W: number,
  H: number,
): { x: number; y: number; size: number }[] {
  const size = 54;
  const gap = 8;
  const count = WEAPON_IDS.length + 1;
  const total = count * size + (count - 1) * gap + 14;
  const left = W / 2 - total / 2;
  return Array.from({ length: count }, (_, n) => ({
    x: left + n * (size + gap) + (n === count - 1 ? 14 : 0),
    y: H - size - 14,
    size,
  }));
}

// Touch buttons: walk left, walk right and jump on the left; fire on the right. Dragging on the field aims, so a
// phone can set the angle without charging (there is no hover).
export function touchButtons(
  W: number,
  H: number,
): {
  id: "left" | "right" | "jump" | "fire";
  x: number;
  y: number;
  w: number;
  h: number;
}[] {
  const y = H - 150;
  return [
    { id: "left", x: 12, y, w: 64, h: 64 },
    { id: "right", x: 84, y, w: 64, h: 64 },
    { id: "jump", x: 156, y, w: 100, h: 64 },
    { id: "fire", x: W - 152, y: y - 40, w: 140, h: 104 },
  ];
}

// The world point under a screen point, through the same camera transform render uses.
export function screenToWorld(
  match: Match,
  sx: number,
  sy: number,
): { x: number; y: number } {
  const zoom = match.camera.zoom;
  return {
    x: match.camera.x - FRAME.width / 2 / zoom + sx / zoom,
    y: match.camera.y - FRAME.height / 2 / zoom + (sy - HUD_HEIGHT) / zoom,
  };
}

// The web HUD's information on canvas: cards, clock, turn line, hotbar, meters, kickoff and results.
function drawHud(
  d: Draw2D,
  match: Match,
  state: BattleView,
  W: number,
  H: number,
  touch: boolean,
): void {
  d.setFillStyle(HUD.ink);
  d.fillRect(0, 0, W, HUD_HEIGHT);
  const seat = seatOf(match);
  state.players.forEach((p, i) => {
    const left = i === 0;
    const x = left ? 12 : W - 12 - 330;
    const active =
      state.currentPlayer === p.sessionId && state.phase !== "finished";
    panel(d, x, 6, 330, 52, active ? "#4a3c4a" : HUD.panel);
    portrait(d, p, left ? x + 28 : x + 302, 32, 46);
    const tx = left ? x + 58 : x + 272;
    const align = left ? "left" : "right";
    text(
      d,
      CHARACTERS[p.species].name.toUpperCase(),
      tx,
      20,
      "15px Archivo Black",
      SEAT_COLORS[i],
      align,
    );
    text(
      d,
      `P${p.number}`,
      left ? x + 318 : x + 12,
      20,
      "11px Archivo Black",
      HUD.dim,
      left ? "right" : "left",
    );
    const bar = 190;
    const bx = left ? tx : tx - bar;
    d.setFillStyle("#241d27");
    d.fillRect(bx, 37, bar, 10);
    const hp = Math.max(0, p.hp);
    d.setFillStyle(SEAT_COLORS[i]);
    const w = (bar * hp) / 100;
    d.fillRect(left ? bx : bx + bar - w, 37, w, 10);
    text(
      d,
      String(hp),
      left ? bx + bar + 34 : bx - 34,
      42,
      "18px Archivo Black",
      HUD.cream,
      "center",
    );
    if (p.shield > 0)
      text(
        d,
        `+${p.shield}`,
        left ? bx + bar + 34 : bx - 34,
        24,
        "10px Archivo Black",
        "#b4d9d2",
        "center",
      );
  });
  const id =
    PLAYABLE_MAP_IDS.find((m) => m === state.mapId) ?? PLAYABLE_MAP_IDS[0];
  panel(d, W / 2 - 110, 6, 220, 52);
  if (state.phase === "finished")
    text(d, "MATCH OVER", W / 2, 25, "24px Bangers", HUD.cream, "center");
  else {
    const seconds = Math.ceil(state.remainingMs / 1000);
    text(
      d,
      `${seconds}`,
      W / 2 - 6,
      26,
      "30px Bangers",
      seconds <= 5 && state.phase === "aiming" ? "#ef6f6c" : HUD.cream,
      "right",
    );
    text(d, "SEC", W / 2, 30, "11px Archivo Black", HUD.dim);
  }
  text(
    d,
    `ROUND ${state.roundNumber} · ${WORLD_MAPS[id].name}`,
    W / 2,
    47,
    "10px Archivo Black",
    HUD.dim,
    "center",
  );

  // Turn line, or the latest refusal from the engine.
  const current = state.players.find(
    (p) => p.sessionId === state.currentPlayer,
  );
  const notice = match.frame < match.noticeUntil ? match.notice : "";
  const line =
    state.phase === "finished"
      ? ""
      : notice ||
        (state.phase === "aiming" && current
          ? `${CHARACTERS[current.species].name}'s turn. Let it fly!`
          : state.phase === "flying"
            ? ""
            : "");
  if (line) {
    d.setFont("13px Archivo Black");
    const w = d.measureText(line).width + 32;
    panel(d, W / 2 - w / 2, 66, w, 28, notice ? "#5a3238" : HUD.panel);
    text(
      d,
      line,
      W / 2,
      80,
      "13px Archivo Black",
      notice ? "#ffc9c4" : "#c8f08f",
      "center",
    );
  }
  const wind = Math.round(state.wind);
  text(
    d,
    wind === 0 ? "NO WIND" : wind > 0 ? `WIND ${wind} >>` : `<< WIND ${-wind}`,
    W / 2,
    104,
    "11px Archivo Black",
    HUD.ink,
    "center",
  );

  // Hotbar: the six tools, then the critter's ability with its cooldown.
  if (current && state.phase !== "finished") {
    const slots = hotbarSlots(W, H);
    const { size } = slots[0];
    const y = slots[0].y;
    panel(
      d,
      slots[0].x - 10,
      y - 8,
      slots[slots.length - 1].x + size - slots[0].x + 20,
      size + 16,
      HUD.ink,
    );
    const cooldown = Math.max(0, current.abilityReadyTurn - state.turnNumber);
    for (let n = 0; n < slots.length; n++) {
      const ability = n === WEAPON_IDS.length;
      const x = slots[n].x;
      const kind = ability ? null : WEAPON_IDS[n];
      const selected = ability
        ? current.abilityArmed
        : !current.abilityArmed && current.selectedWeapon === kind;
      const hasAbility = ABILITIES[current.species] !== null;
      panel(d, x, y, size, size, selected ? "#f1c56a" : "#3f4a45");
      if (kind) {
        const t = art.textures.get(`weapon-${kind}`);
        if (t)
          d.drawImage(
            t,
            0,
            0,
            t.width,
            t.height,
            x + 5,
            y + 9,
            size - 10,
            (size - 10) * 0.75,
          );
      } else if (hasAbility) {
        if (cooldown > 0) d.setGlobalAlpha(0.35);
        portrait(d, current, x + size / 2, y + size / 2 + 2, 38);
        d.setGlobalAlpha(1);
        if (cooldown > 0)
          text(
            d,
            String(cooldown),
            x + size / 2,
            y + size / 2,
            "26px Bangers",
            HUD.cream,
            "center",
          );
      }
      text(
        d,
        String(n + 1),
        x + 6,
        y + 9,
        "10px Archivo Black",
        selected ? HUD.ink : HUD.dim,
      );
    }
    // Power and walking range.
    const charge = seat >= 0 ? power01(match.charge[seat]) : 0;
    panel(d, W - 232, H - 68, 220, 54, HUD.ink);
    text(d, "POWER", W - 218, H - 52, "11px Archivo Black", HUD.dim);
    text(
      d,
      `${Math.round(charge * 100)}%`,
      W - 26,
      H - 52,
      "16px Archivo Black",
      HUD.cream,
      "right",
    );
    d.setFillStyle("#241d27");
    d.fillRect(W - 218, H - 36, 192, 10);
    d.setFillStyle(HUD.gold);
    d.fillRect(W - 218, H - 36, 192 * charge, 10);
    const used = Math.abs(current.x - current.originX);
    const range = Math.max(0, Math.round(ARENA.moveBudget - used));
    panel(d, 12, H - 68, 220, 54, HUD.ink);
    text(d, "RANGE", 26, H - 52, "11px Archivo Black", HUD.dim);
    text(
      d,
      `${range} / ${ARENA.moveBudget}`,
      218,
      H - 52,
      "13px Archivo Black",
      HUD.cream,
      "right",
    );
    d.setFillStyle("#241d27");
    d.fillRect(26, H - 36, 192, 10);
    d.setFillStyle("#c8f08f");
    d.fillRect(26, H - 36, (192 * range) / ARENA.moveBudget, 10);
  }

  if (touch && current && state.phase === "aiming")
    for (const b of touchButtons(W, H)) {
      panel(d, b.x, b.y, b.w, b.h, HUD.ink);
      const label =
        b.id === "left"
          ? "<"
          : b.id === "right"
            ? ">"
            : b.id === "jump"
              ? "JUMP"
              : "FIRE";
      text(
        d,
        label,
        b.x + b.w / 2,
        b.y + b.h / 2,
        b.id === "left" || b.id === "right"
          ? "28px Archivo Black"
          : "16px Archivo Black",
        HUD.cream,
        "center",
      );
    }
  // Kickoff banner while the clock waits, then the results card.
  if (match.kickoff > 0 && current && state.phase !== "finished") {
    d.setFillStyle("rgba(24,18,28,0.55)");
    d.fillRect(0, 0, W, H);
    panel(d, W / 2 - 200, H / 2 - 70, 400, 140);
    text(
      d,
      "KICKOFF",
      W / 2,
      H / 2 - 36,
      "13px Archivo Black",
      HUD.dim,
      "center",
    );
    text(
      d,
      `Player ${current.number} starts`,
      W / 2,
      H / 2 + 8,
      "40px Bangers",
      SEAT_COLORS[seat],
      "center",
    );
    text(
      d,
      `${ARENA.turnMs / 1000}s turns · 100 HP`,
      W / 2,
      H / 2 + 44,
      "12px Archivo Black",
      HUD.cream,
      "center",
    );
  }
  if (state.phase === "finished") {
    const winner = state.players.find((p) => p.sessionId === state.winner);
    d.setFillStyle("rgba(24,18,28,0.6)");
    d.fillRect(0, 0, W, H);
    panel(d, W / 2 - 220, H / 2 - 110, 440, 220);
    if (winner) portrait(d, winner, W / 2, H / 2 - 50, 80);
    const index = winner ? state.players.indexOf(winner) : 0;
    text(
      d,
      winner ? `Player ${winner.number} wins!` : "Draw",
      W / 2,
      H / 2 + 22,
      "44px Bangers",
      winner ? SEAT_COLORS[index] : HUD.cream,
      "center",
    );
    text(
      d,
      winner
        ? `${CHARACTERS[winner.species].name} takes the duel`
        : state.finishReason,
      W / 2,
      H / 2 + 58,
      "13px Archivo Black",
      HUD.cream,
      "center",
    );
    text(
      d,
      "Press R for a rematch",
      W / 2,
      H / 2 + 88,
      "12px Archivo Black",
      HUD.gold,
      "center",
    );
  }
}
type Point = { x: number; y: number };

// Coverage (0..1) per texel of closed loops in world units, nonzero winding.
export function rasterizeLoops(
  loops: Point[][],
  width: number,
  height: number,
): Float32Array {
  const SUB = 4;
  const coverage = new Float32Array(width * height);
  const edges: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    dir: number;
  }[] = [];
  for (const loop of loops)
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      if (a.y === b.y) continue;
      const dir = b.y > a.y ? 1 : -1;
      const [lo, hi] = dir > 0 ? [a, b] : [b, a];
      edges.push({
        x0: lo.x / TEXEL,
        y0: lo.y / TEXEL,
        x1: hi.x / TEXEL,
        y1: hi.y / TEXEL,
        dir,
      });
    }
  const crossings: { x: number; dir: number }[] = [];
  for (let sy = 0; sy < height * SUB; sy++) {
    const y = (sy + 0.5) / SUB;
    crossings.length = 0;
    for (const e of edges)
      if (y >= e.y0 && y < e.y1)
        crossings.push({
          x: e.x0 + ((y - e.y0) / (e.y1 - e.y0)) * (e.x1 - e.x0),
          dir: e.dir,
        });
    crossings.sort((m, n) => m.x - n.x);
    const row = Math.floor(sy / SUB) * width;
    let winding = 0;
    for (let k = 0; k < crossings.length - 1; k++) {
      winding += crossings[k].dir;
      if (winding === 0) continue;
      const from = Math.max(0, crossings[k].x);
      const to = Math.min(width, crossings[k + 1].x);
      if (to <= from) continue;
      const first = Math.floor(from);
      const last = Math.min(width - 1, Math.floor(to));
      if (first === last) coverage[row + first] += (to - from) / SUB;
      else {
        coverage[row + first] += (first + 1 - from) / SUB;
        for (let x = first + 1; x < last; x++) coverage[row + x] += 1 / SUB;
        if (last < width) coverage[row + last] += (to - last) / SUB;
      }
    }
  }
  return coverage;
}
