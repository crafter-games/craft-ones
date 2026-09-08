import type {
  BattleState,
  PlayableMapId,
  PlayerOptions,
} from "@craft-ones/shared";
import { Client, type Room } from "colyseus.js";

export type BattleRoom = Room<BattleState>;
type Connection = {
  promise: Promise<BattleRoom>;
  users: number;
  cleanup?: ReturnType<typeof setTimeout>;
};
const connections = new Map<string, Connection>();

function client() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const endpoint =
    process.env.NEXT_PUBLIC_GAME_SERVER_URL ||
    `${protocol}://${window.location.hostname}:2567`;
  return new Client(endpoint);
}

function scheduleRelease(id: string, entry: Connection, delay: number) {
  entry.cleanup = setTimeout(() => {
    if (entry.users !== 0) return;
    connections.delete(id);
    void entry.promise.then((room) => room.leave()).catch(() => undefined);
  }, delay);
}

export async function createBattle(
  mapId: PlayableMapId = "andes",
  player: PlayerOptions = { species: "cuy", coat: "caramel" },
) {
  const room = await client().create<BattleState>("battle", { mapId, player });
  const entry = { promise: Promise.resolve(room), users: 0 };
  connections.set(room.roomId, entry);
  scheduleRelease(room.roomId, entry, 30_000);
  return room.roomId;
}

export function acquireBattle(id: string, player?: PlayerOptions) {
  let entry = connections.get(id);
  if (!entry) {
    entry = {
      promise: client().joinById<BattleState>(id, { player }),
      users: 0,
    };
    connections.set(id, entry);
  }
  clearTimeout(entry.cleanup);
  entry.users++;
  const connection = entry;
  return {
    promise: connection.promise,
    release() {
      connection.users--;
      if (connection.users === 0) scheduleRelease(id, connection, 100);
    },
  };
}

export function hasBattle(id: string) {
  return connections.has(id);
}
