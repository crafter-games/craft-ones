import {
  ARENA,
  abilityProjectile,
  type BattleView,
  CHARACTERS,
  isMovementAbility,
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
  private rigs: (CharacterRig | undefined)[] = [];
  private queuedRigs = new Set<string>();
  private initialized = false;
  private loadFailed = false;
  private labels: Phaser.GameObjects.Text[] = [];
  /** Marks the viewer's own character; the bouncing arrow marks the turn. */
  private youTag?: Phaser.GameObjects.Text;
  private lastPhase = "";
  private speakers!: SoundBoard;
  private heard: BattleView | null = null;
  private generation = -1;
  private firedAngle = -Math.PI / 4;
  private lastFrame = 0;

  constructor(
    private bridge: GameBridge,
    private onLoadError: () => void,
  ) {
    super("arena");
  }
  preload() {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
      this.loadFailed = true;
      this.bridge.ready = false;
      this.game.canvas.dataset.ready = "false";
      this.onLoadError();
    });
    const players = this.bridge.state?.players ?? [];
    CharacterRig.preload(this, players);
    for (const player of players)
      this.queuedRigs.add(`${player.species}-${player.coat}`);
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
    this.lastFrame = performance.now();
    this.bridge.ready = false;
    this.game.canvas.dataset.ready = "false";
    this.map = new ArenaMap(this);
    this.ink = this.add.graphics().setDepth(5);
    this.controls = new ArenaInput(this, this.bridge);
    this.effects = new BattleEffects(this);
    this.director = new ArenaCamera(this.cameras.main);
    this.speakers = new SoundBoard(this.bridge.sound);
    // Browsers keep audio asleep until the player acts, and aiming is an act.
    this.input.on("pointerdown", () => this.speakers.resume());
    const disposeSpeakers = () => {
      this.events.off("shutdown", disposeSpeakers);
      this.events.off("destroy", disposeSpeakers);
      this.speakers.dispose();
    };
    this.events.once("shutdown", disposeSpeakers);
    this.events.once("destroy", disposeSpeakers);
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
    this.youTag = this.add
      .text(0, 0, "YOU", {
        fontFamily: "Arial",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#3c3033",
        backgroundColor: "#fff1d6",
        padding: { x: 7, y: 3 },
      })
      .setOrigin(0.5, 1)
      .setDepth(12)
      .setVisible(false);
  }
  update(_time: number, dt: number) {
    const now = performance.now();
    const cameraDt = now - this.lastFrame;
    this.lastFrame = now;
    const { state, sessionId } = this.bridge;
    if (!state || !this.ink || this.loadFailed) return;
    if (this.generation !== this.bridge.generation) {
      this.generation = this.bridge.generation;
      this.effects.reset(state);
      this.map.invalidate();
      this.director.reset();
      this.lastPhase = "";
    }
    const charactersReady =
      state.players.length > 0 &&
      state.players.every((player) => CharacterRig.loaded(this, player));
    this.bridge.ready = this.initialized && charactersReady;
    this.game.canvas.dataset.ready = String(this.bridge.ready);
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
      cameraDt,
      this.bridge.view,
      this.controls.power() > 0,
      this.bridge.hudInsets,
    );
    this.map.cover(this.cameras.main);
    const g = this.ink.clear();
    const power = this.controls.power();
    const owner = state.players.find((p) => p.sessionId === sessionId);
    const movementAbility =
      this.bridge.abilityAim && owner && isMovementAbility(owner.species)
        ? owner.species
        : null;
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
    let youShown = false;
    state.players.forEach((player, i) => {
      const key = `${player.species}-${player.coat}`;
      if (this.rigKeys[i] !== key) {
        this.rigs[i]?.root.destroy();
        this.rigs[i] = undefined;
        this.rigKeys[i] = "";
        if (!CharacterRig.loaded(this, player)) {
          this.labels[i]?.setVisible(false);
          if (!this.queuedRigs.has(key)) {
            this.queuedRigs.add(key);
            CharacterRig.preload(this, [player]);
            if (!this.load.isLoading()) this.load.start();
          }
          return;
        }
        this.labels[i]?.setVisible(true);
        this.rigs[i] = new CharacterRig(this, player.species, player.coat);
        this.rigKeys[i] = key;
      }
      const mine = !this.bridge.local && player.sessionId === sessionId;
      const role = this.bridge.local ? "" : mine ? " · YOU" : " · OPPONENT";
      this.labels[i]?.setText(
        `${CHARACTERS[player.species].name.toUpperCase()} · P${player.number}${role}`,
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
      // Labels keep their screen size so they stay readable at any zoom.
      const zoom = this.cameras.main.zoom;
      this.labels[i]
        ?.setPosition(player.x, player.y + 22 + 16 / zoom)
        .setScale(1 / zoom);
      const headTop = player.y - (player.species === "cuy" ? 76 : 103);
      if (mine && this.rigs[i]) {
        youShown = true;
        this.youTag
          ?.setPosition(player.x, headTop - 18 / zoom)
          .setScale(1 / zoom);
      }
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
        const y = headTop + Math.sin(this.time.now / 180) * 2;
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
        const range = ARENA.moveBudget;
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
        if (movementAbility) {
          const direction = Math.cos(this.controls.angle) >= 0 ? 1 : -1;
          const lift =
            movementAbility === "zorro"
              ? 0
              : movementAbility === "puma"
                ? 72
                : 118;
          const distance =
            movementAbility === "zorro"
              ? 185
              : movementAbility === "puma"
                ? 155
                : 125;
          const startX = player.x + direction * 38;
          const startY = player.y - 28;
          const endX = player.x + direction * distance;
          const endY = player.y - 28 - lift;
          const arrowAngle = Math.atan2(endY - startY, endX - startX);
          const wing = 18;
          g.lineStyle(9, 0x292733, 0.92).lineBetween(
            startX,
            startY,
            endX,
            endY,
          );
          g.lineStyle(5, 0xffdf82, 1).lineBetween(startX, startY, endX, endY);
          g.fillStyle(0x292733, 1).fillTriangle(
            endX + Math.cos(arrowAngle) * 4,
            endY + Math.sin(arrowAngle) * 4,
            endX - Math.cos(arrowAngle - 0.62) * (wing + 5),
            endY - Math.sin(arrowAngle - 0.62) * (wing + 5),
            endX - Math.cos(arrowAngle + 0.62) * (wing + 5),
            endY - Math.sin(arrowAngle + 0.62) * (wing + 5),
          );
          g.fillStyle(0xffdf82, 1).fillTriangle(
            endX,
            endY,
            endX - Math.cos(arrowAngle - 0.62) * wing,
            endY - Math.sin(arrowAngle - 0.62) * wing,
            endX - Math.cos(arrowAngle + 0.62) * wing,
            endY - Math.sin(arrowAngle + 0.62) * wing,
          );
        } else {
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
          const visiblePoints = this.bridge.showTrajectory
            ? points
            : points.slice(0, 5);
          visiblePoints.forEach((p, n) => {
            const fade = this.bridge.showTrajectory
              ? 0.96 - (n / points.length) * 0.16
              : 0.9 - (n / Math.max(1, visiblePoints.length - 1)) * 0.62;
            g.fillStyle(0x292733, fade).fillCircle(
              p.x,
              p.y,
              n % 2 === 0 ? 3 : 2.25,
            );
          });
          const end = points.at(-1);
          if (end) {
            if (this.bridge.showTrajectory)
              g.lineStyle(3, 0x292733, 0.9).strokeCircle(end.x, end.y, 8);
            // Non-visual diagnostic for repeatable browser acceptance shots.
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
    this.youTag?.setVisible(youShown);
    for (let i = 0; i < state.players.length; i++)
      this.labels[i]?.setVisible(!!this.rigs[i]);
    this.effects.update(state);
    // Read-only camera diagnostics used by browser acceptance tests and the local lab.
    const canvas = this.game.canvas;
    canvas.dataset.characterKeys = this.rigKeys
      .slice(0, state.players.length)
      .join(",");
    canvas.dataset.projectileElapsed = String(state.projectile.elapsedMs);
    canvas.dataset.projectileX = String(state.projectile.x);
    canvas.dataset.projectileY = String(state.projectile.y);
    canvas.dataset.explosionX = String(state.explosion.x);
    canvas.dataset.explosionY = String(state.explosion.y);
    canvas.dataset.cameraZoom = String(this.cameras.main.zoom);
    canvas.dataset.cameraScrollY = String(this.cameras.main.scrollY);
    canvas.dataset.cameraWidth = String(this.cameras.main.width);
    canvas.dataset.cameraHeight = String(this.cameras.main.height);
    canvas.dataset.cameraFrameWidth = String(this.director.frame.width);
    canvas.dataset.cameraFrameHeight = String(this.director.frame.height);
    canvas.dataset.trajectoryMode = this.bridge.showTrajectory
      ? "full"
      : "launch";
    canvas.dataset.cameraCenterX = String(
      this.cameras.main.scrollX + this.cameras.main.width / 2,
    );
    canvas.dataset.cameraCenterY = String(
      this.cameras.main.scrollY + this.cameras.main.height / 2,
    );
    if (movementAbility)
      canvas.dataset.abilityDirection =
        Math.cos(this.controls.angle) >= 0 ? "right" : "left";
    else delete canvas.dataset.abilityDirection;
    // Where the previewed arc currently lands, the same circle the player sees.
    if (aimImpact) {
      canvas.dataset.aimImpactX = String(Math.round(aimImpact.x));
      canvas.dataset.aimImpactY = String(Math.round(aimImpact.y));
    } else {
      delete canvas.dataset.aimImpactX;
      delete canvas.dataset.aimImpactY;
    }
    if (!this.initialized && charactersReady) {
      this.initialized = true;
      this.bridge.ready = true;
      canvas.dataset.ready = "true";
      if (!this.bridge.suspended) canvas.focus({ preventScroll: true });
    }
  }
}
