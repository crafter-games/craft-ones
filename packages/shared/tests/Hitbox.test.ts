import { describe, expect, test } from "bun:test";
import {
  ARENA,
  Battle,
  bodiesHit,
  distanceToBody,
  type HitBody,
  insideBody,
} from "../src";

const llama = (x: number, facing = 1): HitBody => ({
  x,
  y: 300,
  hp: 100,
  species: "llama",
  facing,
});

describe("critter silhouettes", () => {
  test("a shot through the ears hits, though it clears the old body circle", () => {
    const body = llama(500);
    // 40 units above the centre: more than the 18-unit circle the hit test used before.
    expect(40).toBeGreaterThan(ARENA.playerRadius);
    const hit = bodiesHit([body], 400, 260, 200, 0, -1);
    expect(hit.index).toBe(0);
    expect(hit.t).toBeLessThan(1);
  });

  test("a shot past the drawing misses", () => {
    expect(bodiesHit([llama(500)], 400, 200, 200, 0, -1).t).toBe(Infinity);
  });

  test("the shooter's own shot leaves its body, anyone else's hits at once", () => {
    const bodies = [llama(500), llama(530)];
    expect(insideBody(bodies[1], 515, 300)).toBe(true);
    expect(bodiesHit(bodies, 500, 300, 0, -1, 0).t).toBe(Infinity);
    expect(bodiesHit(bodies, 515, 300, 1, 0, 0)).toEqual({ t: 0, index: 1 });
  });

  test("facing left mirrors the silhouette", () => {
    // Off the half-unit grid the vertices sit on, so no sample lands on an edge.
    for (let dx = -40.37; dx <= 40; dx += 2)
      for (let dy = -80.23; dy <= 30; dy += 2)
        expect(insideBody(llama(500, -1), 500 - dx, 300 + dy)).toBe(
          insideBody(llama(500, 1), 500 + dx, 300 + dy),
        );
  });

  test("distance is 0 inside and grows outside", () => {
    expect(distanceToBody(llama(500), 500, 300)).toBe(0);
    expect(distanceToBody(llama(500), 600, 300)).toBeGreaterThan(60);
  });

  test("a level shot at head height stops on the target in a match", () => {
    let time = 0;
    const battle = new Battle(() => time, "andes", 7);
    battle.addPlayer("one", { species: "cuy" });
    battle.addPlayer("two", { species: "llama" });
    time += ARENA.stepMs;
    battle.step(ARENA.stepMs);
    const target = battle.state.players[1];
    target.facing = -1;
    expect(
      battle.fire(battle.state.currentPlayer, {
        angle: 0,
        power: 0.5,
        turnNumber: battle.state.turnNumber,
      }),
    ).toBeNull();
    const headY = target.y - 30;
    Object.assign(battle.state.projectile, {
      x: target.x - 60,
      y: headY,
      vx: 900,
      vy: 0,
    });
    for (let i = 0; i < 10 && battle.state.phase === "flying"; i++) {
      time += ARENA.stepMs;
      battle.step(ARENA.stepMs);
    }
    expect(battle.state.phase).toBe("exploding");
    expect(battle.state.explosion.x).toBeLessThan(target.x);
    expect(Math.abs(battle.state.explosion.y - headY)).toBeLessThan(3);
    expect(target.hp).toBeLessThan(100);
  });
});
