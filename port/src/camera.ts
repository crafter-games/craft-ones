// Port of apps/web/src/game/ArenaCamera.ts. It advances once per simulation step, never per drawn frame,
// so every peer frames the same view no matter its refresh rate, and render only reads it.
import { type BattleView, dexp } from "../../packages/shared/src";

const CHARACTER_HEIGHT = 100;
const MIN_CHARACTER_PIXELS = 36;
const MIN_ACTION_ZOOM = MIN_CHARACTER_PIXELS / CHARACTER_HEIGHT;
const FOCUS_ZOOM = 1.12;
const TURN_INTRO_MS = 1600;

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  turn: number;
  intro: number;
  // The explicit overview; normal play follows the action.
  map: boolean;
}

export interface Frame {
  width: number;
  height: number;
}

export function createCamera(state: BattleView, frame: Frame): Camera {
  return {
    x: state.worldWidth / 2,
    y: state.worldHeight / 2,
    zoom: overviewZoom(state, frame, 0),
    turn: -1,
    intro: 0,
    map: false,
  };
}

function overviewZoom(state: BattleView, frame: Frame, top: number): number {
  return Math.min(
    frame.width / state.worldWidth,
    frame.height / (state.worldHeight - top),
  );
}

function fit(target: number, span: number, min: number, max: number): number {
  if (span >= max - min) return (min + max) / 2;
  return Math.min(max - span / 2, Math.max(min + span / 2, target));
}

export function updateCamera(
  camera: Camera,
  state: BattleView,
  frame: Frame,
  dt: number,
  charging: boolean,
): void {
  if (camera.turn !== state.turnNumber) {
    camera.turn = state.turnNumber;
    camera.intro = TURN_INTRO_MS;
  }
  camera.intro = Math.max(0, camera.intro - dt);
  // Never move the target under the player while they charge a shot.
  if (charging) return;
  const active = state.players.find((p) => p.sessionId === state.currentPlayer);
  const close =
    state.terrainRows.length > 0 &&
    state.phase === "aiming" &&
    !!active &&
    !camera.map &&
    camera.intro > 0;
  const flight = state.phase === "flying";
  // A shot may arc above the world, so the framed area grows upward with it.
  const top = flight ? Math.min(0, state.projectile.y - 90) : 0;
  const overview = overviewZoom(state, frame, top);
  const zoom = close
    ? FOCUS_ZOOM
    : camera.map
      ? overview
      : Math.max(overview, MIN_ACTION_ZOOM);
  const target =
    camera.map || !active
      ? { x: state.worldWidth / 2, y: (state.worldHeight + top) / 2 }
      : flight
        ? { x: state.projectile.x, y: state.projectile.y }
        : { x: active.x, y: active.y - 65 };
  const x = fit(target.x, frame.width / zoom, 0, state.worldWidth);
  const y = fit(target.y, frame.height / zoom, top, state.worldHeight);
  const factor = 1 - dexp(-dt / (close || flight ? 230 : 400));
  camera.x += (x - camera.x) * factor;
  camera.y += (y - camera.y) * factor;
  camera.zoom += (zoom - camera.zoom) * factor;
}
