import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function metricIssues(metrics, previous) {
  for (const key of [
    "rooms",
    "connections",
    "rssBytes",
    "eventLoopP99Ms",
    "uptimeSeconds",
    "rejectedRequests",
    "rejectedConnections",
    "rejectedMessages",
  ])
    if (!Number.isFinite(metrics[key]) || metrics[key] < 0)
      throw new Error(`Invalid metric: ${key}`);
  const issues = [];
  if (metrics.draining) issues.push("game draining");
  if (metrics.rssBytes > 400 * 1024 * 1024)
    issues.push("game memory above 400 MiB");
  if (metrics.eventLoopP99Ms > 100) issues.push("event loop p99 above 100 ms");
  if (metrics.rooms > 8) issues.push("room occupancy above 80 percent");
  if (previous && metrics.uptimeSeconds < previous.uptimeSeconds)
    issues.push("game restarted");
  for (const key of [
    "rejectedRequests",
    "rejectedConnections",
    "rejectedMessages",
  ])
    if (previous && metrics[key] > previous[key])
      issues.push(`${key} increased`);
  return issues;
}

export async function sample({ urls, metricsUrl, token, fetcher = fetch }) {
  const issues = [];
  for (const [name, url] of Object.entries(urls)) {
    try {
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      });
      if (!response.ok) issues.push(`${name} HTTP ${response.status}`);
      await response.body?.cancel();
    } catch {
      issues.push(`${name} unreachable`);
    }
  }
  let metrics;
  try {
    const response = await fetcher(metricsUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (!response.ok) throw new Error("Metrics unavailable");
    metrics = await response.json();
    metricIssues(metrics);
  } catch {
    metrics = undefined;
    issues.push("private metrics unavailable");
  }
  return { issues, metrics };
}

export function transition(state, issues) {
  const failed = issues.length > 0;
  const next = {
    failures: failed ? state.failures + 1 : 0,
    alerted: state.alerted,
  };
  let event;
  const immediate = issues.some(
    (issue) => issue === "game restarted" || issue.endsWith(" increased"),
  );
  if (failed && (next.failures >= 3 || immediate) && !state.alerted) {
    next.alerted = true;
    event = { status: "firing", issues };
  } else if (!failed && state.alerted) {
    next.alerted = false;
    event = { status: "resolved", issues: [] };
  }
  return { state: next, event };
}

export async function deliver(event, webhook, fetcher = fetch) {
  if (!webhook) return false;
  const response = await fetcher(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `Craft Ones ${event.status}: ${event.issues.join(", ") || "all probes healthy"}`,
      ...event,
    }),
    signal: AbortSignal.timeout(8000),
    redirect: "error",
  });
  await response.body?.cancel();
  if (!response.ok) throw new Error(`Alert delivery HTTP ${response.status}`);
  return true;
}

export async function deliverPending(pending, webhook, fetcher = fetch) {
  while (pending.length && (await deliver(pending[0], webhook, fetcher)))
    pending.shift();
}

async function main() {
  const token = process.env.METRICS_TOKEN;
  if (!token) throw new Error("METRICS_TOKEN is required");
  const webhook = process.env.ALERT_WEBHOOK_URL;
  const options = {
    token,
    urls: {
      frontend: "https://craft-ones.crafter.run",
      backend: "https://craft-ones-game.crafter.run/health",
    },
    metricsUrl: "http://game:2567/metrics",
  };
  let state = { failures: 0, alerted: false };
  let previous;
  const pending = [];
  const log = (data) =>
    console.log(JSON.stringify({ time: new Date().toISOString(), ...data }));
  log({ event: "monitor started", alertDeliveryConfigured: Boolean(webhook) });
  for (;;) {
    const current = await sample(options);
    const issues = [
      ...current.issues,
      ...(current.metrics ? metricIssues(current.metrics, previous) : []),
    ];
    const result = transition(state, issues);
    state = result.state;
    if (result.event) {
      log({ event: "alert transition", ...result.event });
      if (webhook) {
        if (pending.length >= 100) {
          pending.shift();
          log({ event: "alert backlog full; oldest transition dropped" });
        }
        pending.push(result.event);
      }
    }
    try {
      await deliverPending(pending, webhook);
    } catch {
      log({ event: "alert delivery failed; retrying next sample" });
    }
    log({
      event: "health sample",
      healthy: issues.length === 0,
      issues,
      metrics: current.metrics,
    });
    writeFileSync("/tmp/heartbeat", String(Date.now()));
    previous = current.metrics ?? previous;
    await new Promise((resolve) => setTimeout(resolve, 30000));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
