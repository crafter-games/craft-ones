import { ARENA, type BattleView, CELL, MAPS } from "@craft-ones/shared";
import type * as Phaser from "phaser";

export class ArenaMap {
  private background: Phaser.GameObjects.Image;
  private terrain: Phaser.GameObjects.Image;
  private texture: Phaser.Textures.CanvasTexture;
  private key = "";
  constructor(private scene: Phaser.Scene) {
    this.background = scene.add
      .image(0, 0, "map-andes")
      .setOrigin(0)
      .setDepth(-30);
    scene.textures.remove("live-terrain");
    const texture = scene.textures.createCanvas("live-terrain", 1792, 1024);
    if (!texture) throw new Error("Terrain texture unavailable");
    this.texture = texture;
    this.terrain = scene.add
      .image(0, 0, "live-terrain")
      .setOrigin(0)
      .setDepth(-10);
  }
  static preload(scene: Phaser.Scene) {
    for (const id of ["andes", "coast"])
      scene.load.svg(`map-${id}`, `/art/maps/${id}.svg`);
  }
  update(state: BattleView) {
    const key = `${state.mapId}:${state.terrainRevision}:${state.terrainRows.length}`;
    if (key === this.key) return;
    this.key = key;
    const coast = state.mapId === "coast";
    this.scene.cameras.main.setBackgroundColor(coast ? "#edbd9c" : "#bcdfce");
    this.background
      .setTexture(coast ? "map-coast" : "map-andes")
      .setDisplaySize(state.worldWidth, state.worldHeight);
    const ctx = this.texture.context,
      w = state.worldWidth,
      h = state.worldHeight;
    ctx.clearRect(0, 0, 1792, 1024);
    const earth = coast ? "#a56b50" : "#78513f",
      shade = coast ? "#825443" : "#543e36",
      light = coast ? "#c28a61" : "#956447";
    ctx.fillStyle = earth;
    const rows = state.terrainRows;
    if (!rows.length) {
      ctx.beginPath();
      ctx.moveTo(0, h);
      state.terrain.forEach((y, i) => {
        ctx.lineTo(i * ARENA.terrainStep, y);
      });
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    } else
      for (let y = 0; y < rows.length; y++) {
        let start = -1;
        for (let x = 0; x <= rows[y].length; x++) {
          if (rows[y][x] === "1" && start < 0) start = x;
          if (rows[y][x] !== "1" && start >= 0) {
            ctx.fillRect(start * CELL, y * CELL, (x - start) * CELL, CELL);
            start = -1;
          }
        }
      }
    // Clip broad bands and faceted stones into the authoritative occupancy silhouette.
    ctx.globalCompositeOperation = "source-atop";
    for (let y = 300; y < h + 160; y += 96) {
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 128)
        ctx.lineTo(x, y + (((x / 128) * 37 + y) % 61));
      ctx.lineTo(w, y + 54);
      for (let x = w; x >= 0; x -= 128)
        ctx.lineTo(x, y + 33 + (((x / 128) * 23 + y) % 51));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.moveTo(0, y + 68);
      for (let x = 0; x <= w; x += 160)
        ctx.lineTo(x, y + 60 + ((x * 7 + y) % 31));
      ctx.lineTo(w, y + 81);
      ctx.lineTo(0, y + 89);
      ctx.closePath();
      ctx.fill();
    }
    for (let i = 0; i < 210; i++) {
      const x = (i * 157 + 32) % w,
        y = 400 + ((i * 83) % (h - 390)),
        r = 5 + (i % 12);
      ctx.fillStyle = i % 2 ? shade : light;
      ctx.beginPath();
      ctx.moveTo(x - r, y);
      ctx.lineTo(x - r / 2, y - r / 2);
      ctx.lineTo(x + r * 0.6, y - r * 0.6);
      ctx.lineTo(x + r, y + 2);
      ctx.lineTo(x + r * 0.4, y + r * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = earth;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - r / 2, y - r / 2);
      ctx.lineTo(x + r * 0.6, y - r * 0.6);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    if (rows.length) {
      // Every rim follows actual terrain, including newly exposed crater and cave walls.
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      const edges = (
        top: boolean,
        color: string,
        width: number,
        offset: number,
      ) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (let row = 0; row < rows.length; row++)
          for (let col = 0; col < rows[row].length; col++) {
            if (rows[row][col] !== "1") continue;
            const neighbor = rows[row + (top ? -1 : 1)]?.[col];
            if (neighbor !== "1") {
              const y = (row + (top ? 0 : 1)) * CELL + offset;
              ctx.moveTo(col * CELL, y);
              ctx.lineTo((col + 1) * CELL, y);
            }
          }
        ctx.stroke();
      };
      edges(true, "#493b33", 9, 3);
      edges(false, "#48372f", 6, -2);
      edges(true, coast ? "#dba56d" : "#77914c", 7, 0);
      edges(true, coast ? "#f3cc8e" : "#b1ce74", 2, -2);
      // Tiny foliage tufts only along stable upward faces, never floating over holes.
      ctx.strokeStyle = coast ? "#a1a365" : "#577e42";
      ctx.lineWidth = 3;
      for (let col = 4; col < w / CELL; col += 11)
        for (let row = 32; row < rows.length - 1; row++) {
          if (rows[row][col] !== "1" || rows[row - 1]?.[col] === "1") continue;
          const x = col * CELL + 4,
            y = row * CELL;
          ctx.beginPath();
          ctx.moveTo(x - 6, y - 2);
          ctx.lineTo(x - 11, y - 13);
          ctx.lineTo(x - 1, y - 6);
          ctx.lineTo(x + 1, y - 18);
          ctx.lineTo(x + 5, y - 5);
          ctx.lineTo(x + 12, y - 11);
          ctx.stroke();
        }
    } else {
      ctx.strokeStyle = `#${MAPS[coast ? "coast" : "andes"].grass.toString(16)}`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      state.terrain.forEach((y, i) => {
        if (i) ctx.lineTo(i * ARENA.terrainStep, y);
        else ctx.moveTo(0, y);
      });
      ctx.stroke();
    }
    this.texture.refresh();
    this.terrain.setVisible(true);
  }
  invalidate() {
    this.key = "";
  }
}
