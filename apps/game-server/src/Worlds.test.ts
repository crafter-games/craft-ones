import { expect, test } from "bun:test";
import {
  ARENA,
  Battle,
  type BattleView,
  bodyBlocked,
  CELL,
  eraseCircle,
  gridHit,
  grounded,
  makeTerrain,
  makeWorld,
  type PlayableMapId,
  shotTrajectory,
  solidAt,
  WORLD_HEIGHT,
  WORLD_MAPS,
  WORLD_WIDTH,
} from "@craft-ones/shared";
import * as worlds from "../../../packages/shared/src/worlds";

type NewMapId = Exclude<PlayableMapId, "andes" | "coast">;
const NEW_MAP_IDS: NewMapId[] = [
  "canopy",
  "caldera",
  "totora",
  "saltglass",
  "huaca",
  "frost",
  "loom",
  "harbor",
];

function fixture(mapId: PlayableMapId) {
  let now = 0;
  const battle = new Battle(() => now, mapId);
  battle.addPlayer("one");
  battle.addPlayer("two");
  return {
    battle,
    tick(ms: number = ARENA.stepMs) {
      now += ms;
      battle.step(ms);
    },
    until(predicate: () => boolean, frames = 720) {
      for (let i = 0; i < frames && !predicate(); i++) {
        now += ARENA.stepMs;
        battle.step(ARENA.stepMs);
      }
      expect(predicate()).toBe(true);
    },
  };
}

function spawnsOf(id: PlayableMapId) {
  return WORLD_MAPS[id].spawns.map((spawn) => [...spawn]);
}

function solidCount(rows: Iterable<string>) {
  return [...rows].reduce(
    (total, row) => total + [...row].filter((cell) => cell === "1").length,
    0,
  );
}

function components(rows: string[]) {
  const remaining = new Set<number>();
  const width = WORLD_WIDTH / CELL;
  rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === "1") remaining.add(y * width + x);
    });
  });
  let count = 0;
  while (remaining.size) {
    const first = remaining.values().next().value;
    if (first === undefined) break;
    const stack = [first];
    remaining.delete(first);
    count++;
    while (stack.length) {
      const current = stack.pop();
      if (current === undefined) break;
      const x = current % width;
      const neighbors = [current - width, current + width];
      if (x > 0) neighbors.push(current - 1);
      if (x < width - 1) neighbors.push(current + 1);
      for (const next of neighbors)
        if (remaining.delete(next)) stack.push(next);
    }
  }
  return count;
}

test("the public map catalog includes ten authored worlds and excludes flat", () => {
  expect(worlds.PLAYABLE_MAP_IDS).toEqual([
    "andes",
    "coast",
    "canopy",
    "caldera",
    "totora",
    "saltglass",
    "huaca",
    "frost",
    "loom",
    "harbor",
  ]);
  expect(Object.keys(WORLD_MAPS)).toEqual([...worlds.PLAYABLE_MAP_IDS]);
  for (const id of NEW_MAP_IDS) {
    expect(WORLD_MAPS[id].background).toBe(`maps/${id}.svg`);
    expect(WORLD_MAPS[id].preview).toBe(`maps/${id}-preview.svg`);
    expect(WORLD_MAPS[id].name.length).toBeGreaterThan(5);
  }
});

test.each(NEW_MAP_IDS)(
  "%s constructs a unique deterministic full-sized grid, never a fallback world",
  (id) => {
    const { battle } = fixture(id);
    const rows = [...battle.state.terrainRows];
    expect(CELL).toBe(8);
    expect(battle.state.mapId).toBe(id);
    expect(battle.state.worldWidth).toBe(2688);
    expect(battle.state.worldHeight).toBe(1536);
    expect(rows).toHaveLength(WORLD_HEIGHT / CELL);
    expect(rows.every((row) => /^[01]{336}$/.test(row))).toBe(true);
    expect(solidCount(rows)).toBeGreaterThan(1500);
    expect(solidCount(rows)).toBeLessThan(31500);
    expect(rows).toEqual(makeWorld(id));
    expect(rows).toEqual([...fixture(id).battle.state.terrainRows]);
    for (const other of ["andes", "coast", ...NEW_MAP_IDS] as const)
      if (other !== id) expect(rows).not.toEqual(makeWorld(other));
    const fresh = makeWorld(id);
    fresh[0] = "1".repeat(WORLD_WIDTH / CELL);
    expect(makeWorld(id)).toEqual(rows);
    expect(makeTerrain(id)).toEqual(makeTerrain("flat"));
    expect(battle.destructible).toBe(true);
  },
);

