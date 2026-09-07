import { ARENA } from "@craft-ones/shared";
import Phaser from "phaser";
import type { GameBridge } from "./GameBridge";

export class ArenaInput {
  angle = -Math.PI / 4;
  private charging = false;
  private chargeStart = 0;
  private pointer = -1;
  private lastTurn = "";
  private sentTurn = "";
  private lastPower = -1;
  private direction: -1 | 0 | 1 = 0;
  private moveAt = 0;
  private angleDirection = 0;

  constructor(
    private scene: Phaser.Scene,
    private bridge: GameBridge,
  ) {
    const canvas = scene.game.canvas;
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute(
      "aria-label",
      "Battle arena. Mouse or touch: aim, hold, release to fire. A/D move. Arrows aim. Hold and release Space to fire.",
    );
    scene.input.on("pointermove", (p: Phaser.Input.Pointer) => this.aim(p));
    scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.charging || !this.canFire() || !p.leftButtonDown()) return;
      canvas.focus({ preventScroll: true });
      this.aim(p);
      this.pointer = p.id;
      this.begin();
    });
    scene.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (p.id === this.pointer) this.shoot();
    });
    scene.input.on("pointerupoutside", () => this.cancel());
    const cancel = () => {
      this.cancel();
      this.direction = 0;
      this.angleDirection = 0;
    };
    const keydown = (event: KeyboardEvent) => {
      if (
        !["ArrowLeft", "ArrowRight", "Space", "KeyA", "KeyD"].includes(
          event.code,
        )
      )
        return;
      event.preventDefault();
      if (event.code === "Space" && !event.repeat && this.canFire())
        this.begin();
      if (event.code === "KeyA") this.direction = -1;
      if (event.code === "KeyD") this.direction = 1;
      if (event.code === "ArrowLeft") this.angleDirection = -1;
      if (event.code === "ArrowRight") this.angleDirection = 1;
    };
    const keyup = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        this.shoot();
      }
      if (["KeyA", "KeyD"].includes(event.code)) this.direction = 0;
      if (["ArrowLeft", "ArrowRight"].includes(event.code))
        this.angleDirection = 0;
    };
    canvas.addEventListener("keydown", keydown);
    canvas.addEventListener("keyup", keyup);
    canvas.addEventListener("pointercancel", cancel);
    canvas.addEventListener("blur", cancel);
    window.addEventListener("blur", cancel);
    const visibility = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener("visibilitychange", visibility);
    scene.events.once("shutdown", () => {
      canvas.removeEventListener("keydown", keydown);
      canvas.removeEventListener("keyup", keyup);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("blur", cancel);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", visibility);
    });
  }
  private turnKey() {
    return `${this.bridge.generation}:${this.bridge.state?.turnNumber}`;
  }
  canFire() {
    const { state, connected, sessionId } = this.bridge;
    return (
      connected &&
      state?.phase === "aiming" &&
      state.currentPlayer === sessionId &&
      state.remainingMs > 0 &&
      this.sentTurn !== this.turnKey()
    );
  }
  private aim(pointer: Phaser.Input.Pointer) {
    if (!this.canFire() || (this.charging && pointer.id !== this.pointer))
      return;
    const player = this.bridge.state?.players.find(
      (p) => p.sessionId === this.bridge.sessionId,
    );
    const world = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    if (player) this.angle = Math.atan2(world.y - player.y, world.x - player.x);
  }
  private begin() {
    if (!this.charging) {
      this.charging = true;
      this.chargeStart = performance.now();
    }
  }
  power() {
    return this.charging
      ? Math.min(1, (performance.now() - this.chargeStart) / ARENA.chargeMs)
      : 0;
  }
  private shoot() {
    if (this.charging && this.canFire() && this.bridge.state) {
      this.sentTurn = this.turnKey();
      this.scene.game.canvas.dataset.fireAngle = String(this.angle);
      this.scene.game.canvas.dataset.firePower = String(this.power());
      this.bridge.fire({
        angle: this.angle,
        power: this.power(),
        turnNumber: this.bridge.state.turnNumber,
      });
    }
    this.cancel();
  }
  private cancel() {
    this.charging = false;
    this.pointer = -1;
    this.reportPower(0);
  }
  private reportPower(value: number) {
    const rounded = Math.round(value * 100);
    if (rounded !== this.lastPower) {
      this.lastPower = rounded;
      this.bridge.charge(rounded);
    }
  }
  update(dt: number) {
    if (this.turnKey() !== this.lastTurn) {
      this.lastTurn = this.turnKey();
      this.cancel();
      this.direction = 0;
      const me = this.bridge.state?.players.find(
        (p) => p.sessionId === this.bridge.sessionId,
      );
      this.angle = me?.number === 2 ? (-3 * Math.PI) / 4 : -Math.PI / 4;
    }
    if (!this.canFire() && this.charging) this.cancel();
    if (this.canFire()) {
      this.angle = Phaser.Math.Angle.Wrap(
        this.angle + this.angleDirection * dt * 0.001,
      );
      if (
        this.direction &&
        (this.bridge.state?.players.find(
          (p) => p.sessionId === this.bridge.sessionId,
        )?.movementLeft ?? 0) > 0 &&
        performance.now() >= this.moveAt &&
        !this.charging
      ) {
        this.bridge.move(this.direction);
        this.moveAt = performance.now() + 100;
      }
    }
    this.reportPower(this.power());
  }
}
