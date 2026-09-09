import type { BattleView } from "@craft-ones/shared";
import * as Phaser from "phaser";
export type HudInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};
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
    focus: boolean,
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
      this.intro = 1600;
    }
    this.intro = Math.max(0, this.intro - dt);
    // Never move the target under a held pointer while the player is charging.
    if (charging) return;
    const active = state.players.find(
      (p) => p.sessionId === state.currentPlayer,
    );
    const close =
      large && state.phase === "aiming" && active && (focus || this.intro > 0);
    const flight = state.phase === "flying";
    const top = flight ? Math.min(0, state.projectile.y - 90) : 0;
    const overview = Math.min(
      frameWidth / state.worldWidth,
      frameHeight / (state.worldHeight - top),
    );
    const zoom = close ? 1.12 : overview;
    const x = close
      ? Phaser.Math.Clamp(
          active.x,
          frameWidth / zoom / 2,
          state.worldWidth - frameWidth / zoom / 2,
        )
      : state.worldWidth / 2;
    const y = close
      ? Phaser.Math.Clamp(
          active.y - 65,
          frameHeight / zoom / 2,
          state.worldHeight - frameHeight / zoom / 2,
        )
      : (state.worldHeight + top) / 2;
    const factor = 1 - Math.exp(-dt / (close ? 230 : 400));
    this.centerX = Phaser.Math.Linear(this.centerX, x, factor);
    this.centerY = Phaser.Math.Linear(this.centerY, y, factor);
    this.camera.setZoom(Phaser.Math.Linear(this.camera.zoom, zoom, factor));
    // Shift the framing so the free area, not the whole canvas, holds the action.
    this.camera.centerOn(
      this.centerX + (insets.left - insets.right) / 2 / this.camera.zoom,
      this.centerY + (insets.top - insets.bottom) / 2 / this.camera.zoom,
    );
  }
}
