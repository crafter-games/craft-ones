import { expect, test } from "bun:test";
import {
  ARENA,
  Battle,
  MOON_GRAVITY,
  ROULETTE_WEAPONS,
  TIDE,
  type WeaponId,
} from "../src";

type Options = {
  lives?: number;
  tide?: boolean;
  roulette?: boolean;
  moon?: boolean;
  blastScale?: number;
};

function fixture(o: Options = {}) {
  let now = 0;
  const battle = new Battle(() => now, "andes", 3);
  if (o.lives) battle.lives = o.lives;
  if (o.tide) battle.tide = true;
  if (o.roulette) battle.roulette = true;
  if (o.blastScale) battle.blastScale = o.blastScale;
  if (o.moon) battle.state.gravity = MOON_GRAVITY;
  battle.addPlayer("one");
  battle.addPlayer("two");
  const s = battle.state;
  const tick = () => {
    now += ARENA.stepMs;
    battle.step(ARENA.stepMs);
  };
  const until = (predicate: () => boolean, frames = 1500) => {
    for (let i = 0; i < frames && !predicate(); i++) tick();
    expect(predicate()).toBe(true);
  };
  // Fires `weapon` from the current seat and moves the shot to (x, y) with the given velocity.
  const shoot = (weapon: WeaponId, x: number, y: number, vx = 0, vy = 200) => {
    until(() => s.phase === "aiming");
    expect(
      battle.fire(s.currentPlayer, {
        angle: -1,
        power: 0.5,
        weapon,
        turnNumber: s.turnNumber,
      }),
    ).toBeNull();
    Object.assign(s.projectile, { x, y, vx, vy });
  };
  const solid = () =>
    s.terrainRows.reduce((n, row) => n + row.split("1").length - 1, 0);
  // Runs the shot and everything it spawns until the turn passes; returns the explosions seen.
  const resolveTurn = () => {
    const turn = s.turnNumber;
    let blasts = 0;
    let id = s.explosion.id;
    until(() => s.turnNumber > turn || s.phase === "finished", 4000);
    blasts = s.explosion.id - id;
    id = s.explosion.id;
    return blasts;
  };
  return { battle, s, tick, until, shoot, solid, resolveTurn };
}

test("condor strike marks a spot and drops three eggs that hurt", () => {
  const f = fixture();
  const foe = f.s.players[1];
  f.shoot("condor", foe.x, foe.y - 40);
  const blasts = f.resolveTurn();
  expect(blasts).toBe(4);
  expect(foe.hp).toBeLessThan(100);
});

test("choclo bursts into five popcorn kernels", () => {
  const f = fixture();
  const foe = f.s.players[1];
  f.shoot("choclo", foe.x + 60, foe.y - 30);
  expect(f.resolveTurn()).toBe(6);
  expect(foe.hp).toBeLessThan(100);
});

test("the drill bores a tunnel before it blows", () => {
  const f = fixture();
  const s = f.s;
  // Straight down into the ground between the two critters.
  const x = (s.players[0].x + s.players[1].x) / 2;
  let ground = 0;
  for (let y = 0; y < s.worldHeight; y++)
    if (s.terrainRows[Math.floor(y / 8)]?.[Math.floor(x / 8)] === "1") {
      ground = y;
      break;
    }
  f.shoot("drill", x, ground - 20, 0, 400);
  const before = f.solid();
  f.until(() => s.projectile.bounces > 0);
  const startY = s.projectile.y;
  f.until(() => s.phase === "exploding");
  expect(s.projectile.y).toBeGreaterThan(startY + 150);
  expect(f.solid()).toBeLessThan(before);
});

test("the totora bridge adds ground and hurts nobody", () => {
  const f = fixture();
  const s = f.s;
  const before = f.solid();
  const x = (s.players[0].x + s.players[1].x) / 2;
  f.shoot("totora", x, 200, 0, 300);
  f.until(() => s.phase === "exploding");
  expect(f.solid()).toBeGreaterThan(before);
  expect(s.players.map((p) => p.hp)).toEqual([100, 100]);
});

test("llama spit barely hurts but throws far harder than a rocket", () => {
  const push = (weapon: WeaponId) => {
    const f = fixture();
    const foe = f.s.players[1];
    f.shoot(weapon, foe.x - 30, foe.y);
    f.until(() => f.s.phase === "exploding");
    return { hp: foe.hp, vx: Math.abs(foe.vx), vy: -foe.vy };
  };
  const spit = push("spit");
  const rocket = push("rocket");
  expect(100 - spit.hp).toBeLessThanOrEqual(10);
  expect(spit.vx).toBeGreaterThan(rocket.vx * 2);
  expect(spit.vy).toBeGreaterThan(rocket.vy * 2);
});

