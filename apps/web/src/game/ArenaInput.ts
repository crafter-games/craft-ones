import { ARENA } from "@craft-ones/shared";
import * as Phaser from "phaser";
import type { GameBridge } from "./GameBridge";

/** Key codes per action; the letters stay as aliases of the arrows. */
const KEYS = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  jump: ["ArrowUp", "Space", "KeyW"],
  aimLeft: ["KeyQ"],
  aimRight: ["KeyE"],
  fire: ["KeyF"],
};
const BOUND = Object.values(KEYS).flat();

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
  private held = new Set<string>();

  constructor(
    private scene: Phaser.Scene,
    private bridge: GameBridge,
  ) {
    this.lastTurn = this.turnKey();
    const canvas = scene.game.canvas;
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute(
      "aria-label",
      "Battle arena. Mouse or touch: aim, hold, release to fire. Left and Right arrows move, Up or Space jumps; A, D and W still work. Hold a direction while jumping to jump that way. Q and E aim. Hold and release F to fire.",
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
      this.held.clear();
      this.bridge.movementDirection = 0;
    };
    const keydown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      // Play from the arena or from an unfocused page, never from a text field
      // or from a control that sits outside the battle.
      if (
        this.bridge.suspended ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        target?.closest(
          'input,textarea,select,[contenteditable="true"],dialog',
        ) ||
        (target && target !== document.body && !target.closest(".arena"))
      )
        return;
      const code = event.code;
      if (!BOUND.includes(code)) return;
      // A focused HUD button already jumps or walks on Space; let it, or the
      // same press would act twice.
      if (code === "Space" && target?.closest("button,a,[role=button]")) return;
      event.preventDefault();
      this.held.add(code);
      if (KEYS.fire.includes(code) && !event.repeat && this.canFire())
        this.begin();
      // Auto-repeat never jumps again: one press is one intention.
      if (
        KEYS.jump.includes(code) &&
        !event.repeat &&
        this.canFire() &&
        !this.charging
      )
        this.bridge.jump(this.direction);
      if (KEYS.left.includes(code)) this.direction = -1;
      if (KEYS.right.includes(code)) this.direction = 1;
      if (KEYS.aimLeft.includes(code)) this.angleDirection = -1;
      if (KEYS.aimRight.includes(code)) this.angleDirection = 1;
    };
    const keyup = (event: KeyboardEvent) => {
      const code = event.code;
      this.held.delete(code);
      const holding = (codes: string[]) => codes.some((c) => this.held.has(c));
      if (KEYS.fire.includes(code)) {
        event.preventDefault();
        this.shoot();
      }
      if (KEYS.left.includes(code) || KEYS.right.includes(code))
        this.direction = holding(KEYS.right) ? 1 : holding(KEYS.left) ? -1 : 0;
      if (KEYS.aimLeft.includes(code) || KEYS.aimRight.includes(code))
        this.angleDirection = holding(KEYS.aimRight)
          ? 1
          : holding(KEYS.aimLeft)
            ? -1
            : 0;
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    canvas.addEventListener("pointercancel", cancel);
    const blur = () => this.cancel();
    canvas.addEventListener("blur", blur);
    window.addEventListener("blur", cancel);
    const visibility = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener("visibilitychange", visibility);
    const dispose = () => {
      scene.events.off("shutdown", dispose);
      scene.events.off("destroy", dispose);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("blur", blur);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", visibility);
    };
    scene.events.once("shutdown", dispose);
    scene.events.once("destroy", dispose);
  }
  private turnKey() {
    return `${this.bridge.generation}:${this.bridge.state?.turnNumber}`;
  }
  canFire() {
    this.syncTurn();
    const { state, connected, sessionId } = this.bridge;
    return (
      connected &&
      this.bridge.ready &&
      !this.bridge.suspended &&
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
      const aim = { angle: this.angle, power: this.power() };
      if (this.bridge.abilityAim) this.bridge.ability(aim);
      else
        this.bridge.fire({
          ...aim,
          weapon: this.bridge.weapon,
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
  private syncTurn() {
    if (this.turnKey() !== this.lastTurn) {
      this.lastTurn = this.turnKey();
      this.cancel();
      this.direction = 0;
      this.held.clear();
      this.angleDirection = 0;
      const me = this.bridge.state?.players.find(
        (p) => p.sessionId === this.bridge.sessionId,
      );
      this.angle = me?.number === 2 ? (-3 * Math.PI) / 4 : -Math.PI / 4;
    }
  }
  update(dt: number) {
    this.syncTurn();
    if (this.bridge.suspended) {
      this.direction = 0;
      this.angleDirection = 0;
      this.held.clear();
    }
    if (!this.canFire() && this.charging) this.cancel();
    if (this.canFire()) {
      this.angle = Phaser.Math.Angle.Wrap(
        this.angle + this.angleDirection * dt * 0.001,
      );
      const me = this.bridge.state?.players.find(
        (p) => p.sessionId === this.bridge.sessionId,
      );
      // Range left, or a step back toward the origin, which always refills it.
      const home = me ? Math.sign(me.originX - me.x) : 0;
      if (
        this.direction &&
        ((me?.movementLeft ?? 0) > 0 || this.direction === home) &&
        performance.now() >= this.moveAt &&
        !this.charging
      ) {
        this.bridge.move(this.direction);
        this.moveAt = performance.now() + 100;
      }
    }
    this.bridge.direction = Math.cos(this.angle) >= 0 ? 1 : -1;
    this.bridge.movementDirection = this.direction;
    this.reportPower(this.power());
  }
}
