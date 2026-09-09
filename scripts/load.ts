import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { Client, type Room } from "colyseus.js";
import type { BattleView } from "../packages/shared/src";

const count = Number(process.env.LOAD_ROOMS ?? 10);
const seconds = Number(process.env.LOAD_SECONDS ?? 30);
if (
  !Number.isInteger(count) ||
  count < 1 ||
  count > 100 ||
  !Number.isInteger(seconds) ||
  seconds < 5 ||
  seconds > 300
)
  throw new Error("LOAD_ROOMS must be 1..100; LOAD_SECONDS must be 5..300");
let endpoint = process.env.LOAD_URL ?? "";
const token = process.env.METRICS_TOKEN ?? crypto.randomUUID();
const child = endpoint
  ? null
  : spawn("node", ["dist/game-server.mjs"], {
      env: {
        ...process.env,
        PORT: "0",
        NODE_ENV: "production",
        WEB_ORIGIN: "http://localhost:3000",
        METRICS_TOKEN: token,
        CREATE_PER_MINUTE: "120",
        MATCHMAKE_PER_MINUTE: "1000",
        MAX_CONNECTIONS_PER_IP: "200",
        MAX_CONNECTIONS: String(count * 2),
        MAX_ROOMS: String(count),
      },
      stdio: ["ignore", "pipe", "inherit"],
    });
child?.stdout.on("data", (data) => {
  const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/);
  if (match) endpoint = match[0];
});
const rooms: Room<BattleView>[] = [];
let patches = 0;
const movedRooms = new Set<string>();
const explodedRooms = new Set<string>();
const actionErrors: Record<string, number> = {};
let actions = 0;
let peakRssBytes = 0;
let peakSampledCumulativeP99Ms = 0;
let active = true;
let failure = "";
async function metrics() {
  const response = await fetch(`${endpoint}/metrics`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error(`Metrics unavailable: ${response.status}`);
  return (await response.json()) as {
    uptimeSeconds: number;
    rssBytes: number;
    eventLoopP99Ms: number;
    rooms: number;
    connections: number;
    rejectedRequests: number;
    rejectedMessages: number;
  };
}
try {
  const deadline = performance.now() + 10_000;
  while (!endpoint) {
    if (performance.now() > deadline) throw new Error("Server did not start");
    await delay(20);
  }
  const baseline = await metrics();
  if (
    baseline.rooms !== 0 ||
    baseline.connections !== 0 ||
    baseline.uptimeSeconds > 5
  )
    throw new Error(
      "Load checks require an empty server started within the last five seconds",
    );
  const client = new Client(endpoint);
  for (let i = 0; i < count; i++) {
    const one = await client.create<BattleView>("battle");
    rooms.push(one);
    const two = await client.joinById<BattleView>(one.roomId);
    rooms.push(two);
    for (const room of [one, two]) {
      room.onStateChange((state) => {
        patches++;
        if (state.explosion.id > 0) explodedRooms.add(room.roomId);
        if (
          state.explosion.id === 0 &&
          state.players.some(
            (player) => Math.abs(player.x - player.originX) > 1,
          )
        )
          movedRooms.add(room.roomId);
      });
      room.onMessage("actionError", (error: string) => {
        actionErrors[error] = (actionErrors[error] ?? 0) + 1;
      });
      room.onLeave(() => {
        if (active) failure = "Load client disconnected unexpectedly";
      });
    }
  }
  let tick = 0;
  const end = performance.now() + seconds * 1000;
  while (performance.now() < end) {
    if (failure) throw new Error(failure);
    for (const room of rooms) {
      const state = room.state;
      if (
        !state?.players?.length ||
        state.phase !== "aiming" ||
        state.currentPlayer !== room.sessionId
      )
        continue;
      if (tick % 20 === 19)
        room.send("fire", {
          turnNumber: state.turnNumber,
          angle: -Math.PI / 2,
          power: 0.5,
        });
      else
        room.send("move", {
          turnNumber: state.turnNumber,
          direction: tick % 10 < 5 ? -1 : 1,
          sequence: tick + 1,
        });
      actions++;
    }
    if (tick % 10 === 0) {
      const sample = await metrics();
      peakRssBytes = Math.max(peakRssBytes, sample.rssBytes);
      peakSampledCumulativeP99Ms = Math.max(
        peakSampledCumulativeP99Ms,
        sample.eventLoopP99Ms,
      );
      if (sample.rooms !== count || sample.connections !== count * 2)
        throw new Error("Room or connection capacity drifted");
    }
    tick++;
    await delay(100);
  }
  const last = await metrics();
  const passed =
    peakRssBytes < 400 * 1024 * 1024 &&
    last.eventLoopP99Ms < 100 &&
    patches > count * 20 &&
    movedRooms.size === count &&
    explodedRooms.size === count &&
    last.rejectedRequests === 0 &&
    last.rejectedMessages === 0;
  console.info(
    JSON.stringify(
      {
        passed,
        rooms: count,
        clients: rooms.length,
        seconds,
        baselineUptimeSeconds: baseline.uptimeSeconds,
        actions,
        patches,
        movedRooms: movedRooms.size,
        explodedRooms: explodedRooms.size,
        actionErrors,
        peakRssBytes,
        peakSampledCumulativeP99Ms,
        wholeRunEventLoopP99Ms: last.eventLoopP99Ms,
        final: last,
      },
      null,
      2,
    ),
  );
  if (!passed) process.exitCode = 1;
} finally {
  active = false;
  await Promise.all(
    rooms.filter((room) => room.connection.isOpen).map((room) => room.leave()),
  );
  child?.kill("SIGTERM");
}
