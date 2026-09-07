import {
  COATS,
  type CoatId,
  type PlayerView,
  type WeaponId,
} from "@craft-ones/shared";
import * as Phaser from "phaser";
import { joints, PARTS, type Part, type Species } from "./design";

export class CharacterRig {
  readonly root: Phaser.GameObjects.Container;
  readonly body: Phaser.GameObjects.Container;
  readonly head: Phaser.GameObjects.Container;
  readonly armBack: Phaser.GameObjects.Container;
  readonly armFront: Phaser.GameObjects.Container;
  readonly legBack: Phaser.GameObjects.Container;
  readonly legFront: Phaser.GameObjects.Container;
  readonly handBack: Phaser.GameObjects.Container;
  readonly handFront: Phaser.GameObjects.Container;
  readonly footBack: Phaser.GameObjects.Container;
  readonly footFront: Phaser.GameObjects.Container;
  readonly weapon: Phaser.GameObjects.Container;
  private eyes: Phaser.GameObjects.Image;
  private ear: Phaser.GameObjects.Container;
  private lastHp = 100;
  private hitAt = -10000;
  private firedAt = -10000;
  private previousX: number | null = null;
  private moving = 0;
  private death = 0;
  private weaponInk!: Phaser.GameObjects.Graphics;
  private weaponKind = "";
  private deadEyes: Phaser.GameObjects.Graphics;

  static preload(scene: Phaser.Scene) {
    for (const species of ["cuy", "llama"] as const)
      for (const coat of Object.keys(COATS))
        for (const part of PARTS)
          scene.load.svg(
            `${species}-${coat}-${part}`,
            `/art/${species}/${coat}/${part}.svg`,
          );
  }

  constructor(
    private scene: Phaser.Scene,
    private species: Species,
    coat: CoatId,
  ) {
    const j = joints[species];
    this.root = scene.add.container(0, 0).setDepth(10);
    this.body = scene.add.container(0, 0);
    this.root.add(this.body);
    const image = (part: Part) =>
      scene.add
        .image(0, 0, `${species}-${coat}-${part}`)
        .setDisplaySize(80, 100);
    const pivot = (part: Part, xy: number[], parent = this.body) => {
      const container = scene.add.container(xy[0], xy[1], [image(part)]);
      parent.add(container);
      return container;
    };
    pivot("tail", [0, 0]);
    this.legBack = pivot("legBack", j.hipBack);
    this.footBack = pivot("footBack", j.ankle, this.legBack);
    this.armBack = pivot("armBack", j.shoulderBack);
    this.handBack = pivot("handBack", j.wrist, this.armBack);
    this.body.add(image("body"));
    this.legFront = pivot("legFront", j.hipFront);
    this.footFront = pivot("footFront", j.ankle, this.legFront);
    this.head = scene.add.container(j.neck[0], j.neck[1]);
    this.body.add(this.head);
    pivot("earBack", j.earBack, this.head);
    this.head.add(image("head"));
    this.ear = pivot("earFront", j.earFront, this.head);
    this.eyes = image("eyes");
    this.head.add(this.eyes);
    this.deadEyes = scene.add
      .graphics()
      .lineStyle(2.5, 0x3b2b38)
      .lineBetween(-3, -14, 6, -5)
      .lineBetween(6, -14, -3, -5)
      .setVisible(false);
    this.head.add(this.deadEyes);
    this.weapon = scene.add.container(0, 0);
    const g = scene.add.graphics();
    this.weaponInk = g;
    this.weapon.add(g);
    this.body.add(this.weapon);
    this.armFront = pivot("armFront", j.shoulderFront);
    this.handFront = pivot("handFront", j.wrist, this.armFront);
  }

