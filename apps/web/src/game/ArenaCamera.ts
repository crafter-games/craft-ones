import { ARENA, type BattleView } from "@craft-ones/shared";
import Phaser from "phaser";

export class ArenaCamera {
  private centerX: number = ARENA.width / 2;
  private centerY: number = ARENA.height / 2;
  constructor(private camera: Phaser.Cameras.Scene2D.Camera) {}
  update(state: BattleView, dt: number) {
    const inFlight = state.phase === "flying";
    const top = inFlight ? Math.min(0, state.projectile.y - 90) : 0;
    // Track ordinary shots gently; pull out for high arcs to retain the players.
    const zoom = inFlight
      ? Math.min(1.06, (ARENA.height / (ARENA.height - top)) * 1.04)
      : 1;
    const x =
      ARENA.width / 2 +
      (inFlight ? (state.projectile.x - ARENA.width / 2) * 0.12 * zoom : 0);
    const y = (ARENA.height + top) / 2 - (inFlight ? 12 : 0);
    const factor = 1 - Math.exp(-dt / 180);
    this.centerX = Phaser.Math.Linear(this.centerX, x, factor);
    this.centerY = Phaser.Math.Linear(this.centerY, y, factor);
    this.camera.setZoom(Phaser.Math.Linear(this.camera.zoom, zoom, factor));
    this.camera.centerOn(this.centerX, this.centerY);
  }
}