test("big boom widens every blast", () => {
  const radius = (scale?: number) => {
    const f = fixture({ blastScale: scale });
    const foe = f.s.players[1];
    f.shoot("rocket", foe.x, foe.y);
    f.until(() => f.s.phase === "exploding");
    return f.s.explosion.radius;
  };
  expect(radius(1.6)).toBeCloseTo(radius() * 1.6, 5);
});

test("on the moon a jump flies higher", () => {
  const peak = (moon: boolean) => {
    const f = fixture({ moon });
    f.until(() => f.s.phase === "aiming");
    const p = f.s.players.find((q) => q.sessionId === f.s.currentPlayer);
    if (!p) throw new Error("no player");
    const start = p.y;
    f.battle.jump(p.sessionId, { turnNumber: f.s.turnNumber, direction: 0 });
    let top = start;
    for (let i = 0; i < 200; i++) {
      f.tick();
      top = Math.min(top, p.y);
    }
    return start - top;
  };
  expect(peak(true)).toBeGreaterThan(peak(false) * 1.8);
});

test("the tide rises from its round and drowns whoever is below it", () => {
  const f = fixture({ tide: true });
  const s = f.s;
  expect(s.water).toBeGreaterThan(s.worldHeight);
  for (let i = 0; s.roundNumber < TIDE.round && i < 40; i++) {
    f.until(() => s.phase === "aiming");
    f.battle.fire(s.currentPlayer, {
      angle: -1.5,
      power: 0,
      weapon: "totora",
      turnNumber: s.turnNumber,
    });
    f.resolveTurn();
  }
  expect(s.roundNumber).toBe(TIDE.round);
  expect(s.water).toBe(s.worldHeight - TIDE.step);
  const victim = s.players[1];
  victim.y = s.water + 10;
  f.until(() => victim.lives === ARENA.lives - 1);
  expect(victim.y).toBeLessThan(s.water);
});

test("roulette hands both seats the same tool each round and locks the hotbar", () => {
  const f = fixture({ roulette: true });
  const s = f.s;
  const picks: string[][] = [];
  for (let turn = 0; turn < 6; turn++) {
    f.until(() => s.phase === "aiming");
    const p = s.players.find((q) => q.sessionId === s.currentPlayer);
    if (!p) throw new Error("no player");
    expect(ROULETTE_WEAPONS).toContain(p.selectedWeapon);
    const other = p.selectedWeapon === "rocket" ? "grenade" : "rocket";
    expect(
      f.battle.select(p.sessionId, {
        selection: other,
        turnNumber: s.turnNumber,
      }),
    ).toBeString();
    if (!picks[s.roundNumber]) picks[s.roundNumber] = [];
    picks[s.roundNumber].push(p.selectedWeapon);
    f.battle.fire(p.sessionId, {
      angle: -1.5,
      power: 0,
      weapon: other,
      turnNumber: s.turnNumber,
    });
    expect(s.projectile.kind).toBe(p.selectedWeapon);
    f.resolveTurn();
  }
  const rounds = picks.filter(Boolean);
  for (const round of rounds) expect(new Set(round).size).toBe(1);
  expect(new Set(rounds.map((r) => r[0])).size).toBeGreaterThan(1);
});

test("one life ends the match on the first knockout", () => {
  const f = fixture({ lives: 1 });
  expect(f.s.maxLives).toBe(1);
  expect(f.s.players.map((p) => p.lives)).toEqual([1, 1]);
  f.s.players[1].y = f.s.worldHeight + 100;
  f.until(() => f.s.phase === "finished");
  expect(f.s.winner).toBe("one");
});

test("snapshots carry modes and queued drops", () => {
  const f = fixture({ tide: true, lives: 5, blastScale: 1.6 });
  const foe = f.s.players[1];
  f.shoot("condor", foe.x, foe.y - 40);
  // Roulette would swap the condor for its own pick, so it only joins for the snapshot.
  f.battle.roulette = true;
  f.until(() => f.s.projectile.kind === "egg");
  const copy = new Battle(() => 0, "andes");
  copy.restore(f.battle.snapshot());
  const snap = copy.snapshot();
  expect(snap.drops).toEqual(f.battle.snapshot().drops);
  expect(snap.drops.length).toBe(8);
  expect([snap.lives, snap.tide, snap.roulette, snap.blastScale]).toEqual([
    5,
    true,
    true,
    1.6,
  ]);
});