test.each([...worlds.PLAYABLE_MAP_IDS])(
  "%s spawns both seats standing in clear space on broad stable floors",
  (id) => {
    const { battle, tick } = fixture(id);
    const s = battle.state;
    const starts = s.players.map((p) => [p.x, p.y]);
    expect(starts).toEqual(spawnsOf(id));
    for (const p of s.players) {
      expect(bodyBlocked(s, p.x, p.y)).toBe(false);
      expect(grounded(s, p.x, p.y)).toBe(true);
      for (const dx of [-48, -24, 0, 24, 48]) {
        expect(bodyBlocked(s, p.x + dx, p.y)).toBe(false);
        expect(grounded(s, p.x + dx, p.y)).toBe(true);
        expect(solidAt(s, p.x + dx, p.y + ARENA.playerRadius + 16)).toBe(true);
      }
    }
    for (let i = 0; i < 1200; i++) tick();
    expect(s.phase).toBe("aiming");
    expect(s.turnNumber).toBe(2);
    s.players.forEach((p, index) => {
      expect(p.x).toBe(starts[index][0]);
      expect(p.y).toBeCloseTo(starts[index][1], 2);
      expect(p.hp).toBe(100);
      expect(grounded(s, p.x, p.y)).toBe(true);
    });
  },
);

test("canopy has separated steps, enclosed island caves and an open central drop", () => {
  const s = fixture("canopy").battle.state;
  expect(components([...s.terrainRows])).toBeGreaterThanOrEqual(10);
  for (let y = 0; y < WORLD_HEIGHT; y += CELL)
    for (let x = 1224; x < 1464; x += CELL)
      expect(solidAt(s, x, y)).toBe(false);
  for (const [x, y] of [
    [840, 808],
    [1128, 696],
    [1800, 816],
    [1536, 688],
    [936, 1200],
    [1740, 1120],
    [560, 792],
    [2120, 792],
  ]) {
    expect(grounded(s, x, y - ARENA.playerRadius)).toBe(true);
    expect(bodyBlocked(s, x, y - ARENA.playerRadius)).toBe(false);
  }
  for (const [x, y] of [
    [372, 1044],
    [2304, 1056],
  ]) {
    expect(bodyBlocked(s, x, y)).toBe(false);
    for (const [dx, dy] of [
      [0, -96],
      [0, 96],
      [-96, 0],
      [96, 0],
    ])
      expect(solidAt(s, x + dx, y + dy)).toBe(true);
  }
  expect(s.terrainRows.at(-1)).toBe("0".repeat(WORLD_WIDTH / CELL));
});

test("caldera has a hollow horseshoe, an inner floor, cave pockets and destructible approaches", () => {
  const s = fixture("caldera").battle.state;
  for (let y = 0; y < 1312; y += CELL) expect(solidAt(s, 1344, y)).toBe(false);
  expect(grounded(s, 1344, 1320 - ARENA.playerRadius)).toBe(true);
  expect(bodyBlocked(s, 1344, 1320 - ARENA.playerRadius)).toBe(false);
  expect(solidAt(s, 672, 1020)).toBe(true);
  expect(solidAt(s, 2016, 1020)).toBe(true);
  expect(solidAt(s, 1344, 1380)).toBe(true);
  expect(solidAt(s, 1344, 1440)).toBe(false);
  for (const x of [720, 1968]) {
    expect(bodyBlocked(s, x, 1104)).toBe(false);
    expect(solidAt(s, x, 1020)).toBe(true);
    expect(solidAt(s, x, 1188)).toBe(true);
  }
  for (const x of [564, 2124]) {
    expect(grounded(s, x, 952 - ARENA.playerRadius)).toBe(true);
    expect(solidAt(s, x, 992)).toBe(true);
    expect(solidAt(s, x, 1020)).toBe(false);
    const rows = [...s.terrainRows];
    eraseCircle(rows, x, 976, 48);
    expect(gridHit({ ...s, terrainRows: rows }, x, 912, 0, 150)).toBe(Infinity);
  }
  expect(gridHit(s, 936, 1116, 816, 0)).toBe(Infinity);
  expect(s.terrainRows.at(-1)).toBe("0".repeat(WORLD_WIDTH / CELL));
});

