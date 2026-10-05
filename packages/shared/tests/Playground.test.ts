import { expect, test } from "bun:test";
import {
  ARENA,
  Battle,
  type BattleView,
  bodyBlocked,
  grounded,
  shotTrajectory,
  solidAt,
  WORLD_MAPS,
} from "../src";

function fixture(mapId: "flat" | "andes" | "coast" = "andes") {
  let now = 0;
  const battle = new Battle(() => now, mapId);
  battle.addPlayer("one");
  battle.addPlayer("two");
  return {
    battle,
    tick(ms = 100) {
      now += ms;
      battle.step(ms);
    },
  };
}

test("legacy flat movement is turn-bound, rate-limited and consumes a finite distance budget", () => {
  const { battle, tick } = fixture("flat");
  const intent = { direction: 1, turnNumber: 1, sequence: 1 };
  const player = battle.state.players[0];
  const x = player.x;
  expect(battle.move("two", intent)).toBeString();
  expect(battle.move("one", { ...intent, direction: 99 })).toBeString();
  expect(player.x).toBe(x);
  expect(battle.move("one", intent)).toBeNull();
  expect(player.x).toBeGreaterThan(x);
  const moved = player.x;
  expect(battle.move("one", intent)).toBeString();
  expect(player.x).toBe(moved);
  for (let sequence = 2; sequence < 40; sequence++) {
    tick();
    battle.move("one", { ...intent, sequence });
  }
  expect(player.x - x).toBeLessThanOrEqual(ARENA.moveBudget);
  expect(player.movementLeft).toBe(0);
});

test.each(["andes", "coast"] as const)(
  "%s places both players on solid irregular ground",
  (mapId) => {
    const { battle } = fixture(mapId);
    expect(new Set(battle.state.terrain).size).toBeGreaterThan(3);
    for (const player of battle.state.players) {
      expect(grounded(battle.state, player.x, player.y)).toBe(true);
      expect(bodyBlocked(battle.state, player.x, player.y)).toBe(false);
    }
  },
);

test("restart is host-authorized, finished-only, restores players, and invalidates old intents", () => {
  const { battle } = fixture();
  expect(battle.restart("one", { turnNumber: 1 })).toBeString();
  battle.state.players[1].hp = 0;
  battle.removePlayer("two");
  expect(battle.restart("one", { turnNumber: 1 })).toBeString();
  battle.state.players[1].connected = true;
  expect(battle.restart("two", { turnNumber: 1 })).toBeString();
  expect(battle.restart("one", { turnNumber: 1 })).toBeNull();
  expect(battle.state.players.map((p) => p.hp)).toEqual([100, 100]);
  expect(battle.state.turnNumber).toBeGreaterThan(1);
  expect(
    battle.fire("one", { angle: -0.5, power: 0.5, turnNumber: 1 }),
  ).toBeString();
});

test.each(["andes", "coast"] as const)(
  "normal intentions finish a complete match on %s",
  (mapId) => {
    const { battle, tick } = fixture(mapId);
    for (
      let frame = 0;
      frame < 6000 && battle.state.phase !== "finished";
      frame++
    ) {
      if (battle.state.phase === "aiming") {
        const shooter = battle.state.players.find(
          (p) => p.sessionId === battle.state.currentPlayer,
        );
        const target = battle.state.players.find((p) => p !== shooter);
        if (!shooter || !target) throw new Error("Missing players");
        const angle = target.x > shooter.x ? -Math.PI / 3 : (-2 * Math.PI) / 3;
        const dx = target.x - shooter.x - Math.cos(angle) * 22;
        const dy = target.y - shooter.y - Math.sin(angle) * 22;
        // Solve the launch against both gravity and the round's horizontal
        // wind. This models the correction a practiced player learns to make.
        const timeSquared =
          (2 * (dy - dx * Math.tan(angle))) /
          (ARENA.gravity - battle.state.wind * Math.tan(angle));
        const time = Math.sqrt(timeSquared);
        const speed =
          (dx - 0.5 * battle.state.wind * timeSquared) /
          (Math.cos(angle) * time);
        expect(
          battle.fire(shooter.sessionId, {
            angle,
            power: Math.max(0, Math.min(1, (speed - 240) / 760)),
            turnNumber: battle.state.turnNumber,
          }),
        ).toBeNull();
      }
      tick(ARENA.stepMs);
    }
    expect(battle.state.phase).toBe("finished");
    expect(battle.state.finishReason).toBe("elimination");
  },
);

