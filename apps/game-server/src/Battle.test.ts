import { describe, expect, test } from "bun:test";
import { ARENA, type BattleView } from "@craft-ones/shared";
import { Battle } from "./Battle";

function setup(start = true) {
  let time = 0;
  const battle = new Battle(() => time);
  if (start) {
    battle.addPlayer("one");
    battle.addPlayer("two");
  }
  return {
    battle,
    advance(ms: number, dt = ms) {
      time += ms;
      battle.step(dt);
    },
    stall(ms: number) {
      time += ms;
    },
    frames(count: number) {
      for (let frame = 0; frame < count; frame++) {
        time += ARENA.stepMs;
        battle.step(ARENA.stepMs);
      }
    },
  };
}

function action(battle: Battle, angle = -Math.PI / 4, power = 0.5) {
  return { angle, power, turnNumber: battle.state.turnNumber };
}

function placeProjectile(battle: Battle, x: number, y: number, vx = 0, vy = 0) {
  expect(battle.fire(battle.state.currentPlayer, action(battle))).toBeNull();
  Object.assign(battle.state.projectile, { x, y, vx, vy });
}

function snapshot(battle: Battle): BattleView {
  return battle.state.toJSON() as BattleView;
}

describe("players and lifecycle", () => {
  test("server schema instances retain change-tracking accessors", () => {
    const { battle } = setup();
    for (const [instance, field] of [
      [battle.state, "phase"],
      [battle.state.projectile, "x"],
      [battle.state.explosion, "id"],
      [battle.state.players[0], "hp"],
    ] as const) {
      expect(
        Object.getOwnPropertyDescriptor(instance, field)?.set,
      ).toBeFunction();
    }
  });

  test("waits for two players, starts once and rejects extra or duplicate players", () => {
    const { battle } = setup(false);
    expect(battle.state.phase).toBe("waiting");
    expect(battle.state.remainingMs).toBe(0);
    battle.addPlayer("one");
    expect(battle.state.phase).toBe("waiting");
    expect(() => battle.addPlayer("one")).toThrow();
    battle.addPlayer("two");
    expect(battle.state.phase).toBe("aiming");
    expect(battle.state.currentPlayer).toBe("one");
    expect(battle.state.turnNumber).toBe(1);
    expect(battle.state.remainingMs).toBe(ARENA.turnMs);
    expect(battle.state.players.map((player) => player.number)).toEqual([1, 2]);
    expect(battle.state.players.every((player) => player.hp === 100)).toBe(
      true,
    );
    expect(() => battle.addPlayer("three")).toThrow();
  });

  test("waiting disconnect leaves an open slot and a fresh first player", () => {
    const { battle } = setup(false);
    battle.addPlayer("old");
    battle.removePlayer("missing");
    battle.removePlayer("old");
    expect(battle.state.players.length).toBe(0);
    expect(battle.state.phase).toBe("waiting");
    battle.addPlayer("new");
    battle.addPlayer("two");
    expect(battle.state.currentPlayer).toBe("new");
    expect(battle.state.players.map((player) => player.number)).toEqual([1, 2]);
  });

  test.each([false, true])(
    "disconnect forfeits immediately, including flight=%s",
    (flying) => {
      const { battle, frames } = setup();
      if (flying) battle.fire("one", action(battle));
      battle.removePlayer("one");
      expect(battle.state.phase).toBe("finished");
      expect(battle.state.winner).toBe("two");
      expect(battle.state.finishReason).toBe("forfeit");
      expect(battle.state.players[0].connected).toBe(false);
      expect(battle.state.projectile.active).toBe(false);
      expect(battle.state.remainingMs).toBe(0);
      frames(100);
      battle.removePlayer("two");
      expect(battle.state.winner).toBe("two");
      expect(() => battle.addPlayer("one")).toThrow();
      expect(battle.fire("two", action(battle))).toBeString();
    },
  );
});

