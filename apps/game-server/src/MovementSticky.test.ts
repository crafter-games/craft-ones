import { expect, test } from "bun:test";
import {
  ARENA,
  Battle,
  type PlayableMapId,
  syncMovement,
  WEAPONS,
} from "@craft-ones/shared";

function fixture(map: PlayableMapId = "andes") {
  let now = 0;
  const battle = new Battle(() => now, map);
  battle.addPlayer("one");
  battle.addPlayer("two");
  return {
    battle,
    tick(ms: number = ARENA.stepMs) {
      now += ms;
      battle.step(ms);
    },
  };
}

test.each(["andes", "coast", "canopy", "caldera"] as const)(
  "%s measures movement from the turn origin and restores it the next turn",
  (map) => {
    const { battle, tick } = fixture(map);
    const p = battle.state.players[0];
    const start = p.x;
    expect(p.originX).toBe(start);
    expect(
      battle.move("one", { direction: 1, sequence: 1, turnNumber: 1 }),
    ).toBeNull();
    expect(p.movementLeft).toBeCloseTo(
      ARENA.moveBudget - Math.abs(p.x - start),
    );
    expect(p.movementLeft).toBeLessThan(ARENA.moveBudget);
    // Leave a three pixel range around the origin, as if jumps ate the rest.
    p.movementSpent = ARENA.moveBudget - 3;
    syncMovement(p);
    tick(100);
    expect(
      battle.move("one", { direction: 1, sequence: 2, turnNumber: 1 }),
    ).toBeString();
    expect(battle.jump("one", { direction: 0, turnNumber: 1 })).toBeString();
    // Walking home is still allowed, and buys the range back on arrival.
    expect(
      battle.move("one", { direction: -1, sequence: 3, turnNumber: 1 }),
    ).toBeNull();
    expect(p.x).toBeCloseTo(start);
    expect(p.movementLeft).toBeCloseTo(3);
    expect(
      battle.fire("one", {
        weapon: "sticky",
        angle: -1,
        power: 0,
        turnNumber: 1,
      }),
    ).toBeNull();
    for (let frame = 0; frame < 500 && battle.state.turnNumber === 1; frame++)
      tick();
    expect(battle.state.turnNumber).toBe(2);
    const next = battle.state.players[1];
    expect(next.movementLeft).toBe(ARENA.moveBudget);
    expect(next.originX).toBe(next.x);
    expect(next.movementSpent).toBe(0);
  },
);

test("walking back toward the origin hands the range back", () => {
  const { battle, tick } = fixture();
  const p = battle.state.players[0];
  const start = p.x;
  let sequence = 0;
  const walk = (direction: -1 | 1) => {
    tick(100);
    return battle.move("one", {
      direction,
      sequence: ++sequence,
      turnNumber: 1,
    });
  };
  while (walk(1) === null && sequence < 60);
  expect(p.x - start).toBeCloseTo(ARENA.moveBudget);
  expect(p.movementLeft).toBe(0);
  expect(walk(1)).toBeString();
  // Every step home buys back exactly the range it cost.
  for (let step = 0; step < 10; step++) expect(walk(-1)).toBeNull();
  expect(p.movementLeft).toBeCloseTo(ARENA.moveStep * 10);
  while (Math.abs(p.x - start) > 0.5 && sequence < 120) walk(-1);
  expect(p.x).toBeCloseTo(start);
  expect(p.movementLeft).toBe(ARENA.moveBudget);
  // Crossing the origin starts spending again on the far side.
  for (let step = 0; step < 5; step++) expect(walk(-1)).toBeNull();
  expect(p.movementLeft).toBeCloseTo(ARENA.moveBudget - ARENA.moveStep * 5);
});

test("jump travel spends the budget during flight without cancelling gravity or the shot", () => {
  const { battle, tick } = fixture();
  const p = battle.state.players[0];
  p.movementSpent = ARENA.moveBudget - (ARENA.jumpCost + 9);
  syncMovement(p);
  const x = p.x;
  expect(battle.jump("one", { direction: 1, turnNumber: 1 })).toBeNull();
  // The jump fee never comes back, so nine pixels of range are left.
  expect(p.movementLeft).toBe(9);
  battle.fire("one", {
    weapon: "grenade",
    angle: -1.5,
    power: 1,
    turnNumber: 1,
  });
  for (let i = 0; i < 20; i++) tick();
  expect(p.x - x).toBeCloseTo(9);
  expect(p.movementLeft).toBe(0);
  expect(p.vx).toBe(0);
  expect(p.vy).not.toBe(0);
});