test("movement cannot escape a deadline, move during flight or reuse an old turn", () => {
  const { battle, tick } = fixture();
  const intent = { direction: 1, turnNumber: 1, sequence: 1 };
  tick(ARENA.turnMs);
  const before = JSON.stringify(battle.state.toJSON());
  expect(battle.move("one", intent)).toBeString();
  expect(JSON.stringify(battle.state.toJSON())).toBe(before);
  expect(battle.state.players[1].movementLeft).toBe(ARENA.moveBudget);
  battle.fire("two", { angle: -2, power: 0.5, turnNumber: 2 });
  expect(battle.move("two", { ...intent, turnNumber: 2 })).toBeString();
});

test("movement clamps at map edges and preserves separation", () => {
  const { battle, tick } = fixture();
  const [one, two] = battle.state.players;
  one.x = ARENA.playerRadius;
  one.y = WORLD_MAPS.andes.spawns[0][1];
  one.originX = one.x;
  expect(
    battle.move("one", { direction: -1, turnNumber: 1, sequence: 1 }),
  ).toBeNull();
  expect(one.x).toBe(ARENA.playerRadius);
  expect(one.movementLeft).toBe(ARENA.moveBudget);
  one.x = two.x - 2 * ARENA.playerRadius;
  one.y = two.y;
  tick();
  expect(
    battle.move("one", { direction: 1, turnNumber: 1, sequence: 2 }),
  ).toBeString();
  expect(two.x - one.x).toBe(2 * ARENA.playerRadius);
});

test.each(["andes", "coast"] as const)(
  "trajectory predicts the exact authoritative impact on %s",
  (mapId) => {
    const { battle, tick } = fixture(mapId);
    const snapshot = battle.state.toJSON() as BattleView;
    const predicted = shotTrajectory(
      snapshot,
      snapshot.players,
      snapshot.players[0],
      -0.8,
      0.44,
      "rocket",
    ).at(-1);
    if (!predicted) throw new Error("Missing trajectory");
    battle.fire("one", { angle: -0.8, power: 0.44, turnNumber: 1 });
    for (let i = 0; i < 500 && battle.state.phase === "flying"; i++)
      tick(ARENA.stepMs);
    expect(battle.state.phase).toBe("exploding");
    expect(battle.state.explosion.x).toBeCloseTo(predicted.x, 8);
    expect(battle.state.explosion.y).toBeCloseTo(predicted.y, 8);
  },
);

test("lab craters remove terrain, players fall onto the new surface, infinite HP survives splash", () => {
  const { battle, tick } = fixture();
  battle.destructible = true;
  battle.infiniteHp = true;
  const player = battle.state.players[0];
  const oldY = player.y;
  const terrain = [...battle.state.terrainRows];
  battle.fire("one", { angle: Math.PI / 2, power: 0, turnNumber: 1 });
  for (let i = 0; i < 150; i++) tick(ARENA.stepMs);
  expect(battle.state.terrainRows.some((row, i) => row !== terrain[i])).toBe(
    true,
  );
  expect(player.hp).toBe(100);
  expect(player.y).toBeGreaterThan(oldY);
  expect(grounded(battle.state, player.x, player.y)).toBe(true);
  expect(
    solidAt(
      battle.state,
      WORLD_MAPS.andes.spawns[0][0],
      oldY + ARENA.playerRadius + 4,
    ),
  ).toBe(false);
});

test("knockback gravity remains deterministic across tick groupings and continues during flight", () => {
  const first = fixture(),
    second = fixture();
  for (const { battle } of [first, second]) {
    battle.state.players[0].y -= 220;
    battle.state.players[0].vy = -80;
    battle.fire("one", { angle: -1, power: 1, turnNumber: 1 });
  }
  for (let i = 0; i < 30; i++) first.tick(ARENA.stepMs);
  for (let i = 0; i < 10; i++) second.tick(ARENA.stepMs * 3);
  expect(first.battle.state.players[0].y).toBeCloseTo(
    second.battle.state.players[0].y,
    8,
  );
  expect(first.battle.state.players[0].vy).toBeCloseTo(
    second.battle.state.players[0].vy,
    8,
  );
  expect(first.battle.state.players[0].y).not.toBe(392);
});
