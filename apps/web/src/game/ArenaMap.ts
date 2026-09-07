import {
  ARENA,
  type BattleView,
  MAPS,
  terrainHeight,
} from "@craft-ones/shared";
import type Phaser from "phaser";

export class ArenaMap {
  private background: Phaser.GameObjects.Graphics;
  private ground: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private key = "";
  constructor(scene: Phaser.Scene) {
    this.background = scene.add.graphics().setDepth(-30);
    this.ground = scene.add.graphics().setDepth(-10);
    this.title = scene.add
      .text(26, 26, "", {
        fontFamily: "Arial",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#3b4948",
      })
      .setDepth(-5);
  }
  update(state: BattleView) {
    const key = `${state.mapId}:${state.terrain.join(",")}`;
    if (key === this.key) return;
    this.key = key;
    const coast = state.mapId === "coast";
    const palette = coast ? MAPS.coast : MAPS.andes;
    this.title.setText(
      `${palette.name.toUpperCase()}  /  ${coast ? "02" : "01"}`,
    );
    const bg = this.background.clear();
    bg.fillStyle(palette.sky).fillRect(-1000, -1200, 3000, 2000);
    bg.fillStyle(0xfff6c9, 0.8).fillCircle(778, 102, 44);
    bg.fillStyle(0xfff6c9, 0.2).fillCircle(778, 102, 58);
    for (const [x, y, scale] of [
      [135, 95, 1],
      [480, 65, 0.75],
      [665, 166, 0.6],
      [910, 44, 0.7],
    ]) {
      bg.fillStyle(0xffffff, 0.65)
        .fillEllipse(x, y, 110 * scale, 25 * scale)
        .fillCircle(x - 12 * scale, y - 10 * scale, 23 * scale)
        .fillCircle(x + 20 * scale, y - 7 * scale, 17 * scale);
    }
    if (coast) {
      bg.fillStyle(0xd5ad87).fillPoints(
        [
          { x: -100, y: 380 },
          { x: 0, y: 238 },
          { x: 175, y: 258 },
          { x: 236, y: 351 },
          { x: 420, y: 300 },
          { x: 510, y: 366 },
          { x: 790, y: 255 },
          { x: 1000, y: 280 },
          { x: 1100, y: 540 },
          { x: -100, y: 540 },
        ],
        true,
      );
      bg.fillStyle(0xca9775).fillPoints(
        [
          { x: -100, y: 380 },
          { x: 100, y: 330 },
          { x: 192, y: 366 },
          { x: 397, y: 354 },
          { x: 507, y: 428 },
          { x: 702, y: 370 },
          { x: 836, y: 312 },
          { x: 1100, y: 338 },
          { x: 1100, y: 540 },
          { x: -100, y: 540 },
        ],
        true,
      );
      bg.lineStyle(4, 0xf4d5a1, 0.5)
        .lineBetween(23, 275, 150, 290)
        .lineBetween(806, 290, 943, 299);
    } else {
      bg.fillStyle(0x88bcb6).fillPoints(
        [
          { x: -100, y: 420 },
          { x: 112, y: 166 },
          { x: 259, y: 350 },
          { x: 435, y: 124 },
          { x: 670, y: 382 },
          { x: 880, y: 170 },
          { x: 1100, y: 400 },
          { x: 1100, y: 540 },
          { x: -100, y: 540 },
        ],
        true,
      );
      bg.fillStyle(0xe4f0d9).fillTriangle(370, 204, 435, 124, 508, 207);
      bg.fillStyle(0x6f9f92).fillPoints(
        [
          { x: -100, y: 440 },
          { x: 128, y: 310 },
          { x: 275, y: 389 },
          { x: 587, y: 257 },
          { x: 824, y: 391 },
          { x: 1000, y: 301 },
          { x: 1100, y: 540 },
          { x: -100, y: 540 },
        ],
        true,
      );
      bg.fillStyle(0x89af83)
        .fillEllipse(220, 453, 680, 175)
        .fillEllipse(910, 454, 660, 146);
    }
    const g = this.ground.clear();
    const points = Array.from(state.terrain, (y, i) => ({
      x: i * ARENA.terrainStep,
      y,
    }));
    g.fillStyle(palette.earth).fillPoints(
      [...points, { x: ARENA.width, y: 850 }, { x: 0, y: 850 }],
      true,
    );
    g.lineStyle(9, 0x453e43, 0.7).strokePoints(points);
    g.lineStyle(6, palette.grass).strokePoints(points);
    g.lineStyle(2, coast ? 0xffd99a : 0xb5d881).strokePoints(
      points.map((p) => ({ x: p.x, y: p.y - 2 })),
    );
    for (let x = 22; x < ARENA.width; x += 67) {
      const y = terrainHeight(state.terrain, x);
      g.fillStyle(coast ? 0x8a5f53 : 0x523f3f, 0.35).fillRoundedRect(
        x,
        y + 28 + (x % 23),
        20,
        7,
        3,
      );
      g.fillStyle(coast ? 0xe4a271 : 0xa07856, 0.55).fillCircle(
        x + 24,
        y + 64,
        3,
      );
    }
    for (const x of [40, 115, 344, 590, 834, 914]) {
      const y = terrainHeight(state.terrain, x);
      g.lineStyle(3, coast ? 0x789376 : 0x4d784f)
        .lineBetween(x, y - 3, x - 4, y - 17)
        .lineBetween(x, y - 3, x + 5, y - 23)
        .lineBetween(x, y - 3, x + 12, y - 14);
      if (!coast) g.fillStyle(0xf8d997).fillCircle(x + 5, y - 23, 3);
    }
  }
}
