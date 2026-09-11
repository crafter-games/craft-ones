import { afterAll, beforeAll, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { Client, type Room } from "colyseus.js";
import { DiscordIdentity, discordApps } from "./discord";

const clientId = "111111111111111111";
const app = { clientId, clientSecret: "secret", botToken: "bot" };
const users = [
  "222222222222222222",
  "333333333333333333",
  "444444444444444444",
];
let endpoint = "";
let child: ReturnType<typeof Bun.spawn>;
const rooms: Room[] = [];
async function waitFor(predicate: () => boolean) {
  const until = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() > until) throw Error("Server did not become ready");
    await Bun.sleep(10);
  }
}
beforeAll(async () => {
  child = Bun.spawn(
    ["node", "--import", "tsx", "src/fixtures/discord-server.ts"],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      stdout: "pipe",
      stderr: "inherit",
      env: {
        ...process.env,
        CREATE_PER_MINUTE: "200",
        MATCHMAKE_PER_MINUTE: "300",
        WEB_ORIGIN: "http://localhost:3000",
      },
    },
  );
  void (async () => {
    let output = "";
    for await (const chunk of child.stdout as ReadableStream<Uint8Array>) {
      output += new TextDecoder().decode(chunk);
      endpoint = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0] ?? "";
    }
  })();
  await waitFor(() => !!endpoint);
});
afterAll(async () => {
  await Promise.all(
    rooms
      .filter((room) => room.connection.isOpen)
      .map((room) => room.leave().catch(() => {})),
  );
  child?.kill();
  await child?.exited;
});
function post(
  path: string,
  body: unknown,
  origin = `https://${clientId}.discordsays.com`,
) {
  return fetch(`${endpoint}/discord/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}
function seat(instanceId: string, accessToken = users[0], extra = {}) {
  return post("session", {
    clientId,
    instanceId,
    accessToken,
    mapId: "frost",
    player: { species: "llama", coat: "cream" },
    ...extra,
  });
}

test("Discord config is explicit, unique and validates IDs", () => {
  expect(discordApps("")).toEqual([]);
  expect(discordApps(JSON.stringify([app]))).toEqual([app]);
  expect(() => discordApps(JSON.stringify([app, app]))).toThrow();
  expect(() =>
    discordApps(JSON.stringify([{ ...app, clientId: "evil.example" }])),
  ).toThrow();
});

test("OAuth forwards a code server-side without exposing the refresh token", async () => {
  const response = await post("token", { clientId, code: "fixture-code" });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ access_token: users[0] });
  expect(
    (await post("token", { clientId: "other", code: "code" })).status,
  ).toBe(400);
  expect((await post("token", { clientId, code: "" })).status).toBe(400);
});

test("untrusted origins, wrong audience and nonparticipants cannot reserve seats", async () => {
  expect((await post("session", {}, "https://evil.example")).status).toBe(403);
  expect((await seat("denied", "wrong-app")).status).toBe(403);
  expect((await seat("denied", "555555555555555555")).status).toBe(403);
  expect((await seat("../../anything")).status).toBe(400);
  expect(
    (await seat("invalid-map", users[0], { mapId: "invalid" })).status,
  ).toBe(400);
});

test("concurrent participants share one authoritative room and a third seat is rejected", async () => {
  const pair = await Promise.all([
    seat("shared", users[0]),
    seat("shared", users[1]),
  ]);
  expect(pair.map((response) => response.status)).toEqual([200, 200]);
  const reservations = await Promise.all(
    pair.map((response) => response.json()),
  );
  expect(reservations[0].room.roomId).toBe(reservations[1].room.roomId);
  expect(JSON.stringify(reservations)).not.toContain("discordUserId");
  expect((await seat("shared", users[0])).status).toBe(409);
  expect((await seat("shared", users[2])).status).toBe(409);
  const connected = await Promise.all(
    reservations.map((reservation) =>
      new Client(endpoint).consumeSeatReservation(reservation),
    ),
  );
  rooms.push(...connected);
  await waitFor(() =>
    connected.every((room) => room.state?.players?.length === 2),
  );
  expect(connected.map((room) => room.state.mapId)).toEqual(["frost", "frost"]);
  expect((await seat("shared", users[0])).status).toBe(409);
  await expect(
    new Client(endpoint).create("discord_battle", { instanceKey: "shared" }),
  ).rejects.toThrow();
  const other = await seat("separate", users[2]);
  const reservation = await other.json();
  expect(reservation.room.roomId).not.toBe(reservations[0].room.roomId);
  await expect(
    new Client(endpoint).joinById(reservation.room.roomId),
  ).rejects.toThrow();
  const third = await new Client(endpoint).consumeSeatReservation(reservation);
  rooms.push(third);
  await connected[1].leave();
  await waitFor(() => connected[0].state.phase === "finished");
  expect((await seat("shared", users[2])).status).toBe(409);
});

test("Discord API throttling fails closed", async () => {
  const identity = new DiscordIdentity(
    [app],
    async () => new Response("", { status: 429 }),
  );
  await expect(
    identity.verify(clientId, users[0], "instance"),
  ).rejects.toMatchObject({ status: 429 });
});

test("malformed and oversized Discord bodies are rejected before provider requests", async () => {
  expect((await post("token", null)).status).toBe(400);
  expect(
    (await post("token", { clientId, code: "x".repeat(5000) })).status,
  ).toBe(413);
});
