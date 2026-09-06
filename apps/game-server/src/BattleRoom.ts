import { type Client, Room } from "@colyseus/core";
import { ARENA, type BattleState } from "@craft-ones/shared";
import { Battle } from "./Battle";

export class BattleRoom extends Room<BattleState> {
  maxClients = 2;
  autoDispose = true;
  private readonly battle = new Battle();

  onCreate() {
    this.setState(this.battle.state);
    this.setPatchRate(ARENA.stepMs * 3);
    this.setSimulationInterval((dtMs) => this.battle.step(dtMs), ARENA.stepMs);
    this.onMessage("fire", (client, payload: unknown) => {
      const error = this.battle.fire(client.sessionId, payload);
      if (error) client.send("actionError", error);
    });
    this.onMessage("*", (client) => {
      client.send("actionError", "Unknown action");
    });
  }

  async onJoin(client: Client) {
    this.battle.addPlayer(client.sessionId);
    if (this.state.phase !== "waiting") await this.lock();
  }

  onLeave(client: Client) {
    this.battle.removePlayer(client.sessionId);
  }
}
