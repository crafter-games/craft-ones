// Port of apps/web/src/game/BattleEffects.ts. The trail, explosion bursts and damage numbers have history,
// so they are simulation state advanced once per step; render draws them from their age and never adds one.
import { ABILITIES, type BattleView } from "../../packages/shared/src";

const TRAIL = 24;
export const FLASH_FRAMES = 72;
const BURST_FRAMES = Math.ceil(780 / (1000 / 60));
const POPUP_FRAMES = Math.ceil(1100 / (1000 / 60));

// One ability event: where the actor was and ended up, and the hit it landed (x1, y1 is the target for strikes).
export interface Flash {
  kind: string;
  seat: number;
  x: number;
  y: number;
  x1: number;
  y1: number;
  dir: number;
  frame: number;
  label: string;
}

const STRIKE_LABELS: Record<string, string> = {
  stomp: "STOMP!",
  claw: "CLAW!",
};

export interface Effects {
  flashes: Flash[];
  actionId: number;
  pos: { x: number; y: number }[];
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
    flashes: [],
    actionId: state.actionId,
    pos: state.players.map((p) => ({ x: p.x, y: p.y })),
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
  if (state.actionId !== fx.actionId) {
    fx.actionId = state.actionId;
    const seat = state.players.findIndex(
      (q) => q.sessionId === state.currentPlayer,
    );
    const actor = state.players[seat];
    const foe = state.players[1 - seat];
    if (actor) {
      const from = fx.pos[seat] ?? { x: actor.x, y: actor.y };
      const strike =
        state.lastAction === "stomp" || state.lastAction === "claw";
      const target = strike && foe ? foe : actor;
      const aimed = foe ? (foe.x >= actor.x ? 1 : -1) : 1;
      const moved = actor.x - from.x;
      fx.flashes.push({
        kind: state.lastAction,
        seat,
        x: strike ? actor.x : from.x,
        y: strike ? actor.y : from.y,
        x1: target.x,
        y1: target.y,
        dir: moved !== 0 ? (moved > 0 ? 1 : -1) : aimed,
        frame,
        label:
          STRIKE_LABELS[state.lastAction] ??
          ABILITIES[actor.species].name.toUpperCase(),
      });
    }
  }
  fx.pos = state.players.map((q) => ({ x: q.x, y: q.y }));
  fx.flashes = fx.flashes.filter((f) => frame - f.frame < FLASH_FRAMES);
  fx.bursts = fx.bursts.filter((b) => frame - b.frame < BURST_FRAMES);
  fx.popups = fx.popups.filter((t) => frame - t.frame < POPUP_FRAMES);
}

export const BURST_LIFE = BURST_FRAMES;
export const POPUP_LIFE = POPUP_FRAMES;
