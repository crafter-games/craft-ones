import { ARENA, type BattleView, type FireAction } from "@craft-ones/shared";
import Phaser from "phaser";

export type GameBridge = {
  state: BattleView | null;
  sessionId: string;
  connected: boolean;
  fire: (action: FireAction) => void;
  charge: (power: number) => void;
};

export class ArenaScene extends Phaser.Scene {
  private ink!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private angle = -Math.PI / 4;
  private chargeStart = 0;
  private charging = false;
  private chargePointer = -1;
  private lastTurn = -1;
  private sentTurn = -1;
  private lastPower = -1;
  private explosionId = 0;
  private explodedAt = 0;
  private trail: { x: number; y: number }[] = [];

  constructor(private bridge: GameBridge) {
    super("arena");
  }

  create() {
    this.cameras.main.setBackgroundColor("#1c261e");
    const background = this.add.graphics();
    background.lineStyle(1, 0xa3aca0, 0.07);
    for (let x = 0; x < ARENA.width; x += 40)
      background.lineBetween(x, 0, x, ARENA.groundY);
    for (let y = 0; y < ARENA.groundY; y += 40)
      background.lineBetween(0, y, ARENA.width, y);
    background.fillStyle(0xd2fb78, 0.04).fillCircle(780, 100, 58);
    background
      .fillStyle(0x253426)
      .fillRect(0, ARENA.groundY, ARENA.width, ARENA.height - ARENA.groundY);
    background
      .lineStyle(2, 0x657e4e)
      .lineBetween(0, ARENA.groundY, ARENA.width, ARENA.groundY);
    this.add.text(24, 24, "THE PROVING GROUND / FLATLAND 01", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#a3aca0",
    });
    this.ink = this.add.graphics();
    this.labels = [0, 1].map(() =>
      this.add
        .text(0, 0, "", { fontFamily: "monospace", fontSize: "12px" })
        .setOrigin(0.5),
    );
    const canvas = this.game.canvas;
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute(
      "aria-label",
      "Battle arena. Aim with mouse or touch, hold to charge, release to fire. Keyboard: left/right to aim, hold and release Space to fire.",
    );
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) =>
      this.aim(pointer),
    );
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.charging || !this.canFire() || !pointer.leftButtonDown()) return;
      canvas.focus({ preventScroll: true });
      this.aim(pointer);
      this.chargePointer = pointer.id;
      this.beginCharge();
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.chargePointer) this.shoot();
    });
    this.input.on("pointerupoutside", () => this.cancel());
    const cancel = () => this.cancel();
    const keyDown = (event: KeyboardEvent) => {
      if (!["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) return;
      event.preventDefault();
      if (event.code === "Space" && !event.repeat && this.canFire())
        this.beginCharge();
      if (this.canFire() && event.code !== "Space") {
        this.angle = Phaser.Math.Angle.Wrap(
          this.angle + (event.code === "ArrowLeft" ? -0.025 : 0.025),
        );
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        this.shoot();
      }
    };
    canvas.addEventListener("keydown", keyDown);
    canvas.addEventListener("keyup", keyUp);
    canvas.addEventListener("pointercancel", cancel);
    canvas.addEventListener("blur", cancel);
    window.addEventListener("blur", cancel);
    this.events.once("shutdown", () => {
      canvas.removeEventListener("keydown", keyDown);
      canvas.removeEventListener("keyup", keyUp);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("blur", cancel);
      window.removeEventListener("blur", cancel);
    });
  }

  private canFire() {
    const { state, sessionId, connected } = this.bridge;
    return (
      connected &&
      state?.phase === "aiming" &&
      state.currentPlayer === sessionId &&
      state.remainingMs > 0 &&
      this.sentTurn !== state.turnNumber
    );
  }

  private aim(pointer: Phaser.Input.Pointer) {
    if (!this.canFire() || (this.charging && pointer.id !== this.chargePointer))
      return;
    const player = this.bridge.state?.players.find(
      (p) => p.sessionId === this.bridge.sessionId,
    );
    if (player)
      this.angle = Math.atan2(
        pointer.worldY - player.y,
        pointer.worldX - player.x,
      );
  }

  private beginCharge() {
    if (this.charging) return;
    this.chargeStart = performance.now();
    this.charging = true;
  }

  private power() {
    return this.charging
      ? Math.min(1, (performance.now() - this.chargeStart) / 1400)
      : 0;
  }

  private shoot() {
    if (this.charging && this.canFire() && this.bridge.state) {
      this.sentTurn = this.bridge.state.turnNumber;
      this.bridge.fire({
        angle: this.angle,
        power: this.power(),
        turnNumber: this.sentTurn,
      });
    }
    this.cancel();
  }

  private cancel() {
    this.charging = false;
    this.chargePointer = -1;
    this.reportPower(0);
  }

  private reportPower(value: number) {
    const rounded = Math.round(value * 100);
    if (rounded !== this.lastPower) {
      this.lastPower = rounded;
      this.bridge.charge(rounded);
    }
  }

  update() {
    const { state, sessionId } = this.bridge;
    if (!state || !this.ink) return;
    if (state.turnNumber !== this.lastTurn) {
      this.lastTurn = state.turnNumber;
      this.cancel();
      const me = state.players.find((p) => p.sessionId === sessionId);
      this.angle = me?.number === 2 ? (-3 * Math.PI) / 4 : -Math.PI / 4;
    }
    if (!this.canFire() && this.charging) this.cancel();
    const power = this.power();
    this.reportPower(power);
    const g = this.ink.clear();
    state.players.forEach((player, i) => {
      const color = player.number === 1 ? 0xd2fb78 : 0xd7b7ff;
      if (
        state.currentPlayer === player.sessionId &&
        state.phase !== "finished"
      ) {
        g.lineStyle(2, color, 0.3).strokeCircle(player.x, player.y, 27);
        g.fillStyle(color).fillTriangle(
          player.x - 5,
          player.y - 42,
          player.x + 5,
          player.y - 42,
          player.x,
          player.y - 35,
        );
      }
      g.fillStyle(0x000000, 0.2).fillEllipse(
        player.x,
        ARENA.groundY + 5,
        45,
        9,
      );
      g.fillStyle(color, player.hp > 0 ? 1 : 0.25).fillCircle(
        player.x,
        player.y,
        ARENA.playerRadius,
      );
      const aim =
        player.sessionId === sessionId
          ? this.angle
          : player.number === 1
            ? -Math.PI / 4
            : (-3 * Math.PI) / 4;
      g.lineStyle(8, color, player.hp > 0 ? 1 : 0.25).lineBetween(
        player.x,
        player.y,
        player.x + Math.cos(aim) * 28,
        player.y + Math.sin(aim) * 28,
      );
      this.labels[i]
        ?.setPosition(player.x, ARENA.groundY + 32)
        .setText(
          `P${player.number}${player.sessionId === sessionId ? " / YOU" : ""}`,
        )
        .setColor(player.number === 1 ? "#d2fb78" : "#d7b7ff");
      if (player.sessionId === sessionId && this.canFire()) {
        for (let d = 38; d < 130; d += 12) {
          g.fillStyle(color, 1 - d / 160).fillCircle(
            player.x + Math.cos(this.angle) * d,
            player.y + Math.sin(this.angle) * d,
            2,
          );
        }
        if (power > 0)
          g.lineStyle(4, color)
            .beginPath()
            .arc(
              player.x,
              player.y,
              31,
              -Math.PI / 2,
              -Math.PI / 2 + power * Math.PI * 2,
            )
            .strokePath();
      }
    });
    const rocket = state.projectile;
    if (rocket.active) {
      const last = this.trail.at(-1);
      if (!last || last.x !== rocket.x || last.y !== rocket.y)
        this.trail.push({ x: rocket.x, y: rocket.y });
      if (this.trail.length > 14) this.trail.shift();
      this.trail.forEach((p, i) => {
        g.fillStyle(0xf4e7b8, (i / this.trail.length) * 0.4).fillCircle(
          p.x,
          p.y,
          2,
        );
      });
      g.fillStyle(0xffe4a3).fillCircle(rocket.x, rocket.y, 5);
      g.lineStyle(2, 0xffffff).strokeCircle(rocket.x, rocket.y, 5);
    } else this.trail = [];
    if (state.explosion.id !== this.explosionId) {
      this.explosionId = state.explosion.id;
      this.explodedAt = performance.now();
    }
    const progress = (performance.now() - this.explodedAt) / ARENA.explosionMs;
    if (this.explosionId > 0 && progress < 1) {
      const { x, y } = state.explosion;
      g.fillStyle(0xffd48a, (1 - progress) * 0.25).fillCircle(
        x,
        y,
        ARENA.blastRadius * Math.sqrt(progress),
      );
      g.lineStyle(3, 0xffd48a, 1 - progress).strokeCircle(
        x,
        y,
        ARENA.blastRadius * Math.sqrt(progress),
      );
      g.fillStyle(0xfff1cc, 1 - progress).fillCircle(x, y, 16 * (1 - progress));
    }
  }
}
