import { type Client, Room, ServerError } from "@colyseus/core";
import { Encoder } from "@colyseus/schema";
import {
  ARENA,
  type BattleState,
  isOpeningSeat,
  PLAYABLE_MAP_IDS,
} from "@craft-ones/shared";
import { Battle } from "./Battle";
import { type Admission, TokenBucket } from "./limits";

// A full 224 × 128 occupancy map is about 30 KB; patches only carry changed rows.
Encoder.BUFFER_SIZE = 128 * 1024;

export class BattleRoom extends Room<BattleState> {
  maxClients = 2;
  autoDispose = true;
  private battle!: Battle;
  protected admission!: Admission;
  private messages = new Map<string, TokenBucket>();

  onCreate(options: { mapId?: unknown; openingSeat?: unknown } = {}) {
    if (!this.admission.acquireRoom(this.roomId))
      throw new ServerError(503, "All arenas are busy. Try again shortly.");
    this.battle = new Battle(
      undefined,
      PLAYABLE_MAP_IDS.find((id) => id === options.mapId) ?? "andes",
      Math.floor(Math.random() * 0x1_0000_0000),
      isOpeningSeat(options.openingSeat) ? options.openingSeat : "host",
    );
    this.setState(this.battle.state);
    this.setPatchRate(ARENA.stepMs * 3);
    this.setSimulationInterval((dtMs) => this.battle.step(dtMs), ARENA.stepMs);
    let finishedAt = 0;
    const createdAt = performance.now();
    this.state.waitingRemainingMs = this.admission.waitingMs;
    this.clock.setInterval(() => {
      const now = performance.now();
      this.state.waitingRemainingMs =
        this.state.phase === "waiting"
          ? Math.max(0, this.admission.waitingMs - (now - createdAt))
          : 0;
      if (this.state.phase === "finished") finishedAt ||= now;
      else finishedAt = 0;
      if (
        now - createdAt >= this.admission.lifetimeMs ||
        (this.state.phase === "waiting" &&
          now - createdAt >= this.admission.waitingMs) ||
        (finishedAt > 0 && now - finishedAt >= this.admission.finishedMs)
      )
        void this.disconnect(4000);
    }, 100);
    for (const action of [
      "select",
      "fire",
      "move",
      "jump",
      "ability",
      "restart",
    ] as const)
      this.onMessage(action, (client, payload: unknown) => {
        if (!this.allowMessage(client)) return;
        const error = this.battle[action](client.sessionId, payload);
        if (error) client.send("actionError", error);
        else client.send("actionAccepted");
      });
    this.onMessage("*", (client) => {
      if (!this.allowMessage(client)) return;
      client.send("actionError", "Unknown action");
    });
  }

  private allowMessage(client: Client) {
    const bucket = this.messages.get(client.sessionId);
    if (bucket?.take()) return true;
    this.admission.rejectedMessages++;
    client.leave(4008, "Too many messages");
    return false;
  }

  async onJoin(client: Client, options: { player?: unknown } = {}) {
    this.messages.set(client.sessionId, new TokenBucket(40, 20));
    this.battle.addPlayer(client.sessionId, options.player);
    if (this.state.phase !== "waiting") {
      this.state.waitingRemainingMs = 0;
      await this.lock();
    }
  }

  onLeave(client: Client) {
    this.messages.delete(client.sessionId);
    this.battle.removePlayer(client.sessionId);
  }

  onDispose() {
    this.admission.releaseRoom(this.roomId);
  }
}
