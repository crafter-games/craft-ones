import { type Client, Room } from "@colyseus/core";
import { Encoder } from "@colyseus/schema";
import { ARENA, type BattleState, PLAYABLE_MAP_IDS } from "@craft-ones/shared";
import { Battle } from "./Battle";

// A full 224 × 128 occupancy map is about 30 KB; patches only carry changed rows.
Encoder.BUFFER_SIZE = 64 * 1024;

export class BattleRoom extends Room<BattleState> {
  maxClients = 2;
  autoDispose = true;
  private battle!: Battle;

  onCreate(options: { mapId?: unknown } = {}) {
    this.battle = new Battle(
      undefined,
      PLAYABLE_MAP_IDS.find((id) => id === options.mapId) ?? "andes",
    );
    this.setState(this.battle.state);
    this.setPatchRate(ARENA.stepMs * 3);
    this.setSimulationInterval((dtMs) => this.battle.step(dtMs), ARENA.stepMs);
    this.onMessage("fire", (client, payload: unknown) => {
      const error = this.battle.fire(client.sessionId, payload);
      if (error) client.send("actionError", error);
    });
    this.onMessage("move", (client, payload: unknown) => {
      const error = this.battle.move(client.sessionId, payload);
      if (error) client.send("actionError", error);
    });
    for (const action of ["jump", "ability"] as const)
      this.onMessage(action, (client, payload: unknown) => {
        const error = this.battle[action](client.sessionId, payload);
        if (error) client.send("actionError", error);
      });
    this.onMessage("restart", (client, payload: unknown) => {
      const error = this.battle.restart(client.sessionId, payload);
      if (error) client.send("actionError", error);
    });
    this.onMessage("*", (client) => {
      client.send("actionError", "Unknown action");
    });
  }

  async onJoin(client: Client, options: { player?: unknown } = {}) {
    this.battle.addPlayer(client.sessionId, options.player);
    if (this.state.phase !== "waiting") await this.lock();
  }

  onLeave(client: Client) {
    this.battle.removePlayer(client.sessionId);
  }
}
