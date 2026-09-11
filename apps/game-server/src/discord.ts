import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { type Client, matchMaker, ServerError } from "@colyseus/core";
import { PLAYABLE_MAP_IDS, validPlayerOptions } from "@craft-ones/shared";
import { BattleRoom } from "./BattleRoom";
import type { Admission } from "./limits";

export type DiscordApp = {
  clientId: string;
  clientSecret: string;
  botToken: string;
};
export function discordApps(
  value = process.env.DISCORD_APPLICATIONS,
): DiscordApp[] {
  if (!value) return [];
  const apps: DiscordApp[] = JSON.parse(value);
  if (
    !Array.isArray(apps) ||
    apps.length > 4 ||
    apps.some(
      (app) =>
        !app ||
        typeof app.clientId !== "string" ||
        !/^\d{17,20}$/.test(app.clientId) ||
        typeof app.clientSecret !== "string" ||
        !app.clientSecret ||
        typeof app.botToken !== "string" ||
        !app.botToken,
    ) ||
    new Set(apps.map((app) => app.clientId)).size !== apps.length
  )
    throw new Error("Invalid DISCORD_APPLICATIONS configuration");
  return apps;
}

export class DiscordFailure extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export class DiscordIdentity {
  constructor(
    private apps: DiscordApp[],
    private fetcher: (
      input: string,
      options: RequestInit,
    ) => Promise<Response> = fetch,
  ) {}
  app(clientId: unknown) {
    const app = this.apps.find((app) => app.clientId === clientId);
    if (!app)
      throw new DiscordFailure(
        400,
        "This Discord application is not configured.",
      );
    return app;
  }
  async request(path: string, options: RequestInit) {
    const response = await this.fetcher(`https://discord.com/api/v10/${path}`, {
      ...options,
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok)
      throw new DiscordFailure(
        response.status === 429 ? 429 : 401,
        response.status === 429
          ? "Discord is busy. Try again shortly."
          : "Discord authorization failed. Reopen the Activity.",
      );
    return response.json();
  }
  async exchange(clientId: unknown, code: unknown) {
    const app = this.app(clientId);
    if (typeof code !== "string" || code.length < 1 || code.length > 512)
      throw new DiscordFailure(400, "Invalid authorization code.");
    const token = await this.request("oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: app.clientId,
        client_secret: app.clientSecret,
        grant_type: "authorization_code",
        code,
      }),
    });
    if (typeof token.access_token !== "string")
      throw new DiscordFailure(502, "Discord did not authorize this session.");
    return { access_token: token.access_token };
  }
  async verify(clientId: unknown, token: unknown, instanceId: unknown) {
    const app = this.app(clientId);
    if (
      typeof token !== "string" ||
      token.length < 1 ||
      token.length > 512 ||
      typeof instanceId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,200}$/.test(instanceId)
    )
      throw new DiscordFailure(400, "Invalid Discord session.");
    const headers = { Authorization: `Bearer ${token}` };
    const [authorization, user] = await Promise.all([
      this.request("oauth2/@me", { headers }),
      this.request("users/@me", { headers }),
    ]);
    if (
      authorization.application?.id !== app.clientId ||
      !authorization.scopes?.includes("identify") ||
      typeof user.id !== "string" ||
      !/^\d{17,20}$/.test(user.id)
    )
      throw new DiscordFailure(
        403,
        "This authorization belongs to another application.",
      );
    const instance = await this.request(
      `applications/${app.clientId}/activity-instances/${instanceId}`,
      {
        headers: { Authorization: `Bot ${app.botToken}` },
      },
    );
    if (
      instance.application_id !== app.clientId ||
      instance.instance_id !== instanceId ||
      !instance.users?.includes(user.id)
    )
      throw new DiscordFailure(
        403,
        "Join this Activity in Discord before playing.",
      );
    return { userId: user.id as string, instanceId, clientId: app.clientId };
  }
}

