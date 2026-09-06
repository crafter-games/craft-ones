import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { matchMaker, Server, type ServerOptions } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { BattleRoom } from "./BattleRoom";

const MAX_PAYLOAD = 4_096;
const DEFAULT_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

export function parseWebOrigins(value: string | undefined): Set<string> {
  const origins = new Set(DEFAULT_ORIGINS);
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
  response.writeHead(status, {
    "Content-Type": "application/json",
    Vary: "Origin",
  });
  response.end(JSON.stringify({ error: message }));
}

class BattleServer extends Server {
  constructor(
    private readonly origins: Set<string>,
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
  options: { webOrigin?: string; gracefullyShutdown?: boolean } = {},
) {
  const origins = parseWebOrigins(options.webOrigin ?? process.env.WEB_ORIGIN);
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
    if (
      path === "/health" &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      response.writeHead(200, {
        ...corsHeaders(request, origins),
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(
        request.method === "HEAD" ? undefined : JSON.stringify({ ok: true }),
      );
      return;
    }
    reject(response, 404, "Not found");
  });
  httpServer.requestTimeout = 10_000;
  httpServer.headersTimeout = 10_000;
  const server = new BattleServer(origins, {
    transport: new WebSocketTransport({
      server: httpServer,
      maxPayload: MAX_PAYLOAD,
      perMessageDeflate: false,
      verifyClient: ({ req }, accept) => {
        const allowed = originAllowed(req, origins);
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
  server.define("battle", BattleRoom);
  return { server, httpServer };
}
