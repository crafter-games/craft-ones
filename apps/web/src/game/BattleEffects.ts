import { type BattleView, WEAPONS } from "@craft-ones/shared";
import type * as Phaser from "phaser";
import { WEAPON_ART } from "./weapons/design";

export class BattleEffects {
  private ink: Phaser.GameObjects.Graphics;
  private projectile: Phaser.GameObjects.Image;
  private fuse: Phaser.GameObjects.Text;
  private trail: { x: number; y: number }[] = [];
  private explosionId = 0;
  private hp = [100, 100];
  constructor(private scene: Phaser.Scene) {
    this.ink = scene.add.graphics().setDepth(15);
    this.fuse = scene.add
      .text(0, 0, "", {
        fontFamily: "Arial",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#fff4c8",
        stroke: "#45332d",
        strokeThickness: 4,
      })
      .setDepth(22)
      .setOrigin(0.5);
    this.projectile = scene.add
      .image(0, 0, "projectile-rocket")
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
    this.projectile.setVisible(p.active);
    this.fuse.setVisible(
      p.active &&
        (p.kind === "grenade" || p.kind === "dynamite" || p.kind === "sticky"),
    );
    if (p.active) {
      const size = WEAPON_ART[p.kind].shotSize;
      this.projectile
        .setTexture(`projectile-${p.kind}`)
        .setDisplaySize(size[0], size[1])
        .setPosition(p.x, p.y)
        .setRotation(
          p.kind === "grenade" || p.kind === "dynamite" || p.kind === "sticky"
            ? p.stuck
              ? 0
              : p.elapsedMs / 180
            : Math.atan2(p.vy, p.vx),
        );
      this.fuse
        .setPosition(p.x, p.y - 29)
        .setText(
          `${Math.max(0, (WEAPONS[p.kind].fuse - p.elapsedMs) / 1000).toFixed(1)}s`,
        );
    }
    if ((p.active && p.kind === "grapple") || state.phase === "grappling") {
      const owner = state.players.find(
        (player) => player.sessionId === state.currentPlayer,
      );
      if (owner) {
        g.lineStyle(4, 0x4c473b).lineBetween(owner.x, owner.y, p.x, p.y);
        g.lineStyle(1, 0xe9cf9f).lineBetween(owner.x, owner.y, p.x, p.y);
      }
    }
    if (p.active) {
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
      this.burst(state.explosion.x, state.explosion.y, state.explosion.radius);
    }
    state.players.forEach((player, i) => {
      const damage = (this.hp[i] ?? 100) - player.hp;
      if (damage !== 0) {
        const text = this.scene.add
          .text(
            player.x,
            player.y - 68,
            damage > 0 ? `−${damage}` : `+${-damage}`,
            {
              fontFamily: "Arial",
              fontSize: "25px",
              fontStyle: "bold",
              color: "#fff9db",
              stroke: damage > 0 ? "#713e49" : "#3c805e",
              strokeThickness: 5,
            },
          )
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
  private burst(x: number, y: number, radius: number) {
    this.scene.cameras.main.shake(140, 0.003);
    const ring = this.scene.add
      .circle(x, y, 10, 0xffedac, 0.7)
      .setStrokeStyle(3, 0xfff6d1)
      .setDepth(25);
    this.scene.tweens.add({
      targets: ring,
      scale: radius / 10,
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
