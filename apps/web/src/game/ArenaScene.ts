import {
  ARENA,
  abilityProjectile,
  type BattleView,
  CHARACTERS,
  PROJECTILES,
  shotTrajectory,
  soundCues,
  trajectory,
} from "@craft-ones/shared";
import * as Phaser from "phaser";
import { ArenaCamera } from "./ArenaCamera";
import { ArenaInput } from "./ArenaInput";
import { ArenaMap } from "./ArenaMap";
import { BattleEffects } from "./BattleEffects";
import { CharacterRig } from "./characters/CharacterRig";
import type { GameBridge } from "./GameBridge";
import { SoundBoard } from "./SoundBoard";

export type { GameBridge } from "./GameBridge";

export class ArenaScene extends Phaser.Scene {
  private ink!: Phaser.GameObjects.Graphics;
  private controls!: ArenaInput;
  private map!: ArenaMap;
  private effects!: BattleEffects;
  private director!: ArenaCamera;
  private rigKeys: string[] = [];
  private rigs: CharacterRig[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private lastPhase = "";
  private speakers!: SoundBoard;
  private heard: BattleView | null = null;
  private generation = -1;
  private firedAngle = -Math.PI / 4;

  constructor(private bridge: GameBridge) {
    super("arena");
  }
  preload() {
    CharacterRig.preload(this);
    ArenaMap.preload(this);
    for (const kind of Object.keys(PROJECTILES)) {
      this.load.svg(`weapon-${kind}`, `/art/weapons/${kind}.svg`);
      this.load.svg(
        `projectile-${kind}`,
        `/art/weapons/${kind}-projectile.svg`,
      );
    }
  }
  create() {
    this.map = new ArenaMap(this);
    this.ink = this.add.graphics().setDepth(5);
    this.controls = new ArenaInput(this, this.bridge);
    this.effects = new BattleEffects(this);
    this.director = new ArenaCamera(this.cameras.main);
    this.speakers = new SoundBoard(this.bridge.sound);
    // Browsers keep audio asleep until the player acts, and aiming is an act.
    this.input.on("pointerdown", () => this.speakers.resume());
    this.events.once("shutdown", () => this.speakers.dispose());
    this.labels = [0, 1].map(() =>
      this.add
        .text(0, 0, "", {
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
      this.map.invalidate();
      this.director.reset();
      this.lastPhase = "";
    }
    this.controls.update(dt);
    this.speakers.setEnabled(this.bridge.sound);
    if (this.generation !== -1) {
      if (this.heard?.turnNumber !== undefined)
        for (const cue of soundCues(this.heard, state, this.bridge.sessionId))
          this.speakers.play(cue);
      this.heard = state;
    }
    this.speakers.charge(this.controls.power());
    this.map.update(state);
    this.director.update(
      state,
      dt,
      this.bridge.focus,
      this.controls.power() > 0,
      this.bridge.hudInsets,
    );
    this.map.cover(this.cameras.main);
    const g = this.ink.clear();
    const power = this.controls.power();
    const owner = state.players.find((p) => p.sessionId === sessionId);
    const selectedShot =
      this.bridge.abilityAim && owner
        ? (abilityProjectile(owner.species) ?? this.bridge.weapon)
        : this.bridge.weapon;
    if (state.phase === "flying" && this.lastPhase !== "flying") {
      this.firedAngle = Math.atan2(state.projectile.vy, state.projectile.vx);
      const i = state.players.findIndex(
        (p) => p.sessionId === state.currentPlayer,
      );
      this.rigs[i]?.recoil();
    }
    this.lastPhase = state.phase;
    let aimImpact: { x: number; y: number } | undefined;
    state.players.forEach((player, i) => {
      const key = `${player.species}-${player.coat}`;
      if (this.rigKeys[i] !== key) {
        this.rigs[i]?.root.destroy();
        this.rigs[i] = new CharacterRig(this, player.species, player.coat);
        this.rigKeys[i] = key;
      }
      this.labels[i]?.setText(
        `${CHARACTERS[player.species].name.toUpperCase()} · P${player.number}`,
      );
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
      this.rigs[i]?.update(
        player,
        angle,
        active ? power : 0,
        dt,
        active && state.phase !== "aiming"
          ? state.projectile.kind
          : active
            ? selectedShot
            : "rocket",
      );
      this.labels[i]?.setPosition(player.x, player.y + 38);
      g.fillStyle(0x3b2b38, 0.18).fillEllipse(
        player.x,
        player.y + ARENA.playerRadius + 3,
        45,
        8,
      );
      if (player.shield > 0)
        g.lineStyle(2, 0xb4d9d2, 0.8).strokeEllipse(
          player.x,
          player.y - 15,
          64,
          83,
        );
      if (active && state.phase !== "finished") {
        const y =
          player.y -
          (player.species === "cuy" ? 76 : 103) +
          Math.sin(this.time.now / 180) * 2;
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
        // The walking range is anchored where the turn began, so show the
        // anchor and both edges: stepping back toward it hands the range back.
        const range = Math.max(0, ARENA.moveBudget - player.movementSpent);
        const feet = player.y + ARENA.playerRadius + 7;
        g.lineStyle(4, 0xf7e4ab, 0.34).lineBetween(
          player.originX - range,
          feet,
          player.originX + range,
          feet,
        );
        for (const side of [-1, 1]) {
          const edge = player.originX + side * range;
          g.lineStyle(5, 0xf7e4ab, 0.75).lineBetween(
            edge,
            feet - 22,
            edge,
            feet + 4,
          );
        }
        g.fillStyle(0xf7e4ab, 0.9).fillTriangle(
          player.originX - 8,
          feet - 20,
          player.originX + 8,
          feet - 20,
          player.originX,
          feet - 4,
        );
        if (this.bridge.showTrajectory) {
          const points = state.terrainRows.length
            ? shotTrajectory(
                state,
                state.players,
                player,
                this.controls.angle,
                power || 0.5,
                selectedShot,
              )
            : trajectory(state, player, this.controls.angle, power || 0.5);
          points.forEach((p, n) => {
            g.fillStyle(0x403c4b, 0.65 - (n / points.length) * 0.3).fillCircle(
              p.x,
              p.y,
              n % 2 === 0 ? 2.3 : 1.7,
            );
          });
          const end = points.at(-1);
          if (end) {
            g.lineStyle(2, 0x403c4b, 0.4).strokeCircle(end.x, end.y, 8);
            aimImpact = end;
          }
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
    canvas.dataset.cameraWidth = String(this.cameras.main.width);
    canvas.dataset.cameraHeight = String(this.cameras.main.height);
    canvas.dataset.cameraFrameWidth = String(this.director.frame.width);
    canvas.dataset.cameraFrameHeight = String(this.director.frame.height);
    canvas.dataset.cameraCenterX = String(
      this.cameras.main.scrollX + this.cameras.main.width / 2,
    );
    canvas.dataset.cameraCenterY = String(
      this.cameras.main.scrollY + this.cameras.main.height / 2,
    );
    // Where the previewed arc currently lands, the same circle the player sees.
    if (aimImpact) {
      canvas.dataset.aimImpactX = String(Math.round(aimImpact.x));
      canvas.dataset.aimImpactY = String(Math.round(aimImpact.y));
    } else {
      delete canvas.dataset.aimImpactX;
      delete canvas.dataset.aimImpactY;
    }
  }
}
