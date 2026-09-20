import type { BattleView } from "@craft-ones/shared";
import * as Phaser from "phaser";
export type HudInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};
/** What the camera frames once the turn introduction has ended. */
export type CameraView = "action" | "focus" | "map";
/** The character rig is drawn 100 world units tall. */
const CHARACTER_HEIGHT = 100;
/** Normal play keeps the active character at least this tall on screen. */
const MIN_CHARACTER_PIXELS = 36;
/** Only the explicit map overview zooms out further than this. */
export const MIN_ACTION_ZOOM = MIN_CHARACTER_PIXELS / CHARACTER_HEIGHT;
const FOCUS_ZOOM = 1.12;
const TURN_INTRO_MS = 1600;
export class ArenaCamera {
  /** The area the HUD leaves free, which the framing is computed against. */
  readonly frame = { width: 0, height: 0 };
  private centerX = 0;
  private centerY = 0;
  private turn = -1;
  private intro = 0;
  constructor(private camera: Phaser.Cameras.Scene2D.Camera) {}
  reset() {
    this.turn = -1;
  }
  update(
    state: BattleView,
    dt: number,
    view: CameraView,
    charging: boolean,
    insets: HudInsets,
  ) {
    const large = state.terrainRows.length > 0;
    // The HUD floats over the canvas, so the camera frames what it leaves free.
    const frameWidth = Math.max(
      160,
      this.camera.width - insets.left - insets.right,
    );
    const frameHeight = Math.max(
      160,
      this.camera.height - insets.top - insets.bottom,
    );
    this.frame.width = frameWidth;
    this.frame.height = frameHeight;
    if (!this.centerX) {
      this.centerX = state.worldWidth / 2;
      this.centerY = state.worldHeight / 2;
    }
    if (this.turn !== state.turnNumber) {
      this.turn = state.turnNumber;
      this.intro = TURN_INTRO_MS;
    }
    this.intro = Math.max(0, this.intro - dt);
    // Never move the target under a held pointer while the player is charging.
    if (charging) return;
    const active = state.players.find(
      (p) => p.sessionId === state.currentPlayer,
    );
    const close =
      large &&
      state.phase === "aiming" &&
      active &&
      (view === "focus" || this.intro > 0);
    const flight = state.phase === "flying";
    // A shot may arc above the world, so the framed area grows upward with it.
    const top = flight ? Math.min(0, state.projectile.y - 90) : 0;
    const overview = Math.min(
      frameWidth / state.worldWidth,
      frameHeight / (state.worldHeight - top),
    );
    // A short viewport would shrink the whole map below legibility, so normal
    // play follows the action instead and leaves the full map to its own view.
    const zoom = close
      ? FOCUS_ZOOM
      : view === "map"
        ? overview
        : Math.max(overview, MIN_ACTION_ZOOM);
    const target =
      view === "map" || !active
        ? { x: state.worldWidth / 2, y: (state.worldHeight + top) / 2 }
        : flight
          ? { x: state.projectile.x, y: state.projectile.y }
          : { x: active.x, y: active.y - 65 };
    const x = fit(target.x, frameWidth / zoom, 0, state.worldWidth);
    const y = fit(target.y, frameHeight / zoom, top, state.worldHeight);
    const factor = 1 - Math.exp(-dt / (close || flight ? 230 : 400));
    this.centerX = Phaser.Math.Linear(this.centerX, x, factor);
    this.centerY = Phaser.Math.Linear(this.centerY, y, factor);
    this.camera.setZoom(Phaser.Math.Linear(this.camera.zoom, zoom, factor));
    // Shift the framing so the free area, not the whole canvas, holds the action.
    this.camera.centerOn(
      this.centerX + (insets.right - insets.left) / 2 / this.camera.zoom,
      this.centerY + (insets.bottom - insets.top) / 2 / this.camera.zoom,
    );
  }
}
/** Center a span of the world on a target without looking past its edges. */
function fit(target: number, span: number, min: number, max: number) {
  if (span >= max - min) return (min + max) / 2;
  return Phaser.Math.Clamp(target, min + span / 2, max - span / 2);
}