describe("untrusted fire intents", () => {
  const invalid: unknown[] = [
    null,
    undefined,
    1,
    "fire",
    [],
    {},
    { angle: "0", power: 0.5, turnNumber: 1 },
    { angle: 0, power: "0.5", turnNumber: 1 },
    { angle: 0, power: 0.5, turnNumber: "1" },
    { angle: Number.NaN, power: 0.5, turnNumber: 1 },
    { angle: Number.POSITIVE_INFINITY, power: 0.5, turnNumber: 1 },
    { angle: Number.NEGATIVE_INFINITY, power: 0.5, turnNumber: 1 },
    { angle: 0, power: Number.NaN, turnNumber: 1 },
    { angle: 0, power: Number.POSITIVE_INFINITY, turnNumber: 1 },
    { angle: 0, power: -0.001, turnNumber: 1 },
    { angle: 0, power: 1.001, turnNumber: 1 },
    { angle: Math.PI + 0.001, power: 0.5, turnNumber: 1 },
    { angle: -Math.PI - 0.001, power: 0.5, turnNumber: 1 },
    { angle: 0, power: 0.5, turnNumber: 1.5 },
    { angle: 0, power: 0.5, turnNumber: Number.NaN },
    { angle: 0, power: 0.5, turnNumber: Number.POSITIVE_INFINITY },
  ];

  test.each(invalid.map((payload) => ({ payload })))(
    "rejects malformed payload %# without mutating state",
    ({ payload }) => {
      const { battle } = setup();
      const before = snapshot(battle);
      expect(battle.fire("one", payload)).toBeString();
      expect(snapshot(battle)).toEqual(before);
    },
  );

  test("rejects waiting, wrong player, unknown player, stale turns, and double fire", () => {
    const waiting = setup(false).battle;
    waiting.addPlayer("one");
    expect(waiting.fire("one", action(waiting))).toBeString();
    const { battle } = setup();
    expect(battle.fire("two", action(battle))).toBeString();
    expect(battle.fire("intruder", action(battle))).toBeString();
    expect(
      battle.fire("one", { ...action(battle), turnNumber: 0 }),
    ).toBeString();
    expect(battle.fire("one", action(battle))).toBeNull();
    const before = snapshot(battle);
    expect(battle.fire("one", action(battle))).toBeString();
    expect(snapshot(battle)).toEqual(before);
  });

  test.each([-Math.PI, Math.PI])("accepts angle endpoint %s", (angle) => {
    const { battle } = setup();
    expect(battle.fire("one", action(battle, angle))).toBeNull();
  });

  test.each([
    [Math.PI / 2, "y"],
    [0, "x"],
  ] as const)(
    "keeps the launched rocket inside the arena for muzzle angle %s",
    (angle, axis) => {
      const { battle, frames } = setup();
      const shooter = battle.state.players[0];
      if (axis === "x") shooter.x = ARENA.width - ARENA.playerRadius;
      expect(battle.fire("one", action(battle, angle, 0))).toBeNull();
      const projectile = battle.state.projectile;
      expect(projectile.x).toBeGreaterThanOrEqual(0);
      expect(projectile.x).toBeLessThanOrEqual(ARENA.width);
      expect(projectile.y).toBeLessThanOrEqual(ARENA.groundY);
      expect(projectile.y).toBeGreaterThanOrEqual(-ARENA.height);
      frames(1);
      expect(battle.state.phase).toBe("exploding");
      expect(battle.state.explosion.x).toBe(projectile.x);
      expect(battle.state.explosion.y).toBe(projectile.y);
    },
  );

  test.each([0, 1])(
    "maps power endpoint %s to authoritative launch speed",
    (power) => {
      const { battle } = setup();
      expect(battle.fire("one", action(battle, -0.5, power))).toBeNull();
      const projectile = battle.state.projectile;
      expect(Math.hypot(projectile.vx, projectile.vy)).toBeCloseTo(
        ARENA.minSpeed + power * (ARENA.maxSpeed - ARENA.minSpeed),
      );
      expect(projectile.active).toBe(true);
      expect(battle.state.phase).toBe("flying");
    },
  );
});

describe("monotonic turn deadlines", () => {
  test("counts down and passes a 15 second idle turn", () => {
    const { battle, advance } = setup();
    advance(14_999);
    expect(battle.state.currentPlayer).toBe("one");
    expect(battle.state.remainingMs).toBe(1);
    advance(1);
    expect(battle.state.currentPlayer).toBe("two");
    expect(battle.state.turnNumber).toBe(2);
    expect(battle.state.remainingMs).toBe(ARENA.turnMs);
    advance(15_000);
    expect(battle.state.currentPlayer).toBe("one");
    expect(battle.state.turnNumber).toBe(3);
  });

  test("fire cannot sneak past a deadline when the tick stalls", () => {
    const { battle, stall } = setup();
    const intent = action(battle);
    stall(15_000);
    expect(battle.fire("one", intent)).toBeString();
    expect(battle.state.projectile.active).toBe(false);
    expect(battle.state.currentPlayer).toBe("two");
    expect(battle.state.turnNumber).toBe(2);
  });

  test("accepts immediately before deadline and stops the aiming clock in flight", () => {
    const { battle, stall, advance } = setup();
    stall(14_999);
    expect(battle.fire("one", action(battle))).toBeNull();
    advance(2);
    expect(battle.state.phase).toBe("flying");
    expect(battle.state.turnNumber).toBe(1);
    expect(battle.state.remainingMs).toBe(0);
  });

  test("stalled turns advance once, not through an unbounded backlog", () => {
    const { battle, advance } = setup();
    advance(1_000_000);
    expect(battle.state.currentPlayer).toBe("two");
    expect(battle.state.turnNumber).toBe(2);
    expect(battle.state.remainingMs).toBe(ARENA.turnMs);
  });

  test("an old intent is stale even when the same player's next turn arrives", () => {
    const { battle, advance } = setup();
    const old = action(battle);
    advance(ARENA.turnMs);
    advance(ARENA.turnMs);
    expect(battle.fire("one", old)).toBeString();
  });
});

