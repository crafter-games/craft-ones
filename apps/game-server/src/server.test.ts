import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { request } from "node:http";
import { fileURLToPath } from "node:url";
import {
  ARENA,
  type BattleView,
  CELL,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@craft-ones/shared";
import { Client, type Room } from "colyseus.js";
import { parseWebOrigins } from "./server";

async function waitFor(predicate: () => boolean, timeout = 4_000) {
  const until = performance.now() + timeout;
  while (!predicate()) {
    if (performance.now() >= until)
      throw new Error("Timed out waiting for server state");
    await Bun.sleep(10);
  }
}

const clients = new Set<Room<BattleView>>();
let runtime: ReturnType<typeof Bun.spawn>;
let endpoint = "";

beforeAll(async () => {
  const child = Bun.spawn(["node", "--import", "tsx", "src/index.ts"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: {
      ...process.env,
      PORT: "0",
      WEB_ORIGIN: "http://192.168.1.5:3000, http://craft.local:3000",
    },
    stdout: "pipe",
    stderr: "inherit",
  });
  runtime = child;
  void (async () => {
    let output = "";
    for await (const chunk of child.stdout) {
      output += new TextDecoder().decode(chunk);
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) endpoint = match[0];
    }
  })();
  await waitFor(() => endpoint !== "", 10_000);
}, 15_000);

afterAll(async () => {
  try {
    await Promise.all(
      [...clients].map((room) => room.leave().catch(() => undefined)),
    );
  } finally {
    runtime.kill();
    await runtime.exited;
  }
});

async function join() {
  const room = await new Client(endpoint).joinOrCreate<BattleView>("battle");
  clients.add(room);
  room.onLeave(() => clients.delete(room));
  room.onMessage("actionError", () => undefined);
  await waitFor(() => !!room.state?.players?.length);
  return room;
}

