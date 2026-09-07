import { ARENA, trajectory } from "@craft-ones/shared";
import Phaser from "phaser";
import { ArenaCamera } from "./ArenaCamera";
import { ArenaInput } from "./ArenaInput";
import { ArenaMap } from "./ArenaMap";
import { BattleEffects } from "./BattleEffects";
import { CharacterRig } from "./characters/CharacterRig";
import type { GameBridge } from "./GameBridge";

export type { GameBridge } from "./GameBridge";

export class ArenaScene extends Phaser.Scene {
  private ink!: Phaser.GameObjects.Graphics;
  private controls!: ArenaInput;
  private map!: ArenaMap;
  private effects!: BattleEffects;
  private director!: ArenaCamera;
  private rigs: CharacterRig[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private lastPhase = "";
  private generation = -1;
  private firedAngle = -Math.PI / 4;

  constructor(private bridge: GameBridge) {
    super("arena");
  }
  preload() {
    CharacterRig.preload(this);
  }
  create() {
    this.map = new ArenaMap(this);
    this.ink = this.add.graphics().setDepth(5);
    this.controls = new ArenaInput(this, this.bridge);
    this.effects = new BattleEffects(this);
    this.director = new ArenaCamera(this.cameras.main);
    this.rigs = [
      new CharacterRig(this, "cuy"),
      new CharacterRig(this, "llama"),
    ];
    this.labels = [0, 1].map((i) =>
      this.add
        .text(0, 0, i === 0 ? "CUY" : "LLAMA", {
          fontFamily: "Arial",
          fontSize: "11px",
          fontStyle: "bold",
          color: "#fff2d3",
          backgroundColor: "#493d46",
          padding: { x: 7, y: 4 },
        })
        .setOrigin(0.5)
        .setDepth(12),
    );
  }
  update(_time: number, dt: number) {
    const { state, sessionId } = this.bridge;
    if (!state || !this.ink) return;
    if (this.generation !== this.bridge.generation) {
      this.generation = this.bridge.generation;
      this.effects.reset(state);
      this.lastPhase = "";
    }
    this.controls.update(dt);
    this.map.update(state);
    this.director.update(state, dt);
    const g = this.ink.clear();
    const power = this.controls.power();
    if (state.phase === "flying" && this.lastPhase !== "flying") {
      this.firedAngle = Math.atan2(state.projectile.vy, state.projectile.vx);
      const i = state.players.findIndex(
        (p) => p.sessionId === state.currentPlayer,
      );
      this.rigs[i]?.recoil();
    }
    this.lastPhase = state.phase;
    state.players.forEach((player, i) => {
      const active = state.currentPlayer === player.sessionId;
      const angle =
        active && state.phase === "flying"
          ? this.firedAngle
          : player.sessionId === sessionId
            ? this.controls.angle
            : player.number === 1
              ? -Math.PI / 4
              : (-3 * Math.PI) / 4;
      this.rigs[i]?.root.setVisible(true);
      this.rigs[i]?.update(player, angle, active ? power : 0, dt);
      this.labels[i]?.setPosition(player.x, player.y + 38);
      g.fillStyle(0x3b2b38, 0.18).fillEllipse(
        player.x,
        player.y + ARENA.playerRadius + 3,
        45,
        8,
      );
      if (active && state.phase !== "finished") {
        const y =
          player.y - (i === 0 ? 76 : 103) + Math.sin(this.time.now / 180) * 2;
        g.fillStyle(i === 0 ? 0xf5c367 : 0x6ad1b7).fillTriangle(
          player.x - 7,
          y,
          player.x + 7,
          y,
          player.x,
          y + 8,
        );
      }
      if (this.bridge.debug) {
        g.lineStyle(1, 0xef4263).strokeCircle(
          player.x,
          player.y,
          ARENA.playerRadius,
        );
        g.lineBetween(
          player.x - 4,
          player.y,
          player.x + 4,
          player.y,
        ).lineBetween(player.x, player.y - 4, player.x, player.y + 4);
      }
      if (player.sessionId === sessionId && this.controls.canFire()) {
        if (this.bridge.showTrajectory) {
          const points = trajectory(
            state,
            player,
            this.controls.angle,
            power || 0.5,
          );
          points.forEach((p, n) => {
            g.fillStyle(0x403c4b, 0.65 - (n / points.length) * 0.3).fillCircle(
              p.x,
              p.y,
              n % 2 === 0 ? 2.3 : 1.7,
            );
          });
          const end = points.at(-1);
          if (end) g.lineStyle(2, 0x403c4b, 0.4).strokeCircle(end.x, end.y, 8);
        }
        if (power > 0)
          g.lineStyle(3, 0xffef9f)
            .beginPath()
            .arc(
              player.x,
              player.y,
              32,
              -Math.PI / 2,
              -Math.PI / 2 + power * Math.PI * 2,
            )
            .strokePath();
      }
    });
    for (let i = state.players.length; i < 2; i++) {
      this.rigs[i]?.root.setVisible(false);
      this.labels[i]?.setVisible(false);
    }
    for (let i = 0; i < state.players.length; i++)
      this.labels[i]?.setVisible(true);
    this.effects.update(state);
    // Read-only camera diagnostics used by browser acceptance tests and the local lab.
    const canvas = this.game.canvas;
    canvas.dataset.cameraZoom = String(this.cameras.main.zoom);
    canvas.dataset.cameraScrollY = String(this.cameras.main.scrollY);
  }
}
