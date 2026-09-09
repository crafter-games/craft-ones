import { expect, test } from "bun:test";
import {
  ARENA,
  Battle,
  bodyBlocked,
  CELL,
  COATS,
  type CoatId,
  grounded,
  SPECIES,
} from "@craft-ones/shared";

function fixture(species: "zorro" | "ronsoco" | "puma" | "alpaca") {
  let now = 0;
  const battle = new Battle(() => now, "andes");
  battle.addPlayer("one", { species, coat: "slate" });
  battle.addPlayer("two");
  const s = battle.state,
    p = s.players[0];
  // A long, level lane isolates ability behavior from individual map layouts.
  for (let y = 0; y < s.terrainRows.length; y++)
    s.terrainRows[y] = (y * CELL >= 640 ? "1" : "0").repeat(
      s.worldWidth / CELL,
    );
  p.x = 300;
  p.y = 622;
  s.players[1].y = 622;
  return {
    battle,
    s,
    p,
    tick(ms = ARENA.stepMs) {
      now += ms;
      battle.step(ms);
    },
    until(predicate: () => boolean) {
      for (let i = 0; i < 700 && !predicate(); i++) {
        now += ARENA.stepMs;
        battle.step(ARENA.stepMs);
      }
      expect(predicate()).toBe(true);
    },
  };
}

