import { expect, test } from "bun:test";
import { ARENA, Battle, WEAPONS, type WeaponId } from "../src";

function fixture(species = "railly") {
  let now = 0;
  const battle = new Battle(() => now);
  const one = battle.addPlayer("one", { species, coat: "cream" });
  const two = battle.addPlayer("two");
  return {
    battle,
    one,
    two,
    expire() {
      now += ARENA.turnMs;
      battle.step(0);
    },
  };
}

test("each seat retains its validated tool across turns and resets on rematch", () => {
  const { battle, one, two, expire } = fixture();
  expect(
    battle.select("one", { selection: "grenade", turnNumber: 1 }),
  ).toBeNull();
  expect(one.selectedWeapon).toBe("grenade");
  expect(two.selectedWeapon).toBe("rocket");
  expire();
  expect(
    battle.select("two", { selection: "mortar", turnNumber: 2 }),
  ).toBeNull();
  expire();
  expect(one.selectedWeapon).toBe("grenade");
  expect(two.selectedWeapon).toBe("mortar");
  battle.state.phase = "finished";
  expect(battle.restart("one", { turnNumber: 3 })).toBeNull();
  expect(one.selectedWeapon).toBe("rocket");
  expect(two.selectedWeapon).toBe("rocket");
  expect(one.abilityArmed).toBe(false);
});

test("selection validates owner, turn, phase, payload and ability availability without spending the turn", () => {
  const { battle, one, expire } = fixture();
  const before = battle.state.toJSON();
  for (const payload of [
    null,
    [],
    {},
    { selection: "rift", turnNumber: 1 },
    { selection: "grenade", turnNumber: 0 },
    { selection: "grenade", turnNumber: "1" },
  ]) {
    expect(battle.select("one", payload)).toBeString();
    expect(battle.state.toJSON()).toEqual(before);
  }
  for (const id of ["two", "intruder"])
    expect(
      battle.select(id, { selection: "grenade", turnNumber: 1 }),
    ).toBeString();
  expect(
    battle.select("one", { selection: "ability", turnNumber: 1 }),
  ).toBeNull();
  expect(one.abilityArmed).toBe(true);
  expect(battle.state.phase).toBe("aiming");
  expect(battle.state.remainingMs).toBe(ARENA.turnMs);
  expect(one.abilityReadyTurn).toBe(0);
  expect(
    battle.select("one", { selection: "sticky", turnNumber: 1 }),
  ).toBeNull();
  expect(one.abilityArmed).toBe(false);
  expect(
    battle.select("one", { selection: "ability", turnNumber: 1 }),
  ).toBeNull();
  expire();
  expect(one.abilityArmed).toBe(false);
  expire();
  one.abilityReadyTurn = 5;
  expect(
    battle.select("one", { selection: "ability", turnNumber: 3 }),
  ).toBeString();
  one.connected = false;
  expect(
    battle.select("one", { selection: "rocket", turnNumber: 3 }),
  ).toBeString();
  const cuy = fixture("cuy");
  expect(
    cuy.battle.select("one", { selection: "ability", turnNumber: 1 }),
  ).toBeString();
});

test.each(Object.keys(WEAPONS) as WeaponId[])(
  "%s fires the synchronized selection and freezes selection during flight",
  (weapon) => {
    const { battle, one } = fixture();
    expect(
      battle.select("one", { selection: weapon, turnNumber: 1 }),
    ).toBeNull();
    expect(
      battle.fire("one", { angle: -1, power: 0.5, turnNumber: 1 }),
    ).toBeNull();
    expect(battle.state.projectile.kind).toBe(weapon);
    expect(one.selectedWeapon).toBe(weapon);
    expect(one.abilityArmed).toBe(false);
    expect(
      battle.select("one", { selection: "dynamite", turnNumber: 1 }),
    ).toBeString();
  },
);

test("direct fire intentions update only the shooter's validated selection", () => {
  const { battle, one, two } = fixture();
  expect(
    battle.fire("one", {
      weapon: "mortar",
      angle: -1,
      power: 0.5,
      turnNumber: 1,
    }),
  ).toBeNull();
  expect(one.selectedWeapon).toBe("mortar");
  expect(two.selectedWeapon).toBe("rocket");
});

test("exclusive abilities keep the chosen tool but render their own power during flight", () => {
  const { battle, one } = fixture();
  battle.select("one", { selection: "grenade", turnNumber: 1 });
  expect(
    battle.ability("one", { angle: -1, power: 0.5, turnNumber: 1 }),
  ).toBeNull();
  expect(one.selectedWeapon).toBe("grenade");
  expect(one.abilityArmed).toBe(true);
  expect(battle.state.projectile.kind).toBe("shuriken");
});

test("selection cannot extend an expired turn or alter dead and waiting players", () => {
  let now = 0;
  const battle = new Battle(() => now);
  const one = battle.addPlayer("one");
  expect(
    battle.select("one", { selection: "mortar", turnNumber: 0 }),
  ).toBeString();
  battle.addPlayer("two");
  now = ARENA.turnMs;
  expect(battle.select("one", { selection: "mortar", turnNumber: 1 })).toBe(
    "Turn expired",
  );
  expect(one.selectedWeapon).toBe("rocket");
  expect(battle.state.turnNumber).toBe(2);
  battle.state.players[1].hp = 0;
  expect(
    battle.select("two", { selection: "mortar", turnNumber: 2 }),
  ).toBeString();
});

test("firing immediately after selection uses the server's armed power without waiting for a snapshot", () => {
  const { battle, one } = fixture();
  battle.select("one", { selection: "grenade", turnNumber: 1 });
  battle.select("one", { selection: "ability", turnNumber: 1 });
  expect(
    battle.fire("one", { angle: -1, power: 0.5, turnNumber: 1 }),
  ).toBeNull();
  expect(battle.state.projectile.kind).toBe("shuriken");
  expect(one.abilityArmed).toBe(true);
  expect(one.selectedWeapon).toBe("grenade");
});

test("a movement ability fired through the selected action derives direction from aim", () => {
  const { battle, one } = fixture("llama");
  battle.select("one", { selection: "ability", turnNumber: 1 });
  expect(
    battle.fire("one", { angle: -Math.PI, power: 0.5, turnNumber: 1 }),
  ).toBeNull();
  expect(one.vx).toBeLessThan(0);
  expect(one.vy).toBeLessThan(0);
  expect(battle.state.lastAction).toBe("leap");
  expect(battle.state.projectile.active).toBe(false);
});
