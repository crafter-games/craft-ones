// The relay link for online play, over dotframe's relay client (web: connectRelay, native and iOS:
// connectRelayNative). Rooms are prefixed per game so a shared relay works too. The game messages are lobby
// traffic before the match: each peer's live lobby pick, the host's match start (the one place the match options
// are decided, so both peers build the same match), and a Discord user id for the name plates.

import type { RelayLink } from "dotframe/src/netplay";
import {
  PLAYABLE_MAP_IDS,
  type PlayableMapId,
  type PlayerOptions,
  validPlayerOptions,
} from "../../packages/shared/src";
import type { Person } from "./identity";
import type { MatchOptions } from "./match";

export interface GameMessage {
  // "start", "pick" or "who".
  t: string;
  seed?: number;
  options?: MatchOptions;
  species?: string;
  coat?: string;
  id?: string;
  // "who": what Discord says about the sender, so the peer needs no lookup of its own.
  username?: string;
  discriminator?: string;
  avatar?: string;
  // "pick": the map the sender wants (host, or the loser in a rematch) and whether they confirmed.
  map?: string;
  ready?: boolean;
}

// What the peer has on its lobby screen right now: its critter, the map it wants ("" when it does not pick the
// map) and whether it pressed READY.
export interface LobbyPick {
  player: PlayerOptions;
  map: PlayableMapId | "";
  ready: boolean;
}

export interface StartMessage {
  seed: number;
  options: MatchOptions;
}

export interface OnlineLink {
  room: string;
  relay: RelayLink<GameMessage>;
  // The host's start, once it arrives.
  start: () => StartMessage | null;
  // The peer's latest lobby pick, once one arrives.
  pick: () => LobbyPick | null;
  // The peer's Discord user id, or "" before it arrives (and always outside Discord).
  who: () => string;
  // What the peer says Discord knows about them, once it arrives.
  whoPerson: () => Person | null;
}

export const roomKey = (room: string): string => `craft-ones:${room}`;

export function wrapLink(
  relay: RelayLink<GameMessage>,
  room: string,
): OnlineLink {
  let start: StartMessage | null = null;
  let pick: LobbyPick | null = null;
  let who = "";
  let whoPerson: Person | null = null;
  const drain = (): void => {
    for (const message of relay.receive()) {
      if (message.t === "start" && message.options)
        start = { seed: message.seed ?? 0, options: message.options };
      else if (message.t === "pick") {
        const player = { species: message.species, coat: message.coat };
        const map = PLAYABLE_MAP_IDS.find((id) => id === message.map) ?? "";
        if (validPlayerOptions(player))
          pick = { player, map, ready: message.ready === true };
      } else if (message.t === "who" && message.id) {
        who = message.id;
        if (typeof message.username === "string" && message.username !== "")
          whoPerson = {
            id: message.id,
            username: message.username,
            discriminator: message.discriminator ?? "0",
            avatar: message.avatar ?? "",
          };
      }
    }
  };
  return {
    room,
    relay,
    start: (): StartMessage | null => {
      drain();
      return start;
    },
    pick: (): LobbyPick | null => {
      drain();
      return pick;
    },
    who: (): string => {
      drain();
      return who;
    },
    whoPerson: (): Person | null => {
      drain();
      return whoPerson;
    },
  };
}
