// The relay link for online play (web only), on dotframe's relay client. Rooms are prefixed per game so a relay
// shared with other games works too. The only game message is the host's match start.
import type { RelayLink } from "dotframe/src/netplay";
import { connectRelay } from "dotframe/src/relay-client";
import type { MatchOptions } from "./match";

export interface StartMessage {
  t: "start";
  seed: number;
  options: MatchOptions;
}

export interface OnlineLink extends RelayLink<StartMessage> {
  // The host's start, once it arrives.
  start: () => StartMessage | null;
}

export function connectOnline(url: string, room: string): OnlineLink {
  const relay = connectRelay<StartMessage>(url, `craft-ones:${room}`);
  let start: StartMessage | null = null;
  return {
    ...relay,
    room,
    start: (): StartMessage | null => {
      for (const message of relay.receive())
        if (message.t === "start") start = message;
      return start;
    },
  };
}
