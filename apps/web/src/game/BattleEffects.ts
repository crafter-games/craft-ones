import { ARENA, type BattleView } from "@craft-ones/shared";
import type Phaser from "phaser";

export class BattleEffects {
  private ink: Phaser.GameObjects.Graphics;
  private rocket: Phaser.GameObjects.Container;
  private trail: { x: number; y: number }[] = [];
  private explosionId = 0;
  private hp = [100, 100];
  constructor(private scene: Phaser.Scene) {
    this.ink = scene.add.graphics().setDepth(15);
    const rocket = scene.add.graphics();
    rocket.fillStyle(0xffbe70).fillTriangle(-8, -4, -18, 0, -8, 4);
    rocket.fillStyle(0x3b2b38).fillRoundedRect(-10, -5, 20, 10, 4);
    rocket.fillStyle(0xe6eee0).fillRoundedRect(-8, -3, 14, 6, 2);
    rocket.fillStyle(0xf18467).fillTriangle(5, -5, 13, 0, 5, 5);
    rocket.fillStyle(0x719f99).fillTriangle(-7, 0, -13, 8, -3, 4);
    this.rocket = scene.add
      .container(0, 0, [rocket])
      .setDepth(20)
      .setVisible(false);
  }
  reset(state: BattleView) {
    this.hp = state.players.map((p) => p.hp);
    this.explosionId = state.explosion.id;
    this.trail = [];
  }
  update(state: BattleView) {
    const g = this.ink.clear();
    const p = state.projectile;
    this.rocket.setVisible(p.active);
    if (p.active) {
      this.rocket.setPosition(p.x, p.y).setRotation(Math.atan2(p.vy, p.vx));
      const last = this.trail.at(-1);
      if (!last || last.x !== p.x || last.y !== p.y)
        this.trail.push({ x: p.x, y: p.y });
      if (this.trail.length > 24) this.trail.shift();
      this.trail.forEach((point, i) => {
        g.fillStyle(0xfff5d8, (i / this.trail.length) * 0.6).fillCircle(
          point.x,
          point.y,
          2 + (1 - i / this.trail.length) * 5,
        );
      });
    } else this.trail = [];
    if (state.explosion.id !== this.explosionId) {
      this.explosionId = state.explosion.id;
      this.burst(state.explosion.x, state.explosion.y);
    }
    state.players.forEach((player, i) => {
      const damage = (this.hp[i] ?? 100) - player.hp;
      if (damage > 0) {
        const text = this.scene.add
          .text(player.x, player.y - 68, `−${damage}`, {
            fontFamily: "Arial",
            fontSize: "25px",
            fontStyle: "bold",
            color: "#fff9db",
            stroke: "#713e49",
            strokeThickness: 5,
          })
          .setOrigin(0.5)
          .setDepth(40);
        this.scene.tweens.add({
          targets: text,
          y: text.y - 45,
          alpha: 0,
          duration: 1100,
          ease: "Cubic.Out",
          onComplete: () => text.destroy(),
        });
      }
      this.hp[i] = player.hp;
    });
  }
  private burst(x: number, y: number) {
    this.scene.cameras.main.shake(140, 0.003);
    const ring = this.scene.add
      .circle(x, y, 10, 0xffedac, 0.7)
      .setStrokeStyle(3, 0xfff6d1)
      .setDepth(25);
    this.scene.tweens.add({
      targets: ring,
      scale: ARENA.blastRadius / 10,
      alpha: 0,
      duration: 420,
      ease: "Cubic.Out",
      onComplete: () => ring.destroy(),
    });
    for (let i = 0; i < 20; i++) {
      const angle = i * 2.399;
      const distance = 24 + (i % 5) * 17;
      const part = this.scene.add
        .circle(
          x,
          y,
          3 + (i % 5),
          i % 3 === 0 ? 0x786362 : i % 3 === 1 ? 0xffb35f : 0xffedac,
        )
        .setDepth(24);
      this.scene.tweens.add({
        targets: part,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - 18,
        scale: 0.15,
        alpha: 0,
        duration: 380 + (i % 5) * 100,
        ease: "Cubic.Out",
        onComplete: () => part.destroy(),
      });
    }
  }
}
