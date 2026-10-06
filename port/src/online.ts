// The relay link for online play, over dotframe's relay client (web: connectRelay, native and iOS:
// connectRelayNative). Rooms are prefixed per game so a shared relay works too. The only game message is the
// host's match start.

import type { MatchOptions } from "./match";
import type { RelayLink } from "./netplay";

export interface StartMessage {
  t: string;
  seed: number;
  options: MatchOptions;
}

export interface OnlineLink {
  room: string;
  relay: RelayLink<StartMessage>;
  // The host's start, once it arrives.
  start: () => StartMessage | null;
}

export const roomKey = (room: string): string => `craft-ones:${room}`;

export function wrapLink(
  relay: RelayLink<StartMessage>,
  room: string,
): OnlineLink {
  let start: StartMessage | null = null;
  return {
    room,
    relay,
    start: (): StartMessage | null => {
      for (const message of relay.receive())
        if (message.t === "start") start = message;
      return start;
    },
  };
}
