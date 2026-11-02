// The relay link for online play, over dotframe's relay client (web: connectRelay, native and iOS:
// connectRelayNative). Rooms are prefixed per game so a shared relay works too. The game messages are lobby
// traffic before the match: the guest's critter pick, the host's match start (the one place the match options
// are decided, so both peers build the same match), and a Discord user id for the name plates.

import {
  type PlayerOptions,
  validPlayerOptions,
} from "../../packages/shared/src";
import type { MatchOptions } from "./match";
import type { RelayLink } from "./netplay";

export interface GameMessage {
  // "start", "pick" or "who".
  t: string;
  seed?: number;
  options?: MatchOptions;
  species?: string;
  coat?: string;
  id?: string;
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
  // The guest's critter, once it arrives.
  pick: () => PlayerOptions | null;
  // The peer's Discord user id, or "" before it arrives (and always outside Discord).
  who: () => string;
}

export const roomKey = (room: string): string => `craft-ones:${room}`;

export function wrapLink(
  relay: RelayLink<GameMessage>,
  room: string,
): OnlineLink {
  let start: StartMessage | null = null;
  let pick: PlayerOptions | null = null;
  let who = "";
  const drain = (): void => {
    for (const message of relay.receive()) {
      if (message.t === "start" && message.options)
        start = { seed: message.seed ?? 0, options: message.options };
      else if (message.t === "pick") {
        const options = { species: message.species, coat: message.coat };
        if (validPlayerOptions(options)) pick = options;
      } else if (message.t === "who" && message.id) who = message.id;
    }
  };
  return {
    room,
    relay,
    start: (): StartMessage | null => {
      drain();
      return start;
    },
    pick: (): PlayerOptions | null => {
      drain();
      return pick;
    },
    who: (): string => {
      drain();
      return who;
    },
  };
}