test("all four characters accept every authored coat without accepting forged stats", () => {
  for (const species of SPECIES)
    for (const coat of Object.keys(COATS) as CoatId[]) {
      const b = new Battle(undefined, "andes");
      const p = b.addPlayer("one", { species, coat, shield: 999, hp: 999 });
      expect([p.species, p.coat, p.hp, p.shield]).toEqual([
        species,
        coat,
        100,
        0,
      ]);
    }
});
test("Zorro travels up to 320 units, consumes one turn and enforces cooldown", () => {
  const { battle, s, p, until, tick } = fixture("zorro");
  expect(battle.ability("one", { direction: 1, turnNumber: 1 })).toBeNull();
  expect(p.x).toBe(620);
  expect(s.phase).toBe("resolving");
  expect(p.abilityReadyTurn).toBe(5);
  expect(battle.ability("one", { direction: 1, turnNumber: 1 })).toBeString();
  expect(
    battle.fire("one", { angle: 0, power: 1, turnNumber: 1 }),
  ).toBeString();
  until(() => s.phase === "aiming");
  expect(s.currentPlayer).toBe("two");
  tick(ARENA.turnMs);
  expect(battle.ability("one", { direction: -1, turnNumber: 3 })).toBeString();
  tick(ARENA.turnMs);
  tick(ARENA.turnMs);
  expect(battle.ability("one", { direction: -1, turnNumber: 5 })).toBeNull();
  expect(p.x).toBe(300);
});
test.each(["wall", "ledge", "opponent"] as const)(
  "Zorro stops before a %s",
  (obstacle) => {
    const { battle, s, p } = fixture("zorro");
    if (obstacle === "wall")
      for (let y = 60; y < 80; y++)
        s.terrainRows[y] =
          `${s.terrainRows[y].slice(0, 60)}1${s.terrainRows[y].slice(61)}`;
    if (obstacle === "ledge")
      for (let y = 80; y < s.terrainRows.length; y++)
        s.terrainRows[y] =
          "1".repeat(60) + "0".repeat(s.worldWidth / CELL - 60);
    if (obstacle === "opponent") s.players[1].x = 480;
    expect(battle.ability("one", { direction: 1, turnNumber: 1 })).toBeNull();
    expect(p.x).toBeGreaterThan(300);
    expect(p.x).toBeLessThan(500);
    expect(grounded(s, p.x, p.y)).toBe(true);
    expect(bodyBlocked(s, p.x, p.y)).toBe(false);
    if (obstacle === "opponent")
      expect(s.players[1].x - p.x).toBeGreaterThanOrEqual(
        ARENA.playerRadius * 2,
      );
  },
);
test("invalid, airborne, stale and out-of-turn dash attempts do not mutate the match", () => {
  const { battle, s, p } = fixture("zorro");
  const before = JSON.stringify(s.toJSON());
  for (const payload of [
    null,
    [],
    { direction: 2, turnNumber: 1 },
    { direction: 1, turnNumber: 99 },
  ])
    expect(battle.ability("one", payload)).toBeString();
  expect(battle.ability("two", { direction: 1, turnNumber: 1 })).toBeString();
  expect(JSON.stringify(s.toJSON())).toBe(before);
  p.y -= 100;
  const x = p.x;
  expect(battle.ability("one", { direction: 1, turnNumber: 1 })).toBeString();
  expect(p.x).toBe(x);
  expect(s.phase).toBe("aiming");
});
test("Puma pounces flatter and further than a leap, and only from the ground", () => {
  const { battle, s, p, until } = fixture("puma");
  expect(battle.ability("one", { direction: 1, turnNumber: 1 })).toBeNull();
  let highest = p.y;
  const start = p.x;
  until(() => {
    highest = Math.min(highest, p.y);
    return s.phase === "aiming";
  });
  expect(p.x - start).toBeGreaterThan(200);
  // A llama's leap climbs higher; the pounce trades height for distance.
  expect(622 - highest).toBeLessThan(160);
  const airborne = fixture("puma");
  airborne.p.y -= 120;
  expect(
    airborne.battle.ability("one", { direction: 1, turnNumber: 1 }),
  ).toBeString();
});
test("Alpaca heals 25 up to full health, spends the turn and respects cooldown", () => {
  const { battle, s, p, until, tick } = fixture("alpaca");
  expect(battle.ability("one", { turnNumber: 1 })).toBe(
    "Already at full health",
  );
  p.hp = 60;
  expect(battle.ability("one", { turnNumber: 1 })).toBeNull();
  expect(p.hp).toBe(85);
  until(() => s.phase === "aiming");
  expect(s.turnNumber).toBe(2);
  p.hp = 40;
  expect(battle.ability("one", { turnNumber: 2 })).toBeString();
  expect(p.hp).toBe(40);
  for (let i = 0; i < 3; i++) tick(ARENA.turnMs);
  expect(battle.ability("one", { turnNumber: s.turnNumber })).toBeNull();
  expect(p.hp).toBe(65);
});
test("Ronsoco shield survives turns, cannot stack and absorbs exactly 30 damage", () => {
  const protectedMatch = fixture("ronsoco"),
    baseline = fixture("ronsoco");
  const { battle, s, p, until, tick } = protectedMatch;
  expect(battle.ability("one", { turnNumber: 1 })).toBeNull();
  expect(p.shield).toBe(30);
  expect(battle.ability("one", { turnNumber: 1 })).toBeString();
  until(() => s.phase === "aiming");
  for (let i = 0; i < 3; i++) tick(ARENA.turnMs);
  expect(s.turnNumber).toBe(5);
  expect(battle.ability("one", { turnNumber: 5 })).toBeString();
  expect(p.shield).toBe(30);
  expect(s.phase).toBe("aiming");
  for (const f of [protectedMatch, baseline]) {
    expect(
      f.battle.fire("one", {
        weapon: "rocket",
        angle: Math.PI / 2,
        power: 0,
        turnNumber: f.s.turnNumber,
      }),
    ).toBeNull();
    f.until(() => f.s.phase === "exploding");
  }
  expect(baseline.p.hp).toBeLessThan(70);
  expect(p.hp - baseline.p.hp).toBe(30);
  expect(p.shield).toBe(0);
  const hp = p.hp;
  for (let i = 0; i < 5; i++) tick();
  expect(p.hp).toBe(hp);
});
test("shield does not prevent void death and is cleared on rematch", () => {
  const { battle, s, p, tick, until } = fixture("ronsoco");
  battle.ability("one", { turnNumber: 1 });
  p.y = s.worldHeight + 80;
  tick();
  expect(p.hp).toBe(0);
  until(() => s.phase === "finished");
  expect(battle.restart("one", { turnNumber: s.turnNumber })).toBeNull();
  expect(p.shield).toBe(0);
  expect(p.species).toBe("ronsoco");
});
