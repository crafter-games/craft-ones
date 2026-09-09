import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import type { BattleView } from "@craft-ones/shared";
import { Client, type Room } from "colyseus.js";

async function until(check: () => boolean, ms = 5000) {
  const deadline = performance.now() + ms;
  while (!check()) {
    if (performance.now() > deadline)
      throw new Error("Server condition timed out");
    await Bun.sleep(15);
  }
}

async function server(env: Record<string, string> = {}) {
  const runtime = Bun.spawn(
    process.env.TEST_SERVER_BUNDLE === "1"
      ? ["node", "../../dist/game-server.mjs"]
      : ["node", "--import", "tsx", "src/index.ts"],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: {
        ...process.env,
        PORT: "0",
        NODE_ENV: "production",
        WEB_ORIGIN: "https://game.example.test",
        METRICS_TOKEN: "local-test-token",
        ...env,
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  let endpoint = "";
  void (async () => {
    for await (const chunk of runtime.stdout) {
      const match = new TextDecoder()
        .decode(chunk)
        .match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) endpoint = match[0];
    }
  })();
  try {
    await until(() => !!endpoint);
  } catch (error) {
    runtime.kill();
    throw error;
  }
  const rooms: Room<BattleView>[] = [];
  return {
    endpoint,
    async create() {
      const room = await new Client(endpoint).create<BattleView>("battle");
      rooms.push(room);
      room.onMessage("actionError", () => {});
      await until(() => !!room.state?.players?.length);
      return room;
    },
    async metrics() {
      const response = await fetch(`${endpoint}/metrics`, {
        headers: { Authorization: "Bearer local-test-token" },
      });
      return (await response.json()) as {
        rooms: number;
        connections: number;
        rejectedRequests: number;
        rejectedConnections: number;
        rejectedMessages: number;
      };
    },
    async stop() {
      await Promise.all(
        rooms
          .filter((room) => room.connection.isOpen)
          .map((room) => room.leave().catch(() => {})),
      );
      runtime.kill();
      await runtime.exited;
    },
  };
}

test("production origins are explicit and metrics require the exact token", async () => {
  const host = await server();
  try {
    expect(
      (
        await fetch(`${host.endpoint}/health`, {
          headers: { Origin: "http://localhost:3000" },
        })
      ).status,
    ).toBe(403);
    expect((await fetch(`${host.endpoint}/health`)).status).toBe(200);
    for (const token of ["", "Bearer wrong", "local-test-token"])
      expect(
        (
          await fetch(`${host.endpoint}/metrics`, {
            headers: { Authorization: token },
          })
        ).status,
      ).toBe(404);
    expect(await host.metrics()).toMatchObject({ rooms: 0, connections: 0 });
  } finally {
    await host.stop();
  }
});

test("matchmaking throttles a client even with spoofed proxy headers and returns readable CORS errors", async () => {
  const host = await server({ MATCHMAKE_PER_MINUTE: "3" });
  try {
    for (let i = 0; i < 4; i++) {
      const response = await fetch(
        `${host.endpoint}/matchmake/invalid/battle`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://game.example.test",
            "X-Forwarded-For": `192.0.2.${i + 1}`,
          },
          body: "{}",
        },
      );
      if (i < 3) expect(response.status).not.toBe(429);
      else {
        expect(response.status).toBe(429);
        expect(response.headers.get("retry-after")).toBe("60");
        expect(response.headers.get("access-control-allow-origin")).toBe(
          "https://game.example.test",
        );
      }
    }
    expect((await host.metrics()).rejectedRequests).toBe(1);
  } finally {
    await host.stop();
  }
});

test("room creation has a separate budget", async () => {
  const host = await server({ CREATE_PER_MINUTE: "2" });
  try {
    await host.create();
    await host.create();
    await expect(host.create()).rejects.toThrow();
    expect((await host.metrics()).rooms).toBe(2);
    expect((await host.metrics()).rejectedRequests).toBe(1);
  } finally {
    await host.stop();
  }
});