test.each(["canopy", "caldera"] as const)(
  "%s gives both seats usable cross-arena rocket arcs through the actual Battle",
  (id) => {
    for (const seat of [0, 1]) {
      const { battle, tick, until } = fixture(id);
      const s = battle.state;
      if (seat) tick(ARENA.turnMs);
      const view = s.toJSON() as BattleView;
      const shooter = view.players[seat];
      const opponent = view.players[1 - seat];
      let aim: { angle: number; power: number } | undefined;
      for (let degrees = 30; degrees <= 65 && !aim; degrees += 5) {
        for (let charge = 45; charge <= 100; charge++) {
          const radians = (degrees * Math.PI) / 180;
          const angle = seat ? -Math.PI + radians : -radians;
          const power = charge / 100;
          const end = shotTrajectory(
            view,
            view.players,
            shooter,
            angle,
            power,
            "rocket",
          ).at(-1);
          if (end && Math.hypot(end.x - opponent.x, end.y - opponent.y) < 55) {
            aim = { angle, power };
            break;
          }
        }
      }
      expect(aim).toBeDefined();
      if (!aim)
        throw new Error(`${id} seat ${seat + 1} has no useful firing arc`);
      expect(
        battle.fire(shooter.sessionId, {
          ...aim,
          weapon: "rocket",
          turnNumber: s.turnNumber,
        }),
      ).toBeNull();
      until(() => s.phase === "exploding");
      expect(s.players[1 - seat].hp).toBeLessThan(100);
      expect(s.players[seat].hp).toBe(100);
    }
  },
);

test.each(NEW_MAP_IDS)(
  "%s uses authoritative craters and gravity, then restart restores the exact authored world",
  (id) => {
    const { battle, tick, until } = fixture(id);
    const s = battle.state;
    const before = [...s.terrainRows];
    const startY = s.players[0].y;
    expect(
      battle.fire("one", {
        angle: Math.PI / 2,
        power: 0,
        weapon: "rocket",
        turnNumber: 1,
      }),
    ).toBeNull();
    until(() => s.phase === "exploding");
    expect(s.terrainRevision).toBe(1);
    expect(solidCount(s.terrainRows)).toBeLessThan(solidCount(before));
    for (let row = 0; row < before.length; row++)
      for (let col = 0; col < before[row].length; col++)
        if (before[row][col] === "0") expect(s.terrainRows[row][col]).toBe("0");
    if (id === "canopy" || id === "caldera") {
      s.players[0].x = WORLD_MAPS[id].spawns[0][0];
      s.players[0].vx = 0;
      s.players[0].vy = 0;
      expect(grounded(s, s.players[0].x, s.players[0].y)).toBe(false);
      until(() => s.players[0].y > startY + 24);
    }
    s.players[0].x = 24;
    s.players[0].y = WORLD_HEIGHT + 40;
    s.players[0].vx = 0;
    s.players[0].vy = 0;
    until(() => s.phase === "finished");
    expect(s.winner).toBe("two");
    expect(s.players[0].hp).toBe(0);
    const oldTurn = s.turnNumber;
    expect(battle.restart("one", { turnNumber: oldTurn })).toBeNull();
    expect(s.mapId).toBe(id);
    expect([...s.terrainRows]).toEqual(before);
    expect(s.terrainRevision).toBe(2);
    expect(s.players.map((p) => [p.x, p.y])).toEqual(spawnsOf(id));
    expect(s.players.map((p) => p.hp)).toEqual([100, 100]);
    expect(s.projectile.active).toBe(false);
    expect(s.winner).toBe("");
    expect(s.phase).toBe("aiming");
    expect(s.turnNumber).toBeGreaterThan(oldTurn);
    expect(
      battle.fire("one", { angle: 0, power: 1, turnNumber: oldTurn }),
    ).toBeString();
    for (let i = 0; i < 120; i++) tick();
    for (const p of s.players) expect(grounded(s, p.x, p.y)).toBe(true);
  },
);

test.each(NEW_MAP_IDS)("%s respects the lab destruction toggle", (id) => {
  const { battle, until } = fixture(id);
  const before = [...battle.state.terrainRows];
  battle.destructible = false;
  expect(
    battle.fire("one", { angle: Math.PI / 2, power: 0, turnNumber: 1 }),
  ).toBeNull();
  until(() => battle.state.phase === "exploding");
  expect([...battle.state.terrainRows]).toEqual(before);
  expect(battle.state.terrainRevision).toBe(0);
});
