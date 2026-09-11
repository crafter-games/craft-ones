import { createHash, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { env } from "node:process";
import { matchMaker, Server, type ServerOptions } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { BattleRoom } from "./BattleRoom";
import {
  type DiscordApp,
  type DiscordIdentity,
  discordApps,
  discordService,
} from "./discord";
import { Admission } from "./limits";

const MAX_PAYLOAD = 4_096;
const DEFAULT_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

export function parseWebOrigins(value: string | undefined): Set<string> {
  const production = env.NODE_ENV === "production";
  const origins = new Set(production ? [] : DEFAULT_ORIGINS);
  for (const entry of value?.split(",") ?? []) {
    const candidate = entry.trim();
    if (!candidate) continue;
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new Error(`Invalid WEB_ORIGIN: ${candidate}`);
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        `WEB_ORIGIN must contain only HTTP(S) origins: ${candidate}`,
      );
    }
    origins.add(url.origin);
  }
  if (!origins.size) throw new Error("WEB_ORIGIN is required in production");
  return origins;
}

function originAllowed(request: IncomingMessage, origins: Set<string>) {
  return !request.headers.origin || origins.has(request.headers.origin);
}

function corsHeaders(
  request: IncomingMessage,
  origins: Set<string>,
): Record<string, string> {
  const headers: Record<string, string> = { Vary: "Origin" };
  if (request.headers.origin && origins.has(request.headers.origin)) {
    headers["Access-Control-Allow-Origin"] = request.headers.origin;
  }
  return headers;
}

function reject(response: ServerResponse, status: number, message: string) {
  if (response.writableEnded) return;
  response.writeHead(status, {
    "Content-Type": "application/json",
    Vary: "Origin",
  });
  response.end(JSON.stringify({ error: message }));
}

class BattleServer extends Server {
  constructor(
    private readonly origins: Set<string>,
    private readonly admission: Admission,
    options: ServerOptions,
  ) {
    super(options);
  }

  protected async handleMatchMakeRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    if (!originAllowed(request, this.origins)) {
      reject(response, 403, "Origin not allowed");
      return;
    }
    for (const [key, value] of Object.entries(
      corsHeaders(request, this.origins),
    ))
      response.setHeader(key, value);
    if (
      request.method !== "OPTIONS" &&
      !this.admission.allowRequest(
        request,
        /\/matchmake\/(create|joinOrCreate)\//.test(request.url ?? ""),
      )
    ) {
      response.setHeader("Retry-After", "60");
      reject(
        response,
        this.admission.draining ? 503 : 429,
        "Arena requests are limited. Try again shortly.",
      );
      return;
    }
    if (!["OPTIONS", "POST", "GET"].includes(request.method ?? "")) {
      reject(response, 405, "Method not allowed");
      return;
    }
    if (Number(request.headers["content-length"] ?? 0) > MAX_PAYLOAD) {
      reject(response, 413, "Payload too large");
      return;
    }
    if (request.method === "POST") {
      let received = 0;
      request.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (received <= MAX_PAYLOAD) return;
        request.pause();
        response.once("finish", () => request.destroy());
        reject(response, 413, "Payload too large");
      });
    }
    await super.handleMatchMakeRequest(request, response);
  }
}

export function createGameServer(
  options: {
    webOrigin?: string;
    gracefullyShutdown?: boolean;
    discord?: { apps: DiscordApp[]; identity: DiscordIdentity };
  } = {},
) {
  const origins = parseWebOrigins(options.webOrigin ?? process.env.WEB_ORIGIN);
  const admission = new Admission();
  const apps = options.discord?.apps ?? discordApps();
  for (const app of apps)
    origins.add(`https://${app.clientId}.discordsays.com`);
  const discord = discordService(admission, apps, options.discord?.identity);
  const lag = monitorEventLoopDelay({ resolution: 20 });
  lag.enable();
  class ConfiguredBattleRoom extends BattleRoom {
    protected admission = admission;
  }
  Reflect.deleteProperty(
    matchMaker.controller.DEFAULT_CORS_HEADERS,
    "Access-Control-Allow-Origin",
  );
  matchMaker.controller.getCorsHeaders = (request) =>
    corsHeaders(request, origins);

  const httpServer = createServer((request, response) => {
    if (!originAllowed(request, origins)) {
      reject(response, 403, "Origin not allowed");
      return;
    }
    const path = request.url?.split("?", 1)[0];
    if (path?.startsWith("/discord/")) {
      for (const [key, value] of Object.entries(corsHeaders(request, origins)))
        response.setHeader(key, value);
      void discord.handle(request, response);
      return;
    }
    if (path === "/metrics" && request.method === "GET") {
      const token = process.env.METRICS_TOKEN;
      const digest = (value: string) =>
        createHash("sha256").update(value).digest();
      if (
        !token ||
        !timingSafeEqual(
          digest(request.headers.authorization ?? ""),
          digest(`Bearer ${token}`),
        )
      ) {
        reject(response, 404, "Not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(
        JSON.stringify({
          ...admission.snapshot(),
          uptimeSeconds: process.uptime(),
          rssBytes: process.memoryUsage().rss,
          eventLoopP99Ms: lag.percentile(99) / 1e6,
        }),
      );
      return;
    }
    if (
      path === "/health" &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      response.writeHead(admission.draining ? 503 : 200, {
        ...corsHeaders(request, origins),
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(
        request.method === "HEAD"
          ? undefined
          : JSON.stringify({ ok: !admission.draining }),
      );
      return;
    }
    reject(response, 404, "Not found");
  });
  httpServer.requestTimeout = 10_000;
  httpServer.headersTimeout = 10_000;
  httpServer.on("close", () => lag.disable());
  const server = new BattleServer(origins, admission, {
    transport: new WebSocketTransport({
      server: httpServer,
      maxPayload: MAX_PAYLOAD,
      perMessageDeflate: false,
      verifyClient: ({ req }, accept) => {
        const allowed =
          originAllowed(req, origins) && admission.reserveConnection(req);
        accept(
          allowed,
          allowed ? undefined : 403,
          allowed ? undefined : "Origin not allowed",
        );
      },
    }),
    greet: false,
    gracefullyShutdown: options.gracefullyShutdown ?? true,
  });
  server.define("battle", ConfiguredBattleRoom);
  server.define("discord_battle", discord.Room);
  server.onBeforeShutdown(() => {
    admission.draining = true;
  });
  return { server, httpServer, admission };
}
