// Port of apps/web/src/game/BattleEffects.ts. The trail, explosion bursts and damage numbers have history,
// so they are simulation state advanced once per step; render draws them from their age and never adds one.
import type { BattleView } from "../../packages/shared/src";

const TRAIL = 24;
const BURST_FRAMES = Math.ceil(780 / (1000 / 60));
const POPUP_FRAMES = Math.ceil(1100 / (1000 / 60));

export interface Effects {
  trail: { x: number; y: number }[];
  bursts: {
    x: number;
    y: number;
    radius: number;
    kind: string;
    frame: number;
  }[];
  popups: { x: number; y: number; amount: number; frame: number }[];
  explosionId: number;
  hp: number[];
}

export function createEffects(state: BattleView): Effects {
  return {
    trail: [],
    bursts: [],
    popups: [],
    explosionId: state.explosion.id,
    hp: state.players.map((p) => p.hp),
  };
}

export function updateEffects(
  fx: Effects,
  state: BattleView,
  frame: number,
): void {
  const p = state.projectile;
  if (p.active) {
    const last = fx.trail.at(-1);
    if (!last || last.x !== p.x || last.y !== p.y)
      fx.trail.push({ x: p.x, y: p.y });
    if (fx.trail.length > TRAIL) fx.trail.shift();
  } else fx.trail = [];
  if (state.explosion.id !== fx.explosionId) {
    fx.explosionId = state.explosion.id;
    fx.bursts.push({
      x: state.explosion.x,
      y: state.explosion.y,
      radius: state.explosion.radius,
      kind: p.kind,
      frame,
    });
  }
  state.players.forEach((player, i) => {
    const damage = (fx.hp[i] ?? 100) - player.hp;
    if (damage !== 0)
      fx.popups.push({ x: player.x, y: player.y - 68, amount: damage, frame });
    fx.hp[i] = player.hp;
  });
  fx.bursts = fx.bursts.filter((b) => frame - b.frame < BURST_FRAMES);
  fx.popups = fx.popups.filter((t) => frame - t.frame < POPUP_FRAMES);
}

export const BURST_LIFE = BURST_FRAMES;
export const POPUP_LIFE = POPUP_FRAMES;
