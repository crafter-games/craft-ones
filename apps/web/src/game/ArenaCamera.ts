import { ARENA, type BattleView } from "@craft-ones/shared";
import * as Phaser from "phaser";
export class ArenaCamera {
  private centerX: number = ARENA.width / 2;
  private centerY: number = ARENA.height / 2;
  private turn = -1;
  private intro = 0;
  constructor(private camera: Phaser.Cameras.Scene2D.Camera) {}
  reset() {
    this.turn = -1;
  }
  update(state: BattleView, dt: number, focus: boolean, charging: boolean) {
    const large = state.terrainRows.length > 0;
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
      ARENA.width / state.worldWidth,
      ARENA.height / (state.worldHeight - top),
    );
    const zoom = close ? 1.12 : overview;
    const x = close
      ? Phaser.Math.Clamp(
          active.x,
          ARENA.width / zoom / 2,
          state.worldWidth - ARENA.width / zoom / 2,
        )
      : state.worldWidth / 2;
    const y = close
      ? Phaser.Math.Clamp(
          active.y - 65,
          ARENA.height / zoom / 2,
          state.worldHeight - ARENA.height / zoom / 2,
        )
      : (state.worldHeight + top) / 2;
    const factor = 1 - Math.exp(-dt / (close ? 230 : 400));
    this.centerX = Phaser.Math.Linear(this.centerX, x, factor);
    this.centerY = Phaser.Math.Linear(this.centerY, y, factor);
    this.camera.setZoom(Phaser.Math.Linear(this.camera.zoom, zoom, factor));
    this.camera.centerOn(this.centerX, this.centerY);
  }
}
