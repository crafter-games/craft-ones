import {
  ARENA,
  type BattleView,
  CELL,
  contourPaths,
  PLAYABLE_MAP_IDS,
  terrainContours,
  WORLD_HEIGHT,
  WORLD_MAPS,
  WORLD_WIDTH,
} from "@craft-ones/shared";
import type * as Phaser from "phaser";

export class ArenaMap {
  private background: Phaser.GameObjects.Image;
  private terrain: Phaser.GameObjects.Image;
  private texture: Phaser.Textures.CanvasTexture;
  private key = "";
  private world = { width: WORLD_WIDTH, height: WORLD_HEIGHT };
  constructor(private scene: Phaser.Scene) {
    this.background = scene.add
      .image(0, 0, `map-${PLAYABLE_MAP_IDS[0]}`)
      .setOrigin(0)
      .setDepth(-30);
    scene.textures.remove("live-terrain");
    const texture = scene.textures.createCanvas(
      "live-terrain",
      WORLD_WIDTH,
      WORLD_HEIGHT,
    );
    if (!texture) throw new Error("Terrain texture unavailable");
    this.texture = texture;
    this.terrain = scene.add
      .image(0, 0, "live-terrain")
      .setOrigin(0)
      .setDepth(-10);
  }
  static preload(scene: Phaser.Scene) {
    for (const id of PLAYABLE_MAP_IDS)
      scene.load.svg(`map-${id}`, `/art/${WORLD_MAPS[id].background}`);
  }
  /**
   * Stretch the painted scenery over whatever the camera can see. Pulling back
   * to frame the whole map leaves room around the world, and the sky, hills and
   * clouds have to reach the edges instead of stopping at a visible seam.
   */
  cover(camera: Phaser.Cameras.Scene2D.Camera) {
    const view = camera.worldView;
    const left = Math.min(0, view.x);
    const top = Math.min(0, view.y);
    const right = Math.max(this.world.width, view.right);
    const bottom = Math.max(this.world.height, view.bottom);
    this.background.setPosition(left, top);
    this.background.setDisplaySize(right - left, bottom - top);
  }
  update(state: BattleView) {
    const key = `${state.mapId}:${state.terrainRevision}:${state.terrainRows.length}`;
    if (key === this.key) return;
    this.key = key;
    const id =
      PLAYABLE_MAP_IDS.find((id) => id === state.mapId) ?? PLAYABLE_MAP_IDS[0];
    const palette = WORLD_MAPS[id].palette;
    this.scene.cameras.main.setBackgroundColor(palette.sky);
    this.world = { width: state.worldWidth, height: state.worldHeight };
    this.background.setTexture(`map-${id}`);
    const ctx = this.texture.context,
      w = state.worldWidth,
      h = state.worldHeight;
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    const { earth, shade, light } = palette;
    ctx.fillStyle = earth;
    const rows = state.terrainRows;
    const contours = contourPaths(terrainContours(rows));
    const land = new Path2D(contours.land);
    if (!rows.length) {
      ctx.beginPath();
      ctx.moveTo(0, h);
      state.terrain.forEach((y, i) => {
        ctx.lineTo(i * ARENA.terrainStep, y);
      });
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    } else ctx.fill(land, "evenodd");
    // Clip broad bands and faceted stones into the authoritative occupancy silhouette.
    ctx.globalCompositeOperation = "source-atop";
    for (let y = 300; y < h + 160; y += 96) {
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < w; x += 256)
        ctx.quadraticCurveTo(
          x + 128,
          y - 22 + ((x / 256) % 2) * 44,
          x + 256,
          y,
        );
      ctx.lineTo(w, y + 34);
      for (let x = w; x > 0; x -= 256)
        ctx.quadraticCurveTo(
          x - 128,
          y + 12 + ((x / 256) % 2) * 44,
          x - 256,
          y + 34,
        );
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.moveTo(0, y + 68);
      for (let x = 0; x < w; x += 384)
        ctx.quadraticCurveTo(x + 192, y + 48, x + 384, y + 68);
      ctx.lineTo(w, y + 79);
      ctx.lineTo(0, y + 79);
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
      // Continuous contours follow occupancy within a cell, including fresh craters.
      ctx.save();
      ctx.clip(land, "evenodd");
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = palette.outline;
      ctx.lineWidth = 10;
      ctx.stroke(land);
      const rim = new Path2D(contours.rim);
      ctx.strokeStyle = palette.rim;
      ctx.lineWidth = 14;
      ctx.stroke(rim);
      ctx.strokeStyle = palette.rimLight;
      ctx.lineWidth = 4;
      ctx.stroke(rim);
      ctx.restore();
      // Sparse, rounded grass blades only on broad horizontal ledges.
      ctx.strokeStyle = palette.tuft;
      ctx.lineWidth = 2;
      for (let col = 4; palette.foliage && col < w / CELL - 4; col += 19)
        for (let row = 32; row < rows.length - 1; row++) {
          if (
            ![col - 2, col - 1, col, col + 1, col + 2].every(
              (x) => rows[row][x] === "1" && rows[row - 1]?.[x] === "0",
            )
          )
            continue;
          const x = col * CELL + 4,
            y = row * CELL;
          ctx.beginPath();
          ctx.moveTo(x - 4, y);
          ctx.quadraticCurveTo(x - 5, y - 6, x - 9, y - 8);
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + 1, y - 10, x + 5, y - 12);
          ctx.stroke();
        }
    } else {
      ctx.strokeStyle = palette.rim;
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
