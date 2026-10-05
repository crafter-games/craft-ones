// One WebSocket to the relay (server/relay.ts; rooms are prefixed per game so a shared relay works too), split
// into lobby messages and netplay messages. Web only.
import type { MatchOptions } from "./match";
import type { NetMessage, Transport } from "./netplay";

export interface StartMessage {
  t: "start";
  seed: number;
  options: MatchOptions;
}

export interface OnlineLink {
  room: string;
  // "connecting", "waiting" (alone in the room), "paired", "closed".
  status: () => string;
  // 0 hosts (chooses the match), 1 joins; -1 before the relay answers.
  slot: () => number;
  sendStart: (message: StartMessage) => void;
  start: () => StartMessage | null;
  transport: Transport;
  close: () => void;
}

export function connectOnline(url: string, room: string): OnlineLink {
  const socket = new WebSocket(
    `${url}${url.includes("?") ? "&" : "?"}room=${encodeURIComponent(`craft-ones:${room}`)}`,
  );
  let status = "connecting";
  let slot = -1;
  let start: StartMessage | null = null;
  const net: NetMessage[] = [];
  socket.onmessage = (event: MessageEvent): void => {
    const message = JSON.parse(String(event.data)) as {
      t: string;
      slot?: number;
      here?: boolean;
    };
    if (message.t === "hello") {
      slot = message.slot ?? -1;
      status = "waiting";
    } else if (message.t === "peer") {
      status = message.here ? "paired" : "waiting";
      if (!message.here) net.length = 0;
    } else if (message.t === "input" || message.t === "sum")
      net.push(message as unknown as NetMessage);
    else if (message.t === "start") start = message as unknown as StartMessage;
  };
  socket.onclose = (): void => {
    status = "closed";
  };
  const send = (message: object): void => {
    if (socket.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify(message));
  };
  return {
    room,
    status: (): string => status,
    slot: (): number => slot,
    sendStart: (message: StartMessage): void => send(message),
    start: (): StartMessage | null => start,
    transport: {
      send: (message: NetMessage): void => send(message),
      receive: (): NetMessage[] => net.splice(0, net.length),
    },
    close: (): void => socket.close(),
  };
}
