import { expect, test } from "bun:test";
import {
  ARENA,
  Battle,
  type BattleView,
  bodyBlocked,
  gridHit,
  grounded,
  shotTrajectory,
  solidAt,
  WEAPONS,
  WORLD_MAPS,
} from "@craft-ones/shared";

function fixture(map: "andes" | "coast" = "andes") {
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
    until(predicate: () => boolean, frames = 700) {
      for (let i = 0; i < frames && !predicate(); i++) {
        now += ARENA.stepMs;
        battle.step(ARENA.stepMs);
      }
      expect(predicate()).toBe(true);
    },
  };
}
test.each(["andes", "coast"] as const)(
  "%s has suspended obstacles, real cavities and traversable air",
  (map) => {
    const { battle } = fixture(map),
      s = battle.state;
    expect(s.worldWidth).toBeGreaterThan(ARENA.width);
    expect(s.worldHeight).toBeGreaterThan(ARENA.height);
    const caveY = map === "andes" ? 1020 : 1188;
    expect(solidAt(s, 1344, caveY)).toBe(false);
    expect(bodyBlocked(s, 1344, caveY)).toBe(false);
    expect(solidAt(s, 1344, caveY - 270)).toBe(true);
    expect(gridHit(s, 1260, caveY, 150, 0)).toBe(Infinity);
    expect(gridHit(s, 1260, caveY, 450, 0)).toBeLessThan(1);
    expect(solidAt(s, 1344, map === "andes" ? 450 : 528)).toBe(true);
    expect(solidAt(s, 560, 200)).toBe(false);
  },
);
test.each(["rocket", "grenade", "mortar", "dynamite", "sticky"] as const)(
  "%s uses the shared preview, excavates terrain and resolves exactly once",
  (weapon) => {
    const { battle, tick, until } = fixture();
    const s = battle.state;
    const angle = weapon === "grenade" ? -0.15 : Math.PI / 2,
      power = 0;
    const view = s.toJSON() as BattleView;
    const predicted = shotTrajectory(
      view,
      view.players,
      view.players[0],
      angle,
      power,
      weapon,
    ).at(-1);
    if (!predicted) throw new Error("Missing prediction");
    const before = [...s.terrainRows];
    expect(
      battle.fire("one", { weapon, angle, power, turnNumber: 1 }),
    ).toBeNull();
    until(() => s.phase === "exploding");
    expect(s.explosion.radius).toBe(WEAPONS[weapon].radius);
    expect(s.explosion.x).toBeCloseTo(predicted.x, 5);
    expect(s.explosion.y).toBeCloseTo(predicted.y, 5);
    expect(s.terrainRows.some((r, i) => r !== before[i])).toBe(true);
    expect(s.terrainRevision).toBe(1);
    if (weapon === "grenade" || weapon === "dynamite") {
      expect(s.projectile.bounces).toBeGreaterThan(0);
      expect(s.projectile.elapsedMs).toBeGreaterThanOrEqual(
        WEAPONS[weapon].fuse - ARENA.stepMs,
      );
    }
    const hp = s.players.map((p) => p.hp);
    for (let i = 0; i < 15; i++) tick();
    expect(s.players.map((p) => p.hp)).toEqual(hp);
    expect(s.explosion.id).toBe(1);
    until(() => s.phase === "aiming" || s.phase === "finished");
    if (s.phase === "aiming") expect(s.currentPlayer).toBe("two");
  },
);
test("grenade fuse expires even when physics ticks stall", () => {
  const { battle, tick } = fixture();
  battle.fire("one", { weapon: "grenade", angle: -1, power: 1, turnNumber: 1 });
  tick(3000);
  expect(battle.state.phase).toBe("exploding");
});
test("hook anchors, pulls without tunneling, spends a turn and does no damage", () => {
  const { battle, until } = fixture();
  const s = battle.state,
    p = s.players[0],
    start = p.x;
  expect(
    battle.fire("one", {
      weapon: "grapple",
      angle: -Math.PI,
      power: 0.5,
      turnNumber: 1,
    }),
  ).toBeNull();
  until(() => s.phase === "grappling");
  until(() => s.phase === "aiming");
  expect(p.x).toBeLessThan(start - 40);
  expect(bodyBlocked(s, p.x, p.y)).toBe(false);
  expect(s.currentPlayer).toBe("two");
  expect(s.explosion.id).toBe(0);
  expect(s.terrainRevision).toBe(0);
  expect(s.players.map((p) => p.hp)).toEqual([100, 100]);
});
test("missed hook consumes the turn without a phantom explosion", () => {
  const { battle, until } = fixture();
  battle.fire("one", {
    weapon: "grapple",
    angle: -Math.PI / 2,
    power: 1,
    turnNumber: 1,
  });
  until(() => battle.state.phase === "aiming");
  expect(battle.state.currentPlayer).toBe("two");
  expect(battle.state.explosion.id).toBe(0);
});
test.each([100, 85, 1])(
  "default Cuy at %i HP has no special ability and cannot forge another species",
  (hp) => {
    const { battle } = fixture();
    battle.state.players[0].hp = hp;
    const before = battle.state.toJSON();
    for (const payload of [
      { turnNumber: 1 },
      { turnNumber: 1, direction: 1, species: "llama", ability: "leap" },
      { turnNumber: 1, species: "ronsoco", shield: 999, hp: 100 },
    ]) {
      expect(battle.ability("one", payload)).toBe(
        "This character has no special ability",
      );
      expect(battle.state.toJSON()).toEqual(before);
    }
    expect(
      battle.fire("one", {
        weapon: "rocket",
        angle: -1,
        power: 0.5,
        turnNumber: 1,
      }),
    ).toBeNull();
  },
);
test("llama leap spends its turn; basic jumping preserves the attack", () => {
  const { battle, tick, until } = fixture(),
    s = battle.state;
  const one = s.players[0],
    start = one.x;
  expect(battle.jump("one", { direction: 1, turnNumber: 1 })).toBeNull();
  expect(one.jumps).toBe(1);
  expect(one.movementLeft).toBe(ARENA.moveBudget);
  expect(battle.jump("one", { direction: 1, turnNumber: 1 })).toBeString();
  for (let i = 0; i < 20; i++) tick();
  expect(one.x).toBeGreaterThan(start);
  expect(s.phase).toBe("aiming");
  tick(ARENA.turnMs);
  const p = s.players[1],
    oldY = p.y,
    oldX = p.x;
  expect(battle.ability("two", { direction: -1, turnNumber: 2 })).toBeNull();
  for (let i = 0; i < 20; i++) tick();
  expect(p.y).toBeLessThan(oldY);
  expect(p.x).toBeLessThan(oldX);
  expect(bodyBlocked(s, p.x, p.y)).toBe(false);
  until(() => s.phase === "aiming" || s.phase === "finished");
  if (s.phase === "aiming") expect(s.currentPlayer).toBe("one");
});
test("unsupported weapons, forged character fields and stale ability intents cannot change outcomes", () => {
  const { battle } = fixture(),
    s = battle.state;
  const original = JSON.stringify(s.toJSON());
  for (const weapon of ["__proto__", "laser", null, {}, 42])
    expect(
      battle.fire("one", { weapon, angle: 0, power: 0.5, turnNumber: 1 }),
    ).toBeString();
  for (const payload of [
    null,
    [],
    { turnNumber: 0, direction: 1 },
    { turnNumber: 1, direction: 2 },
    { turnNumber: 1, direction: Infinity },
  ])
    expect(battle.jump("one", payload)).toBeString();
  expect(battle.ability("two", { turnNumber: 1 })).toBeString();
  expect(battle.ability("one", { turnNumber: 99 })).toBeString();
  expect(JSON.stringify(s.toJSON())).toBe(original);
  const fresh = new Battle(undefined, "coast");
  fresh.addPlayer("a", { species: "llama", coat: "rose", hp: 999, x: 1 });
  fresh.addPlayer("b", { species: "dragon", coat: "__proto__" });
  expect(fresh.state.players[0].species).toBe("llama");
  expect(fresh.state.players[0].coat).toBe("rose");
  expect(fresh.state.players[0].hp).toBe(100);
  expect(fresh.state.players[0].x).not.toBe(1);
  expect(fresh.state.players[1].species).toBe("llama");
  expect(fresh.state.players[1].coat).toBe("cream");
});
test("a void fall eliminates a player and restart regenerates pristine terrain and cooldowns", () => {
  const { battle, tick } = fixture(),
    s = battle.state;
  s.players[0].y = s.worldHeight + 80;
  tick();
  expect(s.phase).toBe("finished");
  expect(s.winner).toBe("two");
  s.players[0].abilityReadyTurn = 999;
  s.terrainRows[120] = "0".repeat(s.terrainRows[120].length);
  expect(battle.restart("one", { turnNumber: s.turnNumber })).toBeNull();
  expect(s.players[0].abilityReadyTurn).toBe(0);
  expect(s.players[0].hp).toBe(100);
  expect(grounded(s, s.players[0].x, s.players[0].y)).toBe(true);
  expect(s.terrainRows[120]).toContain("1");
});

