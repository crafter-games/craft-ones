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
  WORLD_HEIGHT,
  WORLD_MAPS,
  WORLD_WIDTH,
} from "../../packages/shared/src";
import { type Match, power01, seatOf, view } from "./match";

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
const SEAT_COLORS = ["#f5c367", "#6ad1b7"];

export interface Art {
  textures: Map<string, Texture>;
}

export const art: Art = { textures: new Map() };

export type LoadBytes = (path: string) => Promise<Uint8Array>;

// Loads fonts, the maps and weapons, and every species/coat part. Paths are relative to the port root.
export async function loadArt(
  gpu: Gpu,
  draw: Draw2D,
  load: LoadBytes,
  root: string,
): Promise<void> {
  const decoder = new TextDecoder();
  const fonts = `${root}/node_modules/dotframe/assets/fonts`;
  draw.addFont(
    ["Archivo Black", "sans-serif"],
    await gpu.createImage(await load(`${fonts}/archivo-black.png`), true),
    decoder.decode(await load(`${fonts}/archivo-black.json`)),
  );
  draw.addFont(
    ["Bangers"],
    await gpu.createImage(await load(`${fonts}/bangers.png`), true),
    decoder.decode(await load(`${fonts}/bangers.json`)),
  );
  const image = async (key: string, path: string): Promise<void> => {
    art.textures.set(
      key,
      await gpu.createImage(await load(`${root}/assets/art/${path}.png`), true),
    );
  };
  const jobs: Promise<void>[] = [];
  for (const id of PLAYABLE_MAP_IDS)
    jobs.push(
      image(`map-${id}`, WORLD_MAPS[id].background.replace(/\.svg$/, "")),
    );
  for (const kind of Object.keys(PROJECTILES)) {
    jobs.push(image(`weapon-${kind}`, `weapons/${kind}`));
    jobs.push(image(`projectile-${kind}`, `weapons/${kind}-projectile`));
  }
  await Promise.all(jobs);
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

export function critterLoaded(species: string, coat: string): boolean {
  return PARTS.every((part) => art.textures.has(`${species}-${coat}-${part}`));
}

function hexRgb(hex: string): number[] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function createRenderer(
  gpu: RenderGpu,
  window: { width: number; height: number },
) {
  // The terrain is baked to one texel per cell whenever a crater lands; linear filtering softens the edge.
  let terrainKey = "";
  let terrain: Texture | null = null;
  const bakeTerrain = (state: BattleView): void => {
    const key = `${state.mapId}:${state.terrainRevision}`;
    if (key === terrainKey) return;
    terrainKey = key;
    const rows = state.terrainRows;
    const height = rows.length;
    const width = height ? rows[0].length : 0;
    if (!width) return;
    const id =
      PLAYABLE_MAP_IDS.find((m) => m === state.mapId) ?? PLAYABLE_MAP_IDS[0];
    const p = WORLD_MAPS[id].palette;
    const [earth, shade, light, rim, outline] = [
      p.earth,
      p.shade,
      p.light,
      p.rim,
      p.outline,
    ].map(hexRgb);
    const pixels = new Uint8Array(width * height * 4);
    const solid = (x: number, y: number): boolean => rows[y]?.[x] === "1";
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        if (!solid(x, y)) continue;
        // Depth below the nearest open cell above picks the rim, the band, or the body color.
        let depth = 0;
        while (depth < 6 && solid(x, y - depth - 1)) depth++;
        const edge = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y + 1);
        const band = Math.floor((y * CELL + 22 * Math.sin(x * 0.2)) / 96) % 3;
        const color =
          depth < 1
            ? outline
            : depth < 3
              ? rim
              : edge
                ? outline
                : band === 0
                  ? shade
                  : band === 1
                    ? light
                    : earth;
        const i = (y * width + x) * 4;
        pixels[i] = color[0];
        pixels[i + 1] = color[1];
        pixels[i + 2] = color[2];
        pixels[i + 3] = 255;
      }
    // dotframe has no texture update or destroy yet, so each crater allocates a new one (~260 KB).
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

  const render = (match: Match, d: Draw2D): void => {
    const W = window.width;
    const H = window.height;
    const state = view(match);
    const id =
      PLAYABLE_MAP_IDS.find((m) => m === state.mapId) ?? PLAYABLE_MAP_IDS[0];
    const palette = WORLD_MAPS[id].palette;
    d.setFillStyle(palette.sky);
    d.fillRect(0, 0, W, H);
    // Fit the whole world: a 1v1 artillery duel reads best when both critters are on screen.
    const s = Math.min(W / WORLD_WIDTH, (H - 64) / WORLD_HEIGHT);
    const ox = (W - WORLD_WIDTH * s) / 2;
    const oy = 64 + (H - 64 - WORLD_HEIGHT * s) / 2;
    d.save();
    d.translate(ox, oy);
    d.scale(s, s);
    image(d, `map-${id}`, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
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
        terrain.width * CELL,
        terrain.height * CELL,
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
      d.setFont("bold 22px Archivo Black");
      d.setTextAlign("center");
      d.setTextBaseline("middle");
      const label = `${CHARACTERS[player.species].name.toUpperCase()} · P${player.number}`;
      const w = d.measureText(label).width + 20;
      d.setFillStyle("#493d46");
      d.fillRect(player.x - w / 2, player.y + 30, w, 32);
      d.setFillStyle("#fff2d3");
      d.fillText(label, player.x, player.y + 47);

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
    if (shot.active) {
      const size = WEAPON_ART[shot.kind as ProjectileKind]?.shotSize ?? [
        28, 22,
      ];
      d.save();
      d.translate(shot.x, shot.y);
      d.rotate(Math.atan2(shot.vy, shot.vx));
      image(
        d,
        `projectile-${shot.kind}`,
        -size[0],
        -size[1],
        size[0] * 2,
        size[1] * 2,
      );
      d.restore();
    }
    if (state.phase === "exploding" && state.explosion.radius > 0) {
      const e = state.explosion;
      d.setFillStyle("rgba(255,214,120,0.55)");
      d.beginPath();
      d.arc(e.x, e.y, e.radius, 0, Math.PI * 2, false);
      d.fill();
      d.setFillStyle("rgba(255,250,230,0.8)");
      d.beginPath();
      d.arc(e.x, e.y, e.radius * 0.45, 0, Math.PI * 2, false);
      d.fill();
    }
    d.restore();
    drawHud(d, state, W);
  };

  return { render };
}

function drawHud(d: Draw2D, state: BattleView, W: number): void {
  d.setFillStyle("#2b2330");
  d.fillRect(0, 0, W, 64);
  d.setTextBaseline("middle");
  state.players.forEach((p, i) => {
    const left = i === 0;
    const x = left ? 24 : W - 24 - 300;
    d.setFillStyle("#493d46");
    d.fillRect(x, 34, 300, 16);
    d.setFillStyle(SEAT_COLORS[i]);
    const w = (300 * Math.max(0, p.hp)) / 100;
    d.fillRect(left ? x : x + 300 - w, 34, w, 16);
    d.setFont("18px Archivo Black");
    d.setTextAlign(left ? "left" : "right");
    d.setFillStyle("#fff2d3");
    const weapon = p.abilityArmed ? "ABILITY" : p.selectedWeapon.toUpperCase();
    d.fillText(
      `P${p.number} ${CHARACTERS[p.species].name.toUpperCase()}  ${Math.max(0, p.hp)} HP  ·  ${weapon}`,
      left ? x : x + 300,
      18,
    );
  });
  d.setTextAlign("center");
  d.setFillStyle("#fff2d3");
  if (state.phase === "finished") {
    const winner = state.players.find((p) => p.sessionId === state.winner);
    d.setFont("34px Bangers");
    d.fillText(winner ? `P${winner.number} WINS` : "DRAW", W / 2, 32);
  } else {
    d.setFont("30px Bangers");
    d.fillText(`${Math.ceil(state.remainingMs / 1000)}s`, W / 2, 22);
    d.setFont("14px Archivo Black");
    const wind =
      state.wind === 0
        ? "NO WIND"
        : state.wind > 0
          ? `WIND ${Math.round(state.wind)} >>`
          : `<< WIND ${Math.abs(Math.round(state.wind))}`;
    d.fillText(`TURN ${state.turnNumber} · ${wind}`, W / 2, 48);
  }
}
