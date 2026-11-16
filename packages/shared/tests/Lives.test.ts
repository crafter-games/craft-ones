import { expect, test } from "bun:test";
import { ARENA, Battle, type BattleView, soundCues } from "../src";
import { grounded } from "../src/terrainGrid";

function fixture(map: "andes" | "flat" = "andes") {
  let now = 0;
  const battle = new Battle(() => now, map);
  battle.addPlayer("one");
  battle.addPlayer("two");
  return {
    battle,
    until(predicate: () => boolean, frames = 900) {
      for (let i = 0; i < frames && !predicate(); i++) {
        now += ARENA.stepMs;
        battle.step(ARENA.stepMs);
      }
      expect(predicate()).toBe(true);
    },
  };
}

// Shoots the opponent of the current player point blank after leaving it at 1 hp.
function knockOut(f: ReturnType<typeof fixture>, victim: number) {
  const s = f.battle.state;
  f.until(() => s.phase === "aiming");
  const target = s.players[victim];
  target.hp = 1;
  expect(
    f.battle.fire(s.currentPlayer, {
      angle: Math.PI / 2,
      power: 0,
      weapon: "rocket",
      turnNumber: s.turnNumber,
    }),
  ).toBeNull();
  s.projectile.x = target.x;
  s.projectile.y = target.y;
  f.until(() => s.phase === "exploding");
  expect(target.hp).toBe(0);
}

test("every seat starts with the configured lives", () => {
  const { battle } = fixture();
  expect(battle.state.players.map((p) => p.lives)).toEqual([3, 3]);
});

test("a knockout costs a life and respawns on the wrecked map", () => {
  const f = fixture();
  const s = f.battle.state;
  knockOut(f, 1);
  const wrecked = [...s.terrainRows];
  const revision = s.terrainRevision;
  f.until(() => s.phase === "aiming" || s.phase === "finished");
  expect(s.phase).toBe("aiming");
  const p = s.players[1];
  expect(p.lives).toBe(2);
  expect(p.hp).toBe(100);
  expect(p.shield).toBe(0);
  expect(s.terrainRevision).toBe(revision);
  expect([...s.terrainRows]).toEqual(wrecked);
  expect(grounded(s, p.x, p.y)).toBe(true);
  expect(Math.abs(p.x - s.players[0].x)).toBeGreaterThanOrEqual(
    ARENA.playerRadius * 4,
  );
});

test("the third knockout wins the match and a rematch restores lives", () => {
  const f = fixture();
  const s = f.battle.state;
  for (let life = 0; life < ARENA.lives; life++) {
    knockOut(f, 1);
    f.until(() => s.phase === "aiming" || s.phase === "finished");
  }
  expect(s.phase).toBe("finished");
  expect(s.winner).toBe("one");
  expect(s.finishReason).toBe("elimination");
  expect(s.players.map((p) => p.lives)).toEqual([3, 0]);
  expect(f.battle.restart("one", { turnNumber: s.turnNumber })).toBeNull();
  expect(s.players.map((p) => p.lives)).toEqual([3, 3]);
});

test("a void fall costs a life and passes the turn", () => {
  const f = fixture();
  const s = f.battle.state;
  f.until(() => s.phase === "aiming");
  const turn = s.turnNumber;
  const faller = s.players.find((p) => p.sessionId === s.currentPlayer);
  if (!faller) throw new Error("Missing player");
  faller.y = s.worldHeight + 80;
  f.until(() => faller.lives === 2);
  expect(s.phase).toBe("aiming");
  expect(s.turnNumber).toBe(turn + 1);
  expect(s.currentPlayer).not.toBe(faller.sessionId);
  expect(faller.hp).toBe(100);
});

test("a respawn is not heard as a heal", () => {
  const f = fixture();
  const s = f.battle.state;
  knockOut(f, 1);
  const before = s.toJSON() as BattleView;
  f.until(() => s.players[1].hp === 100);
  const cues = soundCues(before, s.toJSON() as BattleView, "one");
  expect(cues.map((c) => c.kind)).not.toContain("heal");
});

test("snapshots carry lives", () => {
  const f = fixture();
  knockOut(f, 1);
  f.until(() => f.battle.state.players[1].lives === 2);
  const copy = new Battle(() => 0, "andes");
  copy.restore(f.battle.snapshot());
  expect(copy.state.players[1].lives).toBe(2);
});