type Instance = { roomId: string; pending: Map<string, number> };
export function discordService(
  admission: Admission,
  apps: DiscordApp[],
  identity = new DiscordIdentity(apps),
) {
  const provision = randomUUID();
  const instances = new Map<string, Instance>();
  let queue = Promise.resolve();
  let inFlight = 0;
  class DiscordBattleRoom extends BattleRoom {
    protected admission = admission;
    private instanceKey = "";
    onCreate(
      options: {
        provision?: string;
        instanceKey?: string;
        mapId?: unknown;
      } = {},
    ) {
      if (options.provision !== provision || !options.instanceKey)
        throw new ServerError(403, "Open this game from Discord.");
      this.instanceKey = options.instanceKey;
      super.onCreate(options);
      this.setSeatReservationTime(15);
      void this.setPrivate(true);
    }
    onAuth() {
      throw new ServerError(403, "Use the Discord session endpoint.");
    }
    async onJoin(client: Client, options: { player?: unknown } = {}) {
      const userId = client.auth?.discordUserId;
      if (
        !userId ||
        this.clients.some(
          (peer) => peer !== client && peer.auth?.discordUserId === userId,
        )
      )
        throw new ServerError(403, "This Discord user already has a seat.");
      await super.onJoin(client, options);
      instances.get(this.instanceKey)?.pending.delete(userId);
    }
    onDispose() {
      if (instances.get(this.instanceKey)?.roomId === this.roomId)
        instances.delete(this.instanceKey);
      super.onDispose();
    }
  }
  async function join(body: Record<string, unknown>) {
    if (
      !PLAYABLE_MAP_IDS.includes(body.mapId as never) ||
      !validPlayerOptions(body.player)
    )
      throw new DiscordFailure(400, "Choose a valid map and critter.");
    const verified = await identity.verify(
      body.clientId,
      body.accessToken,
      body.instanceId,
    );
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const key = `${verified.clientId}:${verified.instanceId}`;
      let instance = instances.get(key);
      if (instance && !matchMaker.getLocalRoomById(instance.roomId)) {
        instances.delete(key);
        instance = undefined;
      }
      if (!instance) {
        const room = await matchMaker.createRoom("discord_battle", {
          provision,
          instanceKey: key,
          mapId: body.mapId,
        });
        instance = { roomId: room.roomId, pending: new Map() };
        instances.set(key, instance);
      }
      const room = matchMaker.getLocalRoomById(instance.roomId);
      if (!room || room.state.phase === "finished")
        throw new DiscordFailure(
          409,
          "This match has ended. Close the Activity together and start a new one.",
        );
      for (const [user, expiry] of instance.pending)
        if (expiry <= Date.now()) instance.pending.delete(user);
      if (
        instance.pending.has(verified.userId) ||
        room.clients.some(
          (peer) => peer.auth?.discordUserId === verified.userId,
        )
      )
        throw new DiscordFailure(
          409,
          "You already have a seat. Close your other game window first.",
        );
      if (room.clients.length + instance.pending.size >= 2)
        throw new DiscordFailure(
          409,
          "Both seats are taken. This game is for two players.",
        );
      const reservation = await matchMaker.reserveSeatFor(
        await matchMaker.getRoomById(instance.roomId),
        { player: body.player },
        { discordUserId: verified.userId },
      );
      instance.pending.set(verified.userId, Date.now() + 15_000);
      return reservation;
    } finally {
      release();
    }
  }
  async function handle(request: IncomingMessage, response: ServerResponse) {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json");
    if (request.method === "OPTIONS") {
      response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method !== "POST") {
      response.writeHead(405);
      response.end("{}");
      return;
    }
    if (inFlight >= 32 || !admission.allowRequest(request, true)) {
      response.setHeader("Retry-After", "60");
      response.writeHead(429);
      response.end(
        JSON.stringify({ error: "Too many requests. Try again shortly." }),
      );
      return;
    }
    inFlight++;
    try {
      let bytes = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of request.iterator({ destroyOnReturn: false })) {
        bytes += chunk.length;
        if (bytes > 4096) {
          request.pause();
          response.once("finish", () => request.destroy());
          throw new DiscordFailure(413, "Request too large.");
        }
        chunks.push(Buffer.from(chunk));
      }
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        throw new DiscordFailure(400, "Invalid request.");
      }
      if (!body || Array.isArray(body) || typeof body !== "object")
        throw new DiscordFailure(400, "Invalid request.");
      const path = request.url?.split("?")[0];
      const result =
        path === "/discord/token"
          ? await identity.exchange(body.clientId, body.code)
          : path === "/discord/session"
            ? await join(body)
            : null;
      if (!result) throw new DiscordFailure(404, "Not found");
      response.end(JSON.stringify(result));
    } catch (error) {
      response.statusCode =
        error instanceof DiscordFailure ? error.status : 503;
      if (response.statusCode === 429) response.setHeader("Retry-After", "60");
      response.end(
        JSON.stringify({
          error:
            error instanceof DiscordFailure
              ? error.message
              : "The arena is unavailable. Please try again.",
        }),
      );
    } finally {
      inFlight--;
    }
  }
  return { Room: DiscordBattleRoom, handle };
}