test("walking spends distance while preserving enough budget to jump and fire", () => {
  const { battle, tick } = fixture(),
    s = battle.state,
    p = s.players[0],
    x = p.x;
  for (let sequence = 1; sequence <= 18; sequence++) {
    expect(
      battle.move("one", { direction: 1, turnNumber: 1, sequence }),
    ).toBeNull();
    tick(100);
  }
  expect(p.movementLeft).toBeCloseTo(ARENA.moveBudget - (p.x - x));
  expect(s.turnNumber).toBe(1);
  expect(s.currentPlayer).toBe("one");
  expect(battle.jump("one", { direction: -1, turnNumber: 1 })).toBeNull();
  expect(
    battle.fire("one", { angle: -1, power: 0.5, turnNumber: 1 }),
  ).toBeNull();
  expect(s.phase).toBe("flying");
});
test("vertical jumps are free, can repeat after landing and obey the turn deadline", () => {
  const { battle, tick, until } = fixture(),
    s = battle.state,
    p = s.players[0],
    x = p.x;
  for (let jump = 0; jump < 2; jump++) {
    expect(battle.jump("one", { direction: 0, turnNumber: 1 })).toBeNull();
    tick();
    expect(p.y).toBeLessThan(WORLD_MAPS.andes.spawns[0][1]);
    expect(battle.jump("one", { direction: 0, turnNumber: 1 })).toBeString();
    until(() => p.vy === 0 && grounded(s, p.x, p.y));
    expect(p.x).toBe(x);
    expect(s.turnNumber).toBe(1);
  }
  expect(s.remainingMs).toBeLessThan(ARENA.turnMs - 2000);
  expect(p.jumps).toBe(2);
  expect(p.movementLeft).toBe(ARENA.moveBudget);
  tick(ARENA.turnMs);
  const y = p.y;
  expect(battle.jump("one", { direction: 0, turnNumber: 1 })).toBeString();
  expect(p.y).toBe(y);
  expect(s.currentPlayer).toBe("two");
});
