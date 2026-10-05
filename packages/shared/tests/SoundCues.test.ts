import { expect, test } from "bun:test";
import {
  ARENA,
  Battle,
  type BattleView,
  type SoundCue,
  soundCues,
} from "../src";

function fixture() {
  let now = 0;
  const battle = new Battle(() => now, "andes");
  battle.addPlayer("one");
  battle.addPlayer("two");
  let last = battle.state.toJSON() as BattleView;
  return {
    battle,
    /** Advance the match and collect everything the speakers would play. */
    heard(ms: number = ARENA.stepMs, sessionId = "one") {
      now += ms;
      battle.step(ms);
      const next = battle.state.toJSON() as BattleView;
      const cues = soundCues(last, next, sessionId);
      last = next;
      return cues;
    },
    /** Read cues for an action that changed the state without a tick. */
    after(sessionId = "one") {
      const next = battle.state.toJSON() as BattleView;
      const cues = soundCues(last, next, sessionId);
      last = next;
      return cues;
    },
    until(predicate: () => boolean, sessionId = "one") {
      const collected: SoundCue[] = [];
      for (let frame = 0; frame < 900 && !predicate(); frame++)
        collected.push(...this.heard(ARENA.stepMs, sessionId));
      return collected;
    },
  };
}

const kinds = (cues: SoundCue[]) => cues.map((cue) => cue.kind);

test("the first snapshot is silent, and an unchanged battle stays silent", () => {
  const { battle, heard } = fixture();
  const view = battle.state.toJSON() as BattleView;
  expect(soundCues(null, view, "one")).toEqual([]);
  expect(soundCues(view, view, "one")).toEqual([]);
  expect(heard()).toEqual([]);
});

test("firing, flying and landing each announce themselves once", () => {
  const f = fixture();
  expect(
    f.battle.fire("one", { angle: -1, power: 1, turnNumber: 1 }),
  ).toBeNull();
  expect(f.after()).toEqual([{ kind: "fire", weapon: "rocket" }]);
  const flight = f.until(() => f.battle.state.phase === "exploding");
  expect(kinds(flight).filter((kind) => kind === "fire")).toHaveLength(0);
  const blasts = flight.filter((cue) => cue.kind === "blast");
  expect(blasts).toHaveLength(1);
  expect(blasts[0]).toEqual({
    kind: "blast",
    radius: ARENA.blastRadius,
  });
});

test("a grenade reports every bounce, and a sticky reports its landing", () => {
  const f = fixture();
  f.battle.fire("one", {
    weapon: "grenade",
    angle: -1.2,
    power: 0.6,
    turnNumber: 1,
  });
  f.after();
  const flight = f.until(() => f.battle.state.phase !== "flying");
  expect(f.battle.state.projectile.bounces).toBeGreaterThan(0);
  expect(kinds(flight).filter((kind) => kind === "bounce")).toHaveLength(
    f.battle.state.projectile.bounces,
  );

  const g = fixture();
  g.battle.fire("one", {
    weapon: "sticky",
    angle: Math.PI / 2,
    power: 0,
    turnNumber: 1,
  });
  g.after();
  const stuck = g.until(() => g.battle.state.projectile.stuck);
  expect(kinds(stuck)).toContain("stick");
  expect(
    kinds(g.until(() => g.battle.state.projectile.bounces > 0)),
  ).not.toContain("stick");
});

test("damage names its size and whether it landed on you", () => {
  const f = fixture();
  f.battle.fire("one", { angle: Math.PI / 2, power: 0, turnNumber: 1 });
  f.after();
  const hits = f
    .until(() => f.battle.state.phase === "exploding")
    .filter((cue) => cue.kind === "hurt");
  expect(hits).toHaveLength(1);
  expect(hits[0]).toMatchObject({ mine: true });
  expect(hits[0].kind === "hurt" && hits[0].amount).toBeGreaterThan(0);

  const view = f.battle.state.toJSON() as BattleView;
  const wounded = {
    ...view,
    players: view.players.map((p, i) => (i ? p : { ...p, hp: p.hp - 12 })),
  };
  expect(soundCues(view, wounded, "two")).toEqual([
    { kind: "hurt", amount: 12, mine: false },
  ]);
});

test("healing, shields, leaps and dashes each get their own cue", () => {
  const view = fixture().battle.state.toJSON() as BattleView;
  const healed = {
    ...view,
    players: view.players.map((p, i) => (i ? p : { ...p, hp: p.hp - 25 })),
  };
  expect(soundCues(healed, view, "one")).toEqual([
    { kind: "heal", amount: 25 },
  ]);
  for (const [action, kind] of [
    ["shield", "shield"],
    ["leap", "leap"],
    ["dash", "dash"],
  ] as const) {
    expect(soundCues(view, { ...view, lastAction: action }, "one")).toEqual([
      { kind },
    ]);
    // The same value twice is one action, not two.
    expect(
      soundCues(
        { ...view, lastAction: action },
        { ...view, lastAction: action },
        "one",
      ),
    ).toEqual([]);
  }
});

test("jumping is heard once, and walking is heard per stride rather than per pixel", () => {
  const f = fixture();
  expect(f.battle.jump("one", { direction: 0, turnNumber: 1 })).toBeNull();
  expect(kinds(f.after())).toContain("jump");
  expect(kinds(f.after())).not.toContain("jump");

  const g = fixture();
  const player = g.battle.state.players[0];
  const start = player.x;
  const steps: SoundCue[] = [];
  for (let sequence = 1; sequence <= 8; sequence++) {
    steps.push(...g.heard(100));
    g.battle.move("one", { direction: 1, sequence, turnNumber: 1 });
    steps.push(...g.after());
  }
  expect(player.x - start).toBeCloseTo(8 * ARENA.moveStep);
  // Eight strides of eight pixels cross four sixteen pixel boundaries.
  expect(kinds(steps).filter((kind) => kind === "step")).toHaveLength(4);
});

test("only the player waiting on the other seat hears someone else's turn", () => {
  const f = fixture();
  f.battle.fire("one", { angle: -1, power: 1, turnNumber: 1 });
  f.after();
  const mine = f.until(() => f.battle.state.turnNumber === 2, "one");
  expect(mine.filter((cue) => cue.kind === "turn")).toEqual([
    { kind: "turn", mine: false },
  ]);

  const g = fixture();
  g.battle.fire("one", { angle: -1, power: 1, turnNumber: 1 });
  g.after("two");
  const theirs = g.until(() => g.battle.state.turnNumber === 2, "two");
  expect(theirs.filter((cue) => cue.kind === "turn")).toEqual([
    { kind: "turn", mine: true },
  ]);
});

test("the end of the match sounds different on each side", () => {
  const f = fixture();
  const s = f.battle.state;
  s.players[1].hp = 0;
  const winner = f.until(() => s.phase === "finished", "one");
  expect(s.winner).toBe("one");
  expect(kinds(winner)).toContain("win");
  expect(kinds(winner)).not.toContain("lose");
  // A finished match keeps quiet from then on.
  expect(kinds(f.heard())).not.toContain("win");

  const g = fixture();
  g.battle.state.players[1].hp = 0;
  const loser = g.until(() => g.battle.state.phase === "finished", "two");
  expect(kinds(loser)).toContain("lose");
  expect(kinds(loser)).not.toContain("win");
});