test("sticky attaches to terrain, holds still until its fuse, then blasts once", () => {
  const { battle, tick } = fixture();
  const s = battle.state;
  expect(
    battle.fire("one", {
      weapon: "sticky",
      angle: Math.PI / 2,
      power: 0,
      turnNumber: 1,
    }),
  ).toBeNull();
  tick();
  expect(s.projectile.stuck).toBe(true);
  const { x, y } = s.projectile;
  for (let i = 0; i < 90; i++) tick();
  expect(s.phase).toBe("flying");
  expect(s.projectile.x).toBe(x);
  expect(s.projectile.y).toBe(y);
  expect(s.projectile.bounces).toBe(0);
  for (let i = 0; i < 95; i++) tick();
  expect(s.explosion.id).toBe(1);
  expect(s.explosion.radius).toBe(WEAPONS.sticky.radius);
  expect(s.terrainRevision).toBe(1);
  expect(s.players[0].hp).toBeLessThan(100);
});

test("sticky attachment follows a falling character and resets on rematch", () => {
  const { battle, tick } = fixture();
  const s = battle.state,
    target = s.players[1];
  target.x = s.players[0].x + 48;
  target.y = s.players[0].y;
  battle.fire("one", { weapon: "sticky", angle: 0, power: 0, turnNumber: 1 });
  for (let i = 0; i < 10 && !s.projectile.stuck; i++) tick();
  expect(s.projectile.attachedPlayer).toBe(2);
  const dx = s.projectile.x - target.x,
    dy = s.projectile.y - target.y;
  target.vy = -120;
  tick();
  expect(s.projectile.x - target.x).toBeCloseTo(dx);
  expect(s.projectile.y - target.y).toBeCloseTo(dy);
  target.hp = 0;
  for (let i = 0; i < 500 && s.phase !== "finished"; i++) tick();
  battle.restart("one", { turnNumber: s.turnNumber });
  expect(s.projectile.stuck).toBe(false);
  expect(s.projectile.attachedPlayer).toBe(0);
  expect(s.players.every((p) => p.movementLeft === ARENA.moveBudget)).toBe(
    true,
  );
});

test("air steering respects the range, and knockback stays independent of it", () => {
  const { battle, tick } = fixture();
  const p = battle.state.players[0];
  battle.jump("one", { direction: 0, turnNumber: 1 });
  tick(100);
  p.movementSpent = ARENA.moveBudget - 6;
  syncMovement(p);
  expect(
    battle.move("one", {
      direction: 1,
      sequence: 1,
      turnNumber: 1,
      movementLeft: 999,
    }),
  ).toBeNull();
  const x = p.x;
  for (let i = 0; i < 10; i++) tick();
  expect(p.x - x).toBeCloseTo(6);
  expect(p.movementLeft).toBe(0);
  // Steering home is still allowed: it flies back into the range it left.
  expect(
    battle.move("one", { direction: -1, sequence: 2, turnNumber: 1 }),
  ).toBeNull();
  tick();
  expect(p.x).toBeLessThan(x + 6);
  expect(p.movementLeft).toBeGreaterThan(0);
  const other = battle.state.players[1];
  other.movementSpent = ARENA.moveBudget;
  syncMovement(other);
  other.vx = -100;
  const otherX = other.x;
  tick();
  expect(other.x).toBeLessThan(otherX);
  expect(other.movementLeft).toBe(0);
});

test("sticky fuse still expires exactly once after a stalled physics tick", () => {
  const { battle, tick } = fixture();
  battle.fire("one", {
    weapon: "sticky",
    angle: Math.PI / 2,
    power: 0,
    turnNumber: 1,
  });
  tick();
  expect(battle.state.projectile.stuck).toBe(true);
  tick(WEAPONS.sticky.fuse);
  expect(battle.state.explosion.id).toBe(1);
  tick(100);
  expect(battle.state.explosion.id).toBe(1);
});