describe("fixed 60 Hz physics and swept collisions", () => {
  test("substeps accumulate and integrate ballistic gravity", () => {
    const { battle, advance } = setup();
    battle.fire("one", action(battle));
    const { x, y, vx, vy } = battle.state.projectile;
    advance(ARENA.stepMs / 2);
    expect(battle.state.projectile.x).toBe(x);
    advance(ARENA.stepMs / 2);
    const seconds = ARENA.stepMs / 1000;
    expect(battle.state.projectile.x).toBeCloseTo(x + vx * seconds, 8);
    expect(battle.state.projectile.y).toBeCloseTo(
      y + vy * seconds + 0.5 * ARENA.gravity * seconds ** 2,
      8,
    );
    expect(battle.state.projectile.vy).toBeCloseTo(
      vy + ARENA.gravity * seconds,
      8,
    );
  });

  test("different tick groupings yield identical fixed-step simulation", () => {
    const first = setup();
    const second = setup();
    first.battle.fire("one", action(first.battle));
    second.battle.fire("one", action(second.battle));
    first.frames(30);
    for (let i = 0; i < 10; i++) second.advance(ARENA.stepMs * 3);
    expect(snapshot(first.battle)).toEqual(snapshot(second.battle));
  });

  test("caps stalled physics catch-up to six small steps and drops backlog", () => {
    const { battle, advance } = setup();
    battle.fire("one", action(battle, 0, 1));
    const x = battle.state.projectile.x;
    advance(1_000);
    expect(battle.state.projectile.x - x).toBeLessThanOrEqual(70.000001);
    expect(battle.state.projectile.x - x).toBeGreaterThan(0);
    const after = battle.state.projectile.x;
    advance(0);
    expect(battle.state.projectile.x).toBe(after);
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    "ignores invalid dt %s",
    (dt) => {
      const { battle } = setup();
      battle.fire("one", action(battle));
      const before = snapshot(battle);
      battle.step(dt);
      expect(snapshot(battle)).toEqual(before);
    },
  );

  test("sweeps the first player hit even when an entire body is crossed in one step", () => {
    const { battle, frames } = setup();
    const target = battle.state.players[1];
    placeProjectile(battle, target.x - 80, target.y, 12_000);
    frames(1);
    expect(battle.state.phase).toBe("exploding");
    expect(battle.state.explosion.x).toBeCloseTo(720 - ARENA.playerRadius, 2);
    expect(target.hp).toBeLessThan(100);
    expect(battle.state.projectile.active).toBe(false);
  });

  test("sweeps ground contact instead of exploding below the arena", () => {
    const { battle, frames } = setup();
    placeProjectile(battle, 480, ARENA.groundY - 1, 1_000, 1_000);
    frames(1);
    expect(battle.state.phase).toBe("exploding");
    expect(battle.state.explosion.y).toBe(ARENA.groundY);
    expect(battle.state.explosion.x).toBeGreaterThan(480);
    expect(battle.state.explosion.x).toBeLessThan(482);
  });

  test("chooses ground before a later player intersection", () => {
    const { battle, frames } = setup();
    placeProjectile(battle, 600, ARENA.groundY - 1, 12_000, 1_000);
    frames(1);
    expect(battle.state.explosion.y).toBe(ARENA.groundY);
    expect(battle.state.explosion.x).toBeLessThan(720 - ARENA.playerRadius);
    expect(battle.state.players[1].hp).toBe(100);
  });

  test.each([
    [1, 100, -1_000, 0, 0],
    [ARENA.width - 1, 100, 1_000, 0, ARENA.width],
  ])(
    "bounds outbound shots at the arena edge %#",
    (x, y, vx, vy, expectedX) => {
      const { battle, frames } = setup();
      placeProjectile(battle, x, y, vx, vy);
      frames(1);
      expect(battle.state.phase).toBe("exploding");
      expect(battle.state.explosion.x).toBe(expectedX);
    },
  );

  test("bounds shots above the arena", () => {
    const { battle, frames } = setup();
    placeProjectile(battle, 480, -ARENA.height + 1, 0, -1_000);
    frames(1);
    expect(battle.state.phase).toBe("exploding");
    expect(battle.state.explosion.y).toBe(-ARENA.height);
  });

  test("ends a flight after eight actual seconds even when physics ticks stalled", () => {
    const { battle, advance } = setup();
    battle.fire("one", action(battle));
    advance(ARENA.maxFlightMs);
    expect(battle.state.phase).toBe("exploding");
    expect(battle.state.projectile.active).toBe(false);
  });
});

describe("explosion, damage and knockback", () => {
  test("uses distance-based splash, affects shooter, and leaves distant players unharmed", () => {
    const { battle, frames } = setup();
    const shooter = battle.state.players[0];
    const x = shooter.x;
    placeProjectile(battle, x + 60, ARENA.groundY);
    frames(1);
    const damage = Math.round(
      ARENA.maxDamage *
        (1 - Math.hypot(60, ARENA.playerRadius) / ARENA.blastRadius),
    );
    expect(shooter.hp).toBe(100 - damage);
    expect(battle.state.players[1].hp).toBe(100);
    expect(shooter.x).toBeLessThan(x);
    expect(x - shooter.x).toBeLessThanOrEqual(ARENA.knockback);
    expect(shooter.y).toBe(ARENA.groundY - ARENA.playerRadius);
  });

  test("a vertical shot clears the muzzle then collides with its returning shooter", () => {
    const { battle, frames } = setup();
    expect(battle.fire("one", action(battle, -Math.PI / 2, 0))).toBeNull();
    frames(1);
    expect(battle.state.phase).toBe("flying");
    for (
      let frame = 0;
      frame < 200 && battle.state.phase === "flying";
      frame++
    ) {
      frames(1);
    }
    expect(battle.state.phase).toBe("exploding");
    expect(battle.state.players[0].hp).toBeLessThan(100);
    expect(battle.state.players[1].hp).toBe(100);
  });

  test("maximum damage is 55 and applied once per explosion", () => {
    const { battle, frames, advance } = setup();
    const target = battle.state.players[1];
    placeProjectile(battle, target.x, target.y);
    frames(1);
    expect(target.hp).toBe(45);
    expect(battle.state.explosion.id).toBe(1);
    advance(400);
    expect(target.hp).toBe(45);
    expect(battle.state.explosion.id).toBe(1);
  });

  test("blast radius excludes players at or beyond 100 units", () => {
    const { battle, frames } = setup();
    placeProjectile(battle, 480, ARENA.groundY);
    frames(1);
    expect(battle.state.players.map((player) => player.hp)).toEqual([100, 100]);
  });

  test("small knockback stays inside walls and resolves overlaps without swapping players", () => {
    const { battle, frames } = setup();
    const [left, right] = battle.state.players;
    left.x = ARENA.width - ARENA.playerRadius * 3 - 1;
    right.x = ARENA.width - ARENA.playerRadius;
    const before = [left.x, right.x];
    placeProjectile(battle, left.x - 20, ARENA.groundY);
    frames(1);
    expect(left.x).toBeGreaterThanOrEqual(ARENA.playerRadius);
    expect(right.x).toBeLessThanOrEqual(ARENA.width - ARENA.playerRadius);
    expect(right.x - left.x).toBeGreaterThanOrEqual(ARENA.playerRadius * 2);
    expect(Math.abs(left.x - before[0])).toBeLessThanOrEqual(ARENA.knockback);
    expect(Math.abs(right.x - before[1])).toBeLessThanOrEqual(ARENA.knockback);
  });

  test("holds explosion for 650 ms, rejects fire, then grants exactly one fresh turn", () => {
    const { battle, frames, advance } = setup();
    placeProjectile(battle, 480, ARENA.groundY);
    frames(1);
    expect(battle.fire("one", action(battle))).toBeString();
    advance(ARENA.explosionMs - 1);
    expect(battle.state.phase).toBe("exploding");
    expect(battle.state.currentPlayer).toBe("one");
    advance(1);
    expect(battle.state.phase).toBe("aiming");
    expect(battle.state.currentPlayer).toBe("two");
    expect(battle.state.turnNumber).toBe(2);
    expect(battle.state.remainingMs).toBe(ARENA.turnMs);
  });

  test("a disconnect mid-explosion keeps the resolved elimination and freezes it", () => {
    const { battle, frames, advance } = setup();
    const target = battle.state.players[1];
    target.hp = 5;
    placeProjectile(battle, target.x, target.y);
    frames(1);
    expect(battle.state.phase).toBe("exploding");
    expect(target.hp).toBe(0);
    battle.removePlayer("one");
    expect(battle.state.phase).toBe("finished");
    expect(battle.state.winner).toBe("one");
    expect(battle.state.finishReason).toBe("elimination");
    const frozen = snapshot(battle);
    advance(ARENA.explosionMs + ARENA.turnMs);
    expect(snapshot(battle)).toEqual(frozen);
  });

  test("a disconnect mid-explosion forfeits and never grants the pending turn", () => {
    const { battle, frames, advance } = setup();
    placeProjectile(battle, 480, ARENA.groundY);
    frames(1);
    expect(battle.state.phase).toBe("exploding");
    battle.removePlayer("two");
    expect(battle.state.phase).toBe("finished");
    expect(battle.state.winner).toBe("one");
    expect(battle.state.finishReason).toBe("forfeit");
    const frozen = snapshot(battle);
    advance(ARENA.explosionMs + ARENA.turnMs);
    expect(snapshot(battle)).toEqual(frozen);
    expect(battle.state.turnNumber).toBe(1);
  });

  test("lethal damage clamps HP to zero and ends after the explosion", () => {
    const { battle, frames, advance } = setup();
    const target = battle.state.players[1];
    target.hp = 10;
    placeProjectile(battle, target.x, target.y);
    frames(1);
    expect(target.hp).toBe(0);
    expect(battle.state.phase).toBe("exploding");
    advance(ARENA.explosionMs);
    expect(battle.state.phase).toBe("finished");
    expect(battle.state.winner).toBe("one");
    expect(battle.state.finishReason).toBe("elimination");
    expect(battle.state.remainingMs).toBe(0);
  });

  test("simultaneous lethal splash is a draw, including the shooter", () => {
    const { battle, frames, advance } = setup();
    const [one, two] = battle.state.players;
    one.x = 400;
    two.x = 436;
    one.hp = 40;
    two.hp = 40;
    placeProjectile(battle, 418, ARENA.groundY);
    frames(1);
    expect(battle.state.players.map((player) => player.hp)).toEqual([0, 0]);
    advance(ARENA.explosionMs);
    expect(battle.state.phase).toBe("finished");
    expect(battle.state.winner).toBe("");
    expect(battle.state.finishReason).toBe("draw");
  });

  test("self-elimination awards the opponent", () => {
    const { battle, frames, advance } = setup();
    const shooter = battle.state.players[0];
    shooter.hp = 1;
    placeProjectile(battle, shooter.x, shooter.y);
    frames(1);
    advance(ARENA.explosionMs);
    expect(battle.state.winner).toBe("two");
  });
});

function deterministicMatch() {
  const fixture = setup();
  const { battle } = fixture;
  const turns: BattleView[] = [];
  for (
    let frame = 0;
    frame < 6_000 && battle.state.phase !== "finished";
    frame++
  ) {
    if (battle.state.phase === "aiming") {
      turns.push(snapshot(battle));
      const shooter = battle.state.players.find(
        (player) => player.sessionId === battle.state.currentPlayer,
      );
      const target = battle.state.players.find(
        (player) => player.sessionId !== battle.state.currentPlayer,
      );
      if (!shooter || !target) throw new Error("Missing players");
      const angle = target.x > shooter.x ? -Math.PI / 4 : (-3 * Math.PI) / 4;
      const muzzle = ARENA.playerRadius + 2;
      const dx = Math.abs(target.x - shooter.x) - muzzle / Math.sqrt(2);
      const dy = muzzle / Math.sqrt(2);
      const speed = Math.sqrt((ARENA.gravity * dx * dx) / (dx + dy));
      const power =
        (speed - ARENA.minSpeed) / (ARENA.maxSpeed - ARENA.minSpeed);
      expect(
        battle.fire(shooter.sessionId, action(battle, angle, power)),
      ).toBeNull();
    }
    fixture.frames(1);
  }
  expect(battle.state.phase).toBe("finished");
  expect(battle.state.winner).toBe("one");
  expect(battle.state.finishReason).toBe("elimination");
  expect(turns.length).toBeGreaterThanOrEqual(5);
  return { turns, final: snapshot(battle) };
}

test("a full unmodified match is reproducible from deterministic aim intents", () => {
  expect(deterministicMatch()).toEqual(deterministicMatch());
});