describe("HTTP readiness and explicit CORS", () => {
  test("health is available on IPv4", async () => {
    const response = await fetch(`${endpoint}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  test.each([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.1.5:3000",
    "http://craft.local:3000",
  ])(
    "native matchmaking preflight and POST allow exact configured origin %s",
    async (origin) => {
      const response = await fetch(
        `${endpoint}/matchmake/joinOrCreate/battle`,
        {
          method: "OPTIONS",
          headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
        },
      );
      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe(origin);
      expect(response.headers.get("access-control-allow-methods")).toContain(
        "POST",
      );
      expect(response.headers.get("access-control-allow-headers")).toContain(
        "Content-Type",
      );
      expect(response.headers.get("vary")).toContain("Origin");
      const post = await fetch(`${endpoint}/matchmake/invalid/battle`, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: "{}",
      });
      expect(post.headers.get("access-control-allow-origin")).toBe(origin);
      expect(await post.json()).toHaveProperty("error");
    },
  );

  test.each([
    "http://evil.local:3000",
    "http://localhost:3000.evil.test",
    "null",
  ])(
    "denies disallowed origin %s before native matchmaker can reflect it",
    async (origin) => {
      for (const method of ["OPTIONS", "POST"]) {
        const response = await fetch(
          `${endpoint}/matchmake/joinOrCreate/battle`,
          {
            method,
            headers: { Origin: origin },
            ...(method === "POST" ? { body: "{}" } : {}),
          },
        );
        expect(response.status).toBe(403);
        expect(response.headers.get("access-control-allow-origin")).toBeNull();
      }
    },
  );

  test("health also uses the allowlist and unknown routes return 404", async () => {
    const health = await fetch(`${endpoint}/health`, {
      headers: { Origin: "http://localhost:3000" },
    });
    expect(health.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
    expect((await fetch(`${endpoint}/missing`)).status).toBe(404);
    expect(
      (await fetch(`${endpoint}/matchmake/join/battle`, { method: "PUT" }))
        .status,
    ).toBe(405);
  });

  test("bounds HTTP matchmaking payloads as well as WebSocket payloads", async () => {
    const response = await fetch(`${endpoint}/matchmake/joinOrCreate/battle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ padding: "x".repeat(5_000) }),
    });
    expect(response.status).toBe(413);
  });

  test("bounds streamed matchmaking bodies that declare no Content-Length", async () => {
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (let chunk = 0; chunk < 8; chunk++) {
          controller.enqueue(new TextEncoder().encode("x".repeat(1_024)));
          await Bun.sleep(5);
        }
        controller.close();
      },
    });
    const response = await fetch(`${endpoint}/matchmake/joinOrCreate/battle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    expect(response.status).toBe(413);
    expect(await response.json()).toHaveProperty("error");
    expect((await fetch(`${endpoint}/health`)).status).toBe(200);
  });

  test.each(["http://evil.local:3000", "null"])(
    "refuses the WebSocket upgrade itself for disallowed origin %s",
    async (origin) => {
      const status = await new Promise<number | undefined>((resolve) => {
        const upgrade = request(`${endpoint}/upgrade-probe`, {
          headers: {
            Connection: "Upgrade",
            Upgrade: "websocket",
            "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
            "Sec-WebSocket-Version": "13",
            Origin: origin,
          },
        });
        upgrade.on("upgrade", (_response, socket) => {
          socket.destroy();
          resolve(101);
        });
        upgrade.on("response", (response) => {
          response.resume();
          resolve(response.statusCode);
        });
        upgrade.on("error", () => resolve(undefined));
        upgrade.end();
      });
      expect(status).toBe(403);
    },
  );

  test("validates configured origins instead of silently producing wrong CORS", () => {
    expect(parseWebOrigins(undefined).has("http://localhost:3000")).toBe(true);
    expect(
      parseWebOrigins(" http://192.168.0.10:3000/ ").has(
        "http://192.168.0.10:3000",
      ),
    ).toBe(true);
    for (const invalid of [
      "*",
      "not a url",
      "ftp://host",
      "http://host/path",
      "http://user:pass@host",
    ]) {
      expect(() => parseWebOrigins(invalid)).toThrow();
    }
  });
});

describe("real Colyseus SDK clients", () => {
  test("two clients share a schema match, rejected actions report errors, shots sync, disconnect forfeits", async () => {
    const one = await join();
    expect(one.state.phase).toBe("waiting");
    const two = await join();
    expect(two.roomId).toBe(one.roomId);
    await waitFor(
      () => one.state.phase === "aiming" && two.state.phase === "aiming",
    );
    expect(one.state.players.map((player) => player.sessionId)).toEqual([
      one.sessionId,
      two.sessionId,
    ]);
    expect(one.state.currentPlayer).toBe(one.sessionId);
    await expect(new Client(endpoint).joinById(one.roomId)).rejects.toThrow();

    let error: unknown;
    two.onMessage("actionError", (message: unknown) => {
      error = message;
    });
    two.send("fire", {
      angle: -1,
      power: 0.5,
      turnNumber: one.state.turnNumber,
    });
    await waitFor(() => typeof error === "string");
    expect(one.state.projectile.active).toBe(false);
    const samples: number[][][] = [[], []];
    [one, two].forEach((room, index) => {
      room.onStateChange((state) => {
        if (state.projectile.active) {
          const { x, y, vx, vy } = state.projectile;
          samples[index].push([x, y, vx, vy]);
        }
      });
    });

    one.send("fire", {
      angle: -Math.PI / 4,
      power: 0.5,
      turnNumber: one.state.turnNumber,
    });
    await waitFor(
      () => one.state.phase === "flying" && two.state.projectile.active,
    );
    expect(two.state.projectile.vx).toBeGreaterThan(0);
    expect(two.state.projectile.vy).toBeLessThan(0);
    await waitFor(
      () => one.state.phase === "exploding" && two.state.explosion.id === 1,
    );
    expect(samples[0].length).toBeGreaterThan(10);
    expect(samples[1]).toEqual(samples[0]);
    expect(two.state.players.map((p) => [p.x, p.y, p.hp])).toEqual(
      one.state.players.map((p) => [p.x, p.y, p.hp]),
    );
    await waitFor(
      () => one.state.phase === "aiming" && one.state.turnNumber === 2,
    );
    expect(one.state.currentPlayer).toBe(two.sessionId);
    expect(one.state.remainingMs).toBeLessThanOrEqual(ARENA.turnMs);

    const roomId = one.roomId;
    const reconnectToken = one.reconnectionToken;
    await one.leave(false);
    await waitFor(() => two.state.phase === "finished");
    expect(two.state.winner).toBe(two.sessionId);
    expect(two.state.finishReason).toBe("forfeit");
    expect(two.state.players[0].connected).toBe(false);
    await expect(new Client(endpoint).joinById(roomId)).rejects.toThrow();
    await expect(
      new Client(endpoint).reconnect(reconnectToken),
    ).rejects.toThrow();
    const third = await join();
    expect(third.roomId).not.toBe(roomId);
    await third.leave();
    await two.leave();
    await expect(new Client(endpoint).joinById(roomId)).rejects.toThrow();
  }, 10_000);

  test("movement synchronizes; remote debug options and stale movement cannot change state", async () => {
    const one = await join(),
      two = await join();
    await waitFor(
      () => one.state.phase === "aiming" && two.state.phase === "aiming",
    );
    const terrain = [...one.state.terrain];
    const x = one.state.players[0].x;
    one.send("move", {
      direction: 1,
      sequence: 1,
      turnNumber: one.state.turnNumber,
    });
    await waitFor(
      () => two.state.players[0].x > x && one.state.players[0].x > x,
    );
    expect(two.state.players[0].x).toBe(one.state.players[0].x);
    expect(two.state.currentPlayer).toBe(one.sessionId);
    expect(two.state.turnNumber).toBe(1);
    const moved = two.state.players[0].x;
    const errors: string[] = [];
    one.onMessage("actionError", (error: string) => errors.push(error));
    one.send("move", {
      direction: 1,
      sequence: 1,
      turnNumber: one.state.turnNumber,
    });
    one.send("setPosition", { x: 900, y: 0 });
    one.send("infiniteHp", true);
    one.send("destructible", true);
    await waitFor(() => errors.length === 4);
    expect(one.state.players[0].x).toBe(moved);
    expect([...two.state.terrain]).toEqual(terrain);
    await one.leave();
    await two.leave();
  });

  test("a lone waiting disconnect disposes the room and new players get a fresh room", async () => {
    const old = await join();
    const oldId = old.roomId;
    expect(old.state.phase).toBe("waiting");
    await old.leave();
    await expect(new Client(endpoint).joinById(oldId)).rejects.toThrow();
    const replacement = await join();
    expect(replacement.roomId).not.toBe(oldId);
    expect(replacement.state.players.length).toBe(1);
    expect(replacement.state.phase).toBe("waiting");
    await replacement.leave();
    await expect(
      new Client(endpoint).joinById(replacement.roomId),
    ).rejects.toThrow();
  });

  test("map, appearance, grenade destruction and abilities replicate to both clients", async () => {
    const one = await new Client(endpoint).create<BattleView>("battle", {
      mapId: "coast",
      player: { species: "llama", coat: "rose", hp: 999 },
    });
    const two = await new Client(endpoint).joinById<BattleView>(one.roomId, {
      player: { species: "cuy", coat: "sage" },
    });
    for (const room of [one, two]) {
      clients.add(room);
      room.onMessage("actionError", () => undefined);
    }
    try {
      await waitFor(
        () => two.state.phase === "aiming" && one.state.players.length === 2,
      );
      expect(two.state.mapId).toBe("coast");
      expect(two.state.worldWidth).toBe(WORLD_WIDTH);
      expect(one.state.players.map((p) => [p.species, p.coat, p.hp])).toEqual([
        ["llama", "rose", 100],
        ["cuy", "sage", 100],
      ]);
      const pristine = [...two.state.terrainRows];
      one.send("fire", {
        weapon: "grenade",
        angle: Math.PI / 2,
        power: 0,
        turnNumber: 1,
      });
      await waitFor(() => two.state.projectile.active);
      expect(two.state.projectile.kind).toBe("grenade");
      await waitFor(
        () =>
          one.state.terrainRevision === 1 && two.state.terrainRevision === 1,
        4500,
      );
      expect([...two.state.terrainRows]).toEqual([...one.state.terrainRows]);
      expect(two.state.terrainRows.some((row, i) => row !== pristine[i])).toBe(
        true,
      );
      await waitFor(() => two.state.phase === "aiming");
      two.send("fire", {
        weapon: "dynamite",
        angle: Math.PI / 2,
        power: 0,
        turnNumber: 2,
      });
      await waitFor(() => one.state.terrainRevision === 2, 3500);
      await waitFor(() => one.state.phase === "aiming");
      one.send("ability", { direction: 1, turnNumber: 3 });
      await waitFor(() => two.state.phase === "resolving");
      expect(two.state.lastAction).toBe("leap");
      expect(two.state.players[0].abilityReadyTurn).toBe(7);
      const left = two.state.players[0].x;
      await waitFor(() => two.state.players[0].x > left);
      expect(one.state.players[0].hp).toBeLessThan(100);
    } finally {
      await one.leave();
      await two.leave();
      clients.delete(one);
      clients.delete(two);
    }
  }, 15000);

  test("Zorro dash and Ronsoco shield replicate through authoritative ability intents", async () => {
    const one = await new Client(endpoint).create<BattleView>("battle", {
      mapId: "andes",
      player: { species: "zorro", coat: "caramel" },
    });
    const two = await new Client(endpoint).joinById<BattleView>(one.roomId, {
      player: { species: "ronsoco", coat: "slate" },
    });
    for (const room of [one, two]) {
      clients.add(room);
      room.onMessage("actionError", () => undefined);
    }
    try {
      await waitFor(
        () => one.state.players.length === 2 && two.state.phase === "aiming",
      );
      expect(two.state.players[0].species).toBe("zorro");
      expect(one.state.players[1].species).toBe("ronsoco");
      const start = two.state.players[0].x;
      one.send("ability", { direction: 1, turnNumber: 1 });
      await waitFor(
        () => two.state.turnNumber === 2 && one.state.turnNumber === 2,
      );
      expect(two.state.players[0].x).toBeGreaterThan(start);
      expect(two.state.players[0].x).toBe(one.state.players[0].x);
      two.send("ability", { turnNumber: 2 });
      await waitFor(
        () =>
          one.state.players[1].shield === 30 &&
          two.state.players[1].shield === 30,
      );
      expect(one.state.lastAction).toBe("shield");
      expect(one.state.players[1].abilityReadyTurn).toBe(6);
      await waitFor(
        () => one.state.turnNumber === 3 && two.state.turnNumber === 3,
      );
      expect(one.state.currentPlayer).toBe(one.sessionId);
      expect(two.state.players[1].shield).toBe(30);
    } finally {
      await one.leave();
      await two.leave();
      clients.delete(one);
      clients.delete(two);
    }
  });

  test.each(["canopy", "caldera"])(
    "%s synchronizes its own terrain and rejects forged Cuy abilities",
    async (mapId) => {
      const one = await new Client(endpoint).create<BattleView>("battle", {
        mapId,
      });
      clients.add(one);
      let two: Room<BattleView> | undefined;
      try {
        two = await new Client(endpoint).joinById<BattleView>(one.roomId);
        clients.add(two);
        const opponent = two;
        await waitFor(
          () =>
            one.state.phase === "aiming" && opponent.state.phase === "aiming",
        );
        expect(one.state.mapId).toBe(mapId);
        expect(two.state.mapId).toBe(mapId);
        expect([...two.state.terrainRows]).toEqual([...one.state.terrainRows]);
        expect(one.state.players[0].species).toBe("cuy");
        let error = "";
        one.onMessage("actionError", (message: string) => {
          error = message;
        });
        one.send("ability", {
          turnNumber: 1,
          direction: 1,
          species: "llama",
          hp: 999,
        });
        await waitFor(() => error !== "");
        expect(error).toBe("This character has no special ability");
        expect(one.state.turnNumber).toBe(1);
        expect(two.state.players[0].hp).toBe(100);
        expect(one.state.players[0].abilityReadyTurn).toBe(0);
      } finally {
        await one.leave();
        clients.delete(one);
        if (two) {
          await two.leave();
          clients.delete(two);
        }
      }
    },
  );

  test.each(["__proto__", "flat", "unknown"])(
    "untrusted map %s cannot select an internal or invalid world",
    async (mapId) => {
      const room = await new Client(endpoint).create<BattleView>("battle", {
        mapId,
      });
      clients.add(room);
      try {
        await waitFor(() => !!room.state.players?.length);
        expect(room.state.mapId).toBe("andes");
        expect(room.state.terrainRows.length).toBe(WORLD_HEIGHT / CELL);
      } finally {
        await room.leave();
        clients.delete(room);
      }
    },
  );

  test("oversized WebSocket messages disconnect instead of accepting unbounded intents", async () => {
    const room = await join();
    let closeCode = 0;
    room.onLeave((code) => {
      closeCode = code;
    });
    room.send("fire", { padding: "x".repeat(5_000) });
    await waitFor(() => closeCode !== 0);
    expect(closeCode).toBe(1009);
    await expect(new Client(endpoint).joinById(room.roomId)).rejects.toThrow();
  });
});

test("movement budget and sticky fuse replicate to both seats through normal intentions", async () => {
  const one = await new Client(endpoint).create<BattleView>("battle", {
    mapId: "andes",
  });
  const two = await new Client(endpoint).joinById<BattleView>(one.roomId);
  for (const room of [one, two]) {
    clients.add(room);
    room.onMessage("actionError", () => undefined);
  }
  try {
    await waitFor(
      () => one.state.players.length === 2 && two.state.phase === "aiming",
    );
    const start = one.state.players[0].x;
    const steps = ARENA.moveBudget / ARENA.moveStep;
    // Walking away drains the range, and the other seat sees the same number.
    for (let sequence = 1; sequence <= steps; sequence++) {
      one.send("move", { direction: 1, sequence, turnNumber: 1 });
      await waitFor(
        () =>
          two.state.players[0].movementLeft ===
          ARENA.moveBudget - sequence * ARENA.moveStep,
      );
      await Bun.sleep(90);
    }
    expect(two.state.players[0].movementLeft).toBe(0);
    expect(one.state.players[0].x).toBe(start + ARENA.moveBudget);
    one.send("move", {
      direction: 1,
      sequence: 99,
      turnNumber: 1,
      movementLeft: 999,
    });
    one.send("jump", { direction: 1, turnNumber: 1 });
    await Bun.sleep(150);
    expect(one.state.players[0].x).toBe(start + ARENA.moveBudget);
    expect(two.state.players[0].movementLeft).toBe(0);
    // Walking home hands the range back on both seats.
    for (let sequence = 100; sequence < 100 + steps; sequence++) {
      one.send("move", { direction: -1, sequence, turnNumber: 1 });
      await waitFor(
        () =>
          two.state.players[0].movementLeft ===
          (sequence - 99) * ARENA.moveStep,
      );
      await Bun.sleep(90);
    }
    expect(one.state.players[0].x).toBe(start);
    expect(two.state.players[0].movementLeft).toBe(ARENA.moveBudget);
    for (const [seat, room] of [one, two].entries()) {
      const turnNumber = seat + 1;
      const intent = {
        weapon: "sticky",
        angle: Math.PI / 2,
        power: 0,
        turnNumber,
      };
      room.send("fire", intent);
      room.send("fire", intent);
      await waitFor(
        () =>
          one.state.projectile.stuck &&
          two.state.projectile.stuck &&
          two.state.turnNumber === turnNumber,
      );
      expect(two.state.projectile.kind).toBe("sticky");
      expect(two.state.projectile.x).toBe(one.state.projectile.x);
      expect(two.state.projectile.y).toBe(one.state.projectile.y);
      await waitFor(
        () =>
          one.state.explosion.id === turnNumber &&
          two.state.explosion.id === turnNumber,
        4500,
      );
      expect([...two.state.terrainRows]).toEqual([...one.state.terrainRows]);
      expect(two.state.players.map((p) => p.hp)).toEqual(
        one.state.players.map((p) => p.hp),
      );
      await waitFor(
        () =>
          one.state.turnNumber === turnNumber + 1 &&
          two.state.turnNumber === turnNumber + 1,
      );
    }
    expect(one.state.players[0].movementLeft).toBe(ARENA.moveBudget);
  } finally {
    await one.leave();
    await two.leave();
    clients.delete(one);
    clients.delete(two);
  }
}, 20000);

test.each(["freddy", "michi", "railly"])(
  "%s ability and exclusive appearance replicate through real room intentions",
  async (species) => {
    const one = await new Client(endpoint).create<BattleView>("battle", {
      mapId: "andes",
      player: { species, coat: "cream" },
    });
    const two = await new Client(endpoint).joinById<BattleView>(one.roomId, {
      player: { species, coat: "cream" },
    });
    const errors: string[] = [];
    for (const room of [one, two]) {
      clients.add(room);
      room.onMessage("actionError", (error: string) => errors.push(error));
    }
    try {
      await waitFor(
        () => one.state.players.length === 2 && two.state.phase === "aiming",
      );
      expect(two.state.players.every((p) => p.species === species)).toBe(true);
      one.send("ability", { angle: Math.PI / 2, power: 0, turnNumber: 1 });
      await waitFor(
        () =>
          one.state.players[0].abilityReadyTurn === 5 &&
          two.state.players[0].abilityReadyTurn === 5,
      );
      const kind =
        species === "freddy"
          ? "rift"
          : species === "michi"
            ? "meow"
            : "shuriken";
      expect(one.state.projectile.kind).toBe(kind);
      expect(two.state.projectile.kind).toBe(kind);
      await waitFor(
        () => one.state.turnNumber === 2 && two.state.turnNumber === 2,
        12000,
      );
      expect(two.state.explosion.id).toBe(species === "railly" ? 3 : 1);
      expect(two.state.explosion.id).toBe(one.state.explosion.id);
      expect([...two.state.terrainRows]).toEqual([...one.state.terrainRows]);
      expect(two.state.players.map((p) => p.hp)).toEqual(
        one.state.players.map((p) => p.hp),
      );
      expect(two.state.players[0].hp).toBeLessThan(100);
      expect(errors).toEqual([]);
    } finally {
      await one.leave();
      await two.leave();
      clients.delete(one);
      clients.delete(two);
    }
  },
  15000,
);
