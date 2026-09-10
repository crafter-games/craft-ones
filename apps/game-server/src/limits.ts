import type { IncomingMessage } from "node:http";
import { isIP } from "node:net";

export function integerSetting(
  name: string,
  fallback: number,
  min = 1,
  max = 100_000,
) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  return value;
}

export class TokenBucket {
  private tokens: number;
  private updated: number;
  constructor(
    private capacity: number,
    private perSecond: number,
    private now = () => performance.now(),
  ) {
    this.tokens = capacity;
    this.updated = now();
  }
  take() {
    const now = this.now();
    this.tokens = Math.min(
      this.capacity,
      this.tokens + (Math.max(0, now - this.updated) * this.perSecond) / 1000,
    );
    this.updated = now;
    if (this.tokens < 1) return false;
    this.tokens--;
    return true;
  }
}

type Peer = {
  requests: TokenBucket;
  creates: TokenBucket;
  touched: number;
  connections: number;
};

export class Admission {
  readonly maxRooms = integerSetting("MAX_ROOMS", 10);
  readonly maxConnections = integerSetting("MAX_CONNECTIONS", 20);
  readonly perIpConnections = integerSetting("MAX_CONNECTIONS_PER_IP", 16);
  readonly requestRate = integerSetting("MATCHMAKE_PER_MINUTE", 120);
  readonly createRate = integerSetting("CREATE_PER_MINUTE", 10);
  readonly proxyHops = integerSetting("TRUST_PROXY_HOPS", 0, 0, 8);
  readonly waitingMs = integerSetting(
    "WAITING_ROOM_MS",
    300_000,
    100,
    3_600_000,
  );
  readonly lifetimeMs = integerSetting(
    "ROOM_LIFETIME_MS",
    1_800_000,
    100,
    7_200_000,
  );
  readonly finishedMs = integerSetting(
    "FINISHED_ROOM_MS",
    120_000,
    100,
    3_600_000,
  );
  private peers = new Map<string, Peer>();
  private rooms = new Set<string>();
  private globalRequests = new TokenBucket(200, 100);
  connections = 0;
  rejectedRequests = 0;
  rejectedConnections = 0;
  rejectedMessages = 0;
  draining = false;

  private peer(request: IncomingMessage) {
    const chain = (request.headers["x-forwarded-for"] ?? "")
      .toString()
      .split(",")
      .map((value) => value.trim());
    chain.push(request.socket.remoteAddress ?? "unknown");
    const candidate = chain[Math.max(0, chain.length - 1 - this.proxyHops)];
    const address = isIP(candidate)
      ? candidate.replace(/^::ffff:/, "")
      : "unknown";
    const now = performance.now();
    let peer = this.peers.get(address);
    if (!peer) {
      if (this.peers.size >= 4096) {
        for (const [key, value] of this.peers)
          if (value.connections === 0 && now - value.touched > 60_000)
            this.peers.delete(key);
        if (this.peers.size >= 4096) return null;
      }
      peer = {
        requests: new TokenBucket(this.requestRate, this.requestRate / 60),
        creates: new TokenBucket(this.createRate, this.createRate / 60),
        touched: now,
        connections: 0,
      };
      this.peers.set(address, peer);
    }
    peer.touched = now;
    return peer;
  }

  allowRequest(request: IncomingMessage, creating: boolean) {
    const peer = this.peer(request);
    const allowed =
      !this.draining &&
      peer?.requests.take() &&
      (!creating || peer.creates.take()) &&
      this.globalRequests.take();
    if (!allowed) this.rejectedRequests++;
    return !!allowed;
  }

  reserveConnection(request: IncomingMessage) {
    const peer = this.peer(request);
    if (
      this.draining ||
      !peer ||
      this.connections >= this.maxConnections ||
      peer.connections >= this.perIpConnections
    ) {
      this.rejectedConnections++;
      return false;
    }
    this.connections++;
    peer.connections++;
    request.socket.once("close", () => {
      this.connections--;
      peer.connections--;
      peer.touched = performance.now();
    });
    return true;
  }

  acquireRoom(id: string) {
    if (this.draining || this.rooms.size >= this.maxRooms) return false;
    this.rooms.add(id);
    return true;
  }

  releaseRoom(id: string) {
    this.rooms.delete(id);
  }

  snapshot() {
    return {
      rooms: this.rooms.size,
      connections: this.connections,
      rejectedRequests: this.rejectedRequests,
      rejectedConnections: this.rejectedConnections,
      rejectedMessages: this.rejectedMessages,
      draining: this.draining,
    };
  }
}
