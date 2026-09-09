import { expect, test } from "bun:test";
import {
  ARENA,
  abilityProjectile,
  Battle,
  type BattleView,
  CHARACTERS,
  SPECIES,
  shotTrajectory,
  soundCues,
  validPlayerOptions,
  WEAPONS,
} from "@craft-ones/shared";

const guests = ["freddy", "michi", "railly"] as const;
function fixture(species: (typeof guests)[number]) {
  let now = 0;
  const battle = new Battle(() => now, "andes");
  battle.addPlayer("one", { species, coat: "cream" });
  battle.addPlayer("two");
  return {
    battle,
    tick(ms = ARENA.stepMs) {
      now += ms;
      battle.step(ms);
    },
  };
}

test("exclusive guests are playable in either seat without adding public weapons", () => {
  expect(SPECIES).toHaveLength(9);
  expect(Object.keys(WEAPONS)).toHaveLength(6);
  for (const species of guests) {
    expect(CHARACTERS[species].name.length).toBeGreaterThan(3);
    expect(validPlayerOptions({ species, coat: "cream" })).toBe(true);
    const b = new Battle(() => 0, "andes");
    b.addPlayer("one", { species, coat: "cream" });
    b.addPlayer("two", { species, coat: "cream" });
    expect(b.state.players.every((p) => p.species === species)).toBe(true);
  }
});

test.each([...guests])(
  "%s aimed ability validates intents, consumes one turn and damages authoritatively",
  (species) => {
    const { battle, tick } = fixture(species);
    const s = battle.state;
    const before = JSON.stringify(s.toJSON());
    for (const payload of [
      { turnNumber: 1 },
      { angle: NaN, power: 1, turnNumber: 1 },
      { angle: 0, power: 2, turnNumber: 1 },
      { angle: 0, power: 1, turnNumber: 0 },
    ]) {
      expect(battle.ability("one", payload)).toBeString();
      expect(JSON.stringify(s.toJSON())).toBe(before);
    }
    expect(
      battle.ability("two", { angle: 0, power: 1, turnNumber: 1 }),
    ).toBeString();
    const kind = abilityProjectile(species);
    if (!kind) throw new Error("Missing ability projectile");
    expect(
      battle.fire("one", { weapon: kind, angle: 0, power: 1, turnNumber: 1 }),
    ).toBeString();
    // A close target on the same broad shelf; skill still goes through collision.
    s.players[1].x = s.players[0].x + 96;
    s.players[1].y = s.players[0].y;
    const view = s.toJSON() as BattleView;
    const expected = shotTrajectory(
      view,
      view.players,
      view.players[0],
      0,
      1,
      kind,
    ).at(-1);
    expect(
      battle.ability("one", { angle: 0, power: 1, turnNumber: 1 }),
    ).toBeNull();
    expect(s.phase).toBe("flying");
    expect(s.players[0].abilityReadyTurn).toBe(5);
    expect(s.projectile.kind).toBe(kind);
    expect(
      battle.ability("one", { angle: 0, power: 1, turnNumber: 1 }),
    ).toBeString();
    for (
      let i = 0;
      i < 1000 && s.turnNumber === 1 && s.phase !== "finished";
      i++
    )
      tick();
    expect(s.players[1].hp).toBeLessThan(100);
    expect(s.explosion.id).toBe(species === "railly" ? 3 : 1);
    if (species !== "railly") {
      expect(s.explosion.x).toBeCloseTo(expected?.x ?? -1, 4);
      expect(s.explosion.y).toBeCloseTo(expected?.y ?? -1, 4);
    }
    expect(s.turnNumber).toBe(2);
    tick(ARENA.turnMs);
    expect(
      battle.ability("one", { angle: 0, power: 1, turnNumber: 3 }),
    ).toBeString();
  },
);

test("Railly's volley stops on elimination and cannot leak into a rematch", () => {
  const { battle, tick } = fixture("railly");
  const s = battle.state;
  s.players[1].hp = 1;
  s.players[1].x = s.players[0].x + 96;
  s.players[1].y = s.players[0].y;
  expect(
    battle.ability("one", { angle: 0, power: 1, turnNumber: 1 }),
  ).toBeNull();
  for (let i = 0; i < 400 && s.phase !== "finished"; i++) tick();
  expect(s.phase).toBe("finished");
  expect(s.explosion.id).toBe(1);
  expect(s.winner).toBe("one");
  expect(battle.restart("one", { turnNumber: s.turnNumber })).toBeNull();
  expect(s.projectile.active).toBe(false);
  expect(s.players[0].abilityReadyTurn).toBe(0);
  tick(1000);
  expect(s.phase).toBe("aiming");
  expect(s.projectile.active).toBe(false);
  expect(s.explosion.id).toBe(1);
});

test("Railly fires and sounds three times on both seats, then releases the turn and recovers after cooldown", () => {
  const { battle, tick } = fixture("railly");
  const s = battle.state;
  let previous = s.toJSON() as BattleView;
  expect(
    battle.ability("one", { angle: -Math.PI / 2, power: 1, turnNumber: 1 }),
  ).toBeNull();
  let fires = 0;
  for (let i = 0; i < 1800 && s.turnNumber === 1; i++) {
    const next = s.toJSON() as BattleView;
    const one = soundCues(previous, next, "one").filter(
      (c) => c.kind === "fire",
    );
    const two = soundCues(previous, next, "two").filter(
      (c) => c.kind === "fire",
    );
    expect(one).toEqual(two);
    fires += one.length;
    previous = next;
    tick();
  }
  expect(fires).toBe(3);
  expect(s.turnNumber).toBe(2);
  expect(s.explosion.id).toBe(3);
  tick(ARENA.turnMs);
  expect(s.turnNumber).toBe(3);
  expect(
    battle.ability("one", { angle: 0, power: 1, turnNumber: 3 }),
  ).toBeString();
  tick(ARENA.turnMs);
  tick(ARENA.turnMs);
  expect(s.turnNumber).toBe(5);
  expect(
    battle.ability("one", { angle: 0, power: 1, turnNumber: 5 }),
  ).toBeNull();
});