  private drawWeapon(kind: WeaponId) {
    const g = this.weaponInk.clear();
    if (kind === "grenade") {
      g.fillStyle(0x3b2b38).fillCircle(8, 0, 10);
      g.fillStyle(0x779657).fillCircle(8, 0, 7);
      g.lineStyle(2, 0xc0d187)
        .lineBetween(4, -4, 12, -4)
        .lineBetween(3, 1, 13, 1);
      g.lineStyle(3, 0x3b2b38).strokeCircle(8, -10, 4);
    } else if (kind === "dynamite") {
      for (const y of [-5, 0, 5]) {
        g.fillStyle(0x3b2b38).fillRoundedRect(0, y - 3, 20, 6, 2);
        g.fillStyle(0xd96356).fillRoundedRect(2, y - 2, 16, 4, 2);
      }
      g.fillStyle(0xeecf8c).fillRect(7, -8, 4, 16);
      g.lineStyle(2, 0xf9e7ae).lineBetween(18, -5, 23, -12);
    } else if (kind === "grapple") {
      g.lineStyle(4, 0x3b2b38)
        .lineBetween(-4, 1, 18, 1)
        .lineBetween(16, 1, 22, -8)
        .lineBetween(16, 1, 22, 10);
      g.lineStyle(2, 0xc7e3db)
        .lineBetween(-3, 0, 18, 0)
        .lineBetween(17, 0, 21, -7)
        .lineBetween(17, 0, 21, 8);
      g.fillStyle(0xbe9967).fillRect(0, -4, 6, 8);
    } else {
      g.fillStyle(0x3b2b38).fillRoundedRect(-8, -7, 32, 14, 4);
      g.fillStyle(kind === "mortar" ? 0x947da2 : 0x607e83).fillRoundedRect(
        -6,
        -5,
        26,
        10,
        3,
      );
      g.fillStyle(0x9bc9bf).fillRect(-3, -4, 6, 8);
      g.fillStyle(0xffd277).fillRoundedRect(15, -7, 7, 14, 2);
      g.fillStyle(0x3b2b38).fillRect(20, -4, 3, 8);
      g.fillStyle(0xeae4c6).fillRect(6, -4, 4, 2);
    }
  }

  recoil() {
    this.firedAt = this.scene.time.now;
  }

  update(
    player: PlayerView,
    angle: number,
    power: number,
    dt: number,
    kind: WeaponId = "rocket",
  ) {
    if (this.weaponKind !== kind) {
      this.weaponKind = kind;
      this.drawWeapon(kind);
    }
    const now = this.scene.time.now;
    const j = joints[this.species];
    if (player.hp < this.lastHp) this.hitAt = now;
    this.lastHp = player.hp;
    const factor = Math.min(1, dt / 70);
    if (this.previousX === null) this.root.setPosition(player.x, player.y);
    this.moving = Phaser.Math.Linear(
      this.moving,
      Math.abs(player.x - (this.previousX ?? player.x)) > 0.1 ? 1 : 0,
      factor,
    );
    this.previousX = player.x;
    this.root.x = Phaser.Math.Linear(this.root.x, player.x, factor);
    this.root.y = Phaser.Math.Linear(this.root.y, player.y, factor);
    const facing = Math.cos(angle) >= 0 ? 1 : -1;
    this.root.scaleX = facing;
    const localAngle = Math.atan2(Math.sin(angle), Math.abs(Math.cos(angle)));
    const idle = Math.sin(now / 320 + player.number);
    const recoil = Math.max(0, 1 - (now - this.firedAt) / 260);
    const hit = Math.max(0, 1 - (now - this.hitAt) / 440);
    this.death = Phaser.Math.Linear(
      this.death,
      player.hp <= 0 ? 1 : 0,
      Math.min(1, dt / 100),
    );
    this.body.setPosition(
      -recoil * 6,
      idle * 0.45 - Math.abs(Math.sin(now / 60)) * this.moving * 2,
    );
    this.body.setScale(
      1 + hit * 0.18 - power * 0.025,
      1 + idle * 0.012 - hit * 0.16 + power * 0.025,
    );
    this.body.rotation =
      -recoil * 0.09 + hit * Math.sin(now / 35) * 0.12 + this.death * 1.3;
    this.body.y += this.death * 5;
    this.head.rotation = localAngle * 0.07 + idle * 0.015 - recoil * 0.08;
    this.head.setPosition(j.neck[0], j.neck[1] + idle * 0.4);
    this.ear.rotation = Math.sin(now / 440) * 0.04 + recoil * 0.3;
    this.eyes.setVisible(player.hp > 0);
    this.eyes.scaleY = Math.sin(now / 780 + player.number) > 0.994 ? 0.05 : 0.5;
    this.deadEyes.setVisible(player.hp <= 0);
    this.weapon
      .setVisible(player.hp > 0)
      .setRotation(localAngle)
      .setPosition(-recoil * 3, 0);
    // Shoulder and wrist pivots: arms point to two grips along the barrel.
    for (const [arm, shoulder, grip] of [
      [this.armBack, j.shoulderBack, 4],
      [this.armFront, j.shoulderFront, 12],
    ] as const) {
      const dx = Math.cos(localAngle) * grip - shoulder[0];
      const dy = Math.sin(localAngle) * grip + 4 - shoulder[1];
      arm.rotation = Math.atan2(dy, dx);
      arm.scaleX = Math.hypot(dx, dy) / 12;
    }
    this.legBack.rotation = Math.sin(now / 70) * this.moving * 0.45;
    this.legFront.rotation = -this.legBack.rotation;
    this.root.alpha = player.hp > 0 ? 1 : 0.7;
  }
}
