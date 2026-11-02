import { expect, test } from "bun:test";
import {
  ABILITIES,
  ABILITY_STRIKES,
  ARENA,
  abilityProjectile,
  Battle,
  CELL,
  PROJECTILES,
  SPECIES,
  type Species,
  volleySpread,
} from "../src";

function fixture(species: Species, foe: Species = "cuy") {
  let now = 0;
  const battle = new Battle(() => now, "andes");
  battle.addPlayer("one", { species, coat: "slate" });
  battle.addPlayer("two", { species: foe, coat: "cream" });
  const s = battle.state;
  // A long, level lane isolates ability behavior from individual map layouts.
  for (let y = 0; y < s.terrainRows.length; y++)
    s.terrainRows[y] = (y * CELL >= 640 ? "1" : "0").repeat(
      s.worldWidth / CELL,
    );
  const [p, q] = s.players;
  p.x = 300;
  p.y = 622;
  q.x = 1500;
  q.y = 622;
  return {
    battle,
    s,
    p,
    q,
    tick(ms = ARENA.stepMs) {
      now += ms;
      battle.step(ms);
    },
    until(predicate: () => boolean) {
      for (let i = 0; i < 1500 && !predicate(); i++) {
        now += ARENA.stepMs;
        battle.step(ARENA.stepMs);
      }
      expect(predicate()).toBe(true);
    },
  };
}

test("every character has a power with a name and a description", () => {
  for (const species of SPECIES) {
    expect(ABILITIES[species].name.length).toBeGreaterThan(3);
    expect(ABILITIES[species].description).toContain("2-turn cooldown");
  }
});

test("each projectile power stays below the rocket's damage per shot", () => {
  for (const species of SPECIES) {
    const kind = abilityProjectile(species);
    if (kind) expect(PROJECTILES[kind].damage).toBeLessThanOrEqual(70);
  }
  for (const strike of Object.values(ABILITY_STRIKES))
    expect(strike.damage).toBeLessThan(55);
});

test("Cuy lobs three potatoes in a fan, once per two turns", () => {
  const { battle, s, p, tick, until } = fixture("cuy");
  expect(volleySpread("cuy")).toBeGreaterThan(0);
  const fire = { angle: -1, power: 0.8, turnNumber: 1 };
  expect(battle.ability("one", fire)).toBeNull();
  expect(s.projectile.kind).toBe("papa");
  expect(s.actionId).toBe(1);
  expect(p.abilityReadyTurn).toBe(5);
  const launches = [Math.atan2(s.projectile.vy, s.projectile.vx)];
  let phase = s.phase;
  for (let i = 0; i < 3000 && s.phase !== "aiming"; i++) {
    tick();
    if (s.phase === "flying" && phase !== "flying")
      launches.push(Math.atan2(s.projectile.vy, s.projectile.vx));
    phase = s.phase;
  }
  expect(launches).toHaveLength(3);
  expect(launches[1] - launches[0]).toBeCloseTo(volleySpread("cuy"), 1);
  expect(launches[2] - launches[1]).toBeCloseTo(volleySpread("cuy"), 1);
  expect(s.actionId).toBe(1);
  until(() => s.currentPlayer === "two");
  expect(battle.ability("one", { ...fire, turnNumber: 2 })).toBeString();
});

function landing(species: "llama" | "puma") {
  const f = fixture(species);
  expect(f.battle.ability("one", { direction: 1, turnNumber: 1 })).toBeNull();
  expect(f.p.strike).toBe(species === "llama" ? 1 : 2);
  f.until(() => f.s.phase === "aiming");
  return f.p.x;
}

test.each([
  ["llama", "stomp", ABILITY_STRIKES.stomp],
  ["puma", "claw", ABILITY_STRIKES.claw],
] as const)(
  "%s %s hits an enemy beside the landing spot",
  (species, action, strike) => {
    const landX = landing(species);
    const f = fixture(species);
    f.q.x = landX + strike.range / 2;
    f.q.y = 622;
    const idBefore = f.s.actionId;
    expect(f.battle.ability("one", { direction: 1, turnNumber: 1 })).toBeNull();
    expect(f.s.actionId).toBe(idBefore + 1);
    f.until(() => f.s.phase === "aiming");
    expect(f.q.hp).toBe(100 - strike.damage);
    expect(f.s.lastAction).toBe(action);
    expect(f.s.actionId).toBe(idBefore + 2);
    expect(f.p.strike).toBe(0);
  },
);

test.each(["llama", "puma"] as const)(
  "%s lands without a hit when the enemy is far away",
  (species) => {
    const f = fixture(species);
    expect(f.battle.ability("one", { direction: 1, turnNumber: 1 })).toBeNull();
    f.until(() => f.s.phase === "aiming");
    expect(f.q.hp).toBe(100);
    expect(f.s.actionId).toBe(1);
    expect(f.p.strike).toBe(0);
  },
);

test("a leap in flight survives snapshot and restore and still lands its hit", () => {
  const landX = landing("llama");
  const f = fixture("llama");
  f.q.x = landX + 40;
  expect(f.battle.ability("one", { direction: 1, turnNumber: 1 })).toBeNull();
  for (let i = 0; i < 10; i++) f.tick();
  const snap = JSON.parse(JSON.stringify(f.battle.snapshot()));
  expect(snap.state.players[0].strike).toBe(1);
  let t = 0;
  const copy = new Battle(() => t, "andes");
  copy.addPlayer("one", { species: "llama", coat: "slate" });
  copy.addPlayer("two", { species: "cuy", coat: "cream" });
  copy.restore(snap);
  expect(copy.state.actionId).toBe(1);
  for (let i = 0; i < 1500 && copy.state.phase !== "aiming"; i++) {
    t += ARENA.stepMs;
    copy.step(ARENA.stepMs);
  }
  expect(copy.state.players[1].hp).toBe(100 - ABILITY_STRIKES.stomp.damage);
  expect(copy.state.lastAction).toBe("stomp");
});

test("Zorro bites an enemy at the end of the dash and only then", () => {
  const near = fixture("zorro");
  near.q.x = 700;
  near.q.y = 622;
  expect(
    near.battle.ability("one", { direction: 1, turnNumber: 1 }),
  ).toBeNull();
  expect(near.s.lastAction).toBe("bite");
  expect(near.q.hp).toBe(100 - ABILITY_STRIKES.bite.damage);
  expect(near.s.actionId).toBe(1);

  const far = fixture("zorro");
  expect(far.battle.ability("one", { direction: 1, turnNumber: 1 })).toBeNull();
  expect(far.s.lastAction).toBe("dash");
  expect(far.q.hp).toBe(100);
});

test("a shielded enemy absorbs a bite before taking health damage", () => {
  const f = fixture("zorro", "ronsoco");
  f.q.x = 700;
  f.q.y = 622;
  f.q.shield = 30;
  expect(f.battle.ability("one", { direction: 1, turnNumber: 1 })).toBeNull();
  expect(f.q.shield).toBe(0);
  expect(f.q.hp).toBe(100);
});

test("Ronsoco and Alpaca register each use as a new action", () => {
  const r = fixture("ronsoco");
  expect(r.battle.ability("one", { turnNumber: 1 })).toBeNull();
  expect([r.s.lastAction, r.s.actionId]).toEqual(["shield", 1]);
  const a = fixture("alpaca");
  a.p.hp = 50;
  expect(a.battle.ability("one", { turnNumber: 1 })).toBeNull();
  expect([a.s.lastAction, a.s.actionId, a.p.hp]).toEqual(["heal", 1, 75]);
});