test("room cap rejects allocation and releases capacity after the owner leaves", async () => {
  const host = await server({ MAX_ROOMS: "2" });
  try {
    const one = await host.create();
    await host.create();
    await expect(host.create()).rejects.toThrow("All arenas are busy");
    expect((await host.metrics()).rooms).toBe(2);
    await one.leave();
    await Bun.sleep(150);
    await host.create();
    expect((await host.metrics()).rooms).toBe(2);
  } finally {
    await host.stop();
  }
});

for (const setting of ["MAX_CONNECTIONS", "MAX_CONNECTIONS_PER_IP"]) {
  test(`${setting} rejects excess sockets and releases disconnected capacity`, async () => {
    const host = await server({ [setting]: "2" });
    try {
      const one = await host.create();
      await host.create();
      await expect(host.create()).rejects.toThrow();
      expect((await host.metrics()).connections).toBe(2);
      expect((await host.metrics()).rejectedConnections).toBeGreaterThan(0);
      await one.leave();
      await Bun.sleep(150);
      await host.create();
      expect((await host.metrics()).connections).toBe(2);
    } finally {
      await host.stop();
    }
  });
}

test("message floods disconnect the sender and preserve the opponent's forfeit result", async () => {
  const host = await server();
  let rival: Room<BattleView> | undefined;
  try {
    const one = await host.create();
    rival = await new Client(host.endpoint).joinById<BattleView>(one.roomId);
    await until(() => rival?.state?.phase === "aiming");
    let code = 0;
    one.onLeave((value) => {
      code = value;
    });
    for (let i = 0; i < 100; i++) one.send("invalid", {});
    await until(() => code !== 0);
    expect(code).toBe(4008);
    await until(() => rival?.state?.phase === "finished");
    expect(rival.state.winner).toBe(rival.sessionId);
    expect((await host.metrics()).rejectedMessages).toBeGreaterThan(0);
  } finally {
    await rival?.leave();
    await host.stop();
  }
});

for (const setting of ["WAITING_ROOM_MS", "ROOM_LIFETIME_MS"]) {
  test(`${setting} expires connected abandoned rooms`, async () => {
    const host = await server({ [setting]: "600" });
    try {
      const room = await host.create();
      let code = 0;
      room.onLeave((value) => {
        code = value;
      });
      await until(() => !!code);
      expect(code).toBe(4000);
      await Bun.sleep(100);
      expect((await host.metrics()).rooms).toBe(0);
    } finally {
      await host.stop();
    }
  });
}

test("finished rooms expire while the remaining player stays connected", async () => {
  const host = await server({ FINISHED_ROOM_MS: "500" });
  try {
    const one = await host.create();
    const two = await new Client(host.endpoint).joinById<BattleView>(
      one.roomId,
    );
    await until(() => one.state.phase === "aiming");
    let code = 0;
    one.onLeave((value) => {
      code = value;
    });
    await two.leave();
    await until(() => code !== 0);
    expect(code).toBe(4000);
    expect((await host.metrics()).rooms).toBe(0);
  } finally {
    await host.stop();
  }
});

test("unsafe production configuration fails before binding", async () => {
  for (const env of [
    { WEB_ORIGIN: "" },
    { MAX_ROOMS: "NaN" },
    { TRUST_PROXY_HOPS: "99" },
  ]) {
    const runtime = Bun.spawn(
      process.env.TEST_SERVER_BUNDLE === "1"
        ? ["node", "../../dist/game-server.mjs"]
        : ["node", "--import", "tsx", "src/index.ts"],
      {
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        env: {
          ...process.env,
          NODE_ENV: "production",
          WEB_ORIGIN: "https://game.example.test",
          PORT: "0",
          ...env,
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(await runtime.exited).not.toBe(0);
    expect(await new Response(runtime.stdout).text()).not.toContain(
      "battle server ready",
    );
  }
});
