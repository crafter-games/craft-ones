import { expect, test } from "bun:test";
import {
  deliver,
  deliverPending,
  metricIssues,
  sample,
  transition,
} from "../../../scripts/monitor.mjs";

const healthy = {
  rooms: 0,
  connections: 0,
  rssBytes: 80000000,
  eventLoopP99Ms: 20,
  uptimeSeconds: 100,
  rejectedRequests: 0,
  rejectedConnections: 0,
  rejectedMessages: 0,
  draining: false,
};

test("monitor detects capacity, memory, latency, restarts and rejected traffic", () => {
  expect(metricIssues(healthy)).toEqual([]);
  expect(
    metricIssues(
      {
        ...healthy,
        rooms: 9,
        rssBytes: 500000000,
        eventLoopP99Ms: 120,
        uptimeSeconds: 1,
        rejectedConnections: 1,
      },
      healthy,
    ),
  ).toEqual([
    "game memory above 400 MiB",
    "event loop p99 above 100 ms",
    "room occupancy above 80 percent",
    "game restarted",
    "rejectedConnections increased",
  ]);
  expect(() => metricIssues({ ...healthy, rooms: undefined })).toThrow(
    "Invalid metric",
  );
});

test("transient outages do not alert, repeated outages fire once, recovery resolves", () => {
  let state = { failures: 0, alerted: false };
  for (let i = 0; i < 2; i++) {
    const next = transition(state, ["backend unreachable"]);
    expect(next.event).toBeUndefined();
    state = next.state;
  }
  const fired = transition(state, ["backend unreachable"]);
  expect(fired.event.status).toBe("firing");
  expect(
    transition(fired.state, ["backend unreachable"]).event,
  ).toBeUndefined();
  const recovered = transition(fired.state, []);
  expect(recovered.event.status).toBe("resolved");
  expect(transition(recovered.state, []).event).toBeUndefined();
  expect(
    transition({ failures: 0, alerted: false }, ["game restarted"]).event
      .status,
  ).toBe("firing");
});

test("probe failures and malformed private metrics fail closed without leaking the token", async () => {
  const seen = [];
  const result = await sample({
    urls: { frontend: "https://web", backend: "https://game/health" },
    metricsUrl: "http://game/metrics",
    token: "private-token",
    fetcher: async (url, options) => {
      seen.push([url, options]);
      if (url === "https://web") throw Error("network error");
      return new Response(url.endsWith("metrics") ? "{}" : "unhealthy", {
        status: url.endsWith("metrics") ? 200 : 503,
      });
    },
  });
  expect(result.issues).toEqual([
    "frontend unreachable",
    "backend HTTP 503",
    "private metrics unavailable",
  ]);
  expect(result.metrics).toBeUndefined();
  expect(seen[0][1].headers).toBeUndefined();
  expect(seen[2][1].headers.Authorization).toBe("Bearer private-token");
  expect(JSON.stringify(result.issues)).not.toContain("private-token");
});

test("webhook delivery requires successful HTTP and missing destinations stay unconfigured", async () => {
  const event = { status: "firing", issues: ["backend unreachable"] };
  expect(await deliver(event, undefined)).toBe(false);
  let body;
  expect(
    await deliver(event, "https://receiver", async (_url, options) => {
      body = JSON.parse(options.body);
      return new Response("ok");
    }),
  ).toBe(true);
  expect(body.text).toContain("backend unreachable");
  await expect(
    deliver(
      event,
      "https://receiver",
      async () => new Response("failed", { status: 500 }),
    ),
  ).rejects.toThrow("HTTP 500");
});

test("real HTTP probes produce an outage and recovery webhook", async () => {
  const { createServer } = await import("node:http");
  let failing = true;
  const received = [];
  const server = createServer(async (request, response) => {
    if (request.url === "/metrics") {
      if (request.headers.authorization !== "Bearer fixture-token") {
        response.writeHead(404).end();
        return;
      }
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(healthy));
    } else if (request.url === "/alert") {
      let body = "";
      for await (const chunk of request) body += chunk;
      received.push(JSON.parse(body));
      response.end("ok");
    } else {
      response.writeHead(failing ? 503 : 200).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    let state = { failures: 0, alerted: false };
    let result;
    for (let i = 0; i < 3; i++) {
      const current = await sample({
        urls: { backend: `${origin}/health` },
        metricsUrl: `${origin}/metrics`,
        token: "fixture-token",
      });
      result = transition(state, current.issues);
      state = result.state;
    }
    await deliver(result.event, `${origin}/alert`);
    failing = false;
    const current = await sample({
      urls: { backend: `${origin}/health` },
      metricsUrl: `${origin}/metrics`,
      token: "fixture-token",
    });
    await deliver(transition(state, current.issues).event, `${origin}/alert`);
    expect(received.map((event) => event.status)).toEqual([
      "firing",
      "resolved",
    ]);
    expect(received[0].text).toContain("HTTP 503");
    expect(JSON.stringify(received)).not.toContain("fixture-token");
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("failed alert delivery preserves outage before recovery on retry", async () => {
  const pending = [{ status: "firing", issues: ["backend unreachable"] }];
  await expect(
    deliverPending(
      pending,
      "https://receiver",
      async () => new Response("failed", { status: 500 }),
    ),
  ).rejects.toThrow("HTTP 500");
  pending.push({ status: "resolved", issues: [] });
  const received = [];
  await deliverPending(pending, "https://receiver", async (_url, options) => {
    received.push(JSON.parse(options.body).status);
    return new Response("ok");
  });
  expect(received).toEqual(["firing", "resolved"]);
  expect(pending).toEqual([]);
});
