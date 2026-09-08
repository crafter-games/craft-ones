import {
  COATS,
  type CoatId,
  type PlayerView,
  SPECIES,
  type WeaponId,
} from "@craft-ones/shared";
import * as Phaser from "phaser";
import { joints, PARTS, type Part, type Species } from "./design";
import { armPose, BODY_LAYERS, HEAD_SCALE } from "./pose";

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
  private movedAt = -1000;
  private death = 0;
  private weaponImage: Phaser.GameObjects.Image;
  private armImages: Phaser.GameObjects.Image[] = [];
  private weaponKind = "";
  private deadEyes: Phaser.GameObjects.Graphics;

  static preload(scene: Phaser.Scene) {
    for (const species of SPECIES)
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
    const tail = pivot("tail", [0, 0]);
    this.legBack = pivot("legBack", j.hipBack);
    this.footBack = pivot("footBack", j.ankle, this.legBack);
    this.armBack = pivot("armBack", j.shoulderBack);
    this.handBack = pivot("handBack", j.wrist, this.armBack);
    const torso = image("body");
    this.body.add(torso);
    this.legFront = pivot("legFront", j.hipFront);
    this.footFront = pivot("footFront", j.ankle, this.legFront);
    this.head = scene.add.container(j.neck[0], j.neck[1]).setScale(HEAD_SCALE);
    this.body.add(this.head);
    pivot("earBack", j.earBack, this.head);
    this.ear = pivot("earFront", j.earFront, this.head);
    this.head.add(image("head"));
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
    this.weaponImage = scene.add
      .image(0, 0, "weapon-rocket")
      .setDisplaySize(64, 48);
    this.weapon.add(this.weaponImage);
    this.body.add(this.weapon);
    this.armFront = pivot("armFront", j.shoulderFront);
    this.handFront = pivot("handFront", j.wrist, this.armFront);
    this.armImages = [
      this.armBack.list[0] as Phaser.GameObjects.Image,
      this.armFront.list[0] as Phaser.GameObjects.Image,
    ];
    const layers = {
      tail,
      legBack: this.legBack,
      legFront: this.legFront,
      armBack: this.armBack,
      body: torso,
      weapon: this.weapon,
      armFront: this.armFront,
      head: this.head,
    };
    BODY_LAYERS.forEach((key, index) => {
      layers[key].setDepth(index);
    });
    this.body.sort("depth");
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
      this.weaponImage.setTexture(`weapon-${kind}`);
    }
    const now = this.scene.time.now;
    const j = joints[this.species];
    if (player.hp < this.lastHp) this.hitAt = now;
    this.lastHp = player.hp;
    const factor = Math.min(1, dt / 70);
    const deltaX = player.x - (this.previousX ?? player.x);
    if (Math.abs(deltaX) > 0.1) this.movedAt = now;
    if (this.previousX === null) this.root.setPosition(player.x, player.y);
    this.moving = Phaser.Math.Linear(
      this.moving,
      now - this.movedAt < 130 ? 1 : 0,
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
    this.eyes.scaleY = Math.sin(now / 780 + player.number) > 0.998 ? 0.32 : 0.5;
    this.deadEyes.setVisible(player.hp <= 0);
    this.weapon
      .setVisible(player.hp > 0)
      .setRotation(localAngle)
      .setPosition(-recoil * 3, 0);
    // Scale only the upper arm; paws keep their round shape at every aim angle.
    [this.armBack, this.armFront].forEach((arm, i) => {
      const pose = armPose(this.species, i === 1, localAngle, kind);
      arm.rotation = pose.angle;
      this.armImages[i].scaleX = 0.5 * pose.length;
      (i === 1 ? this.handFront : this.handBack).x = 12 * pose.length;
    });
    this.legBack.rotation = Math.sin(now / 70) * this.moving * 0.45;
    this.legFront.rotation = -this.legBack.rotation;
    this.root.alpha = player.hp > 0 ? 1 : 0.7;
  }
}
