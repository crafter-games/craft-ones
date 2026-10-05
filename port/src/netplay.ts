// Rollback netplay for two peers, adapted from Crafter Smash. Each peer simulates every frame at once, predicting
// the remote input as the last one seen. When the real input arrives and differs, it restores the snapshot taken
// before that frame and simulates up to the present again. Local input is delayed a few frames so most remote
// input arrives in time and rollbacks stay short. Craft Ones is turn-based, so the waiting seat almost never
// changes its input and predictions are usually right.
const SUM_EVERY = 30;
// Weight of each new sample in the round-trip and lead averages.
const SMOOTHING = 0.1;
// Inputs resent with every message so a late peer catches up without acknowledgments.
const RESEND = 8;

export interface InputMessage {
  t: "input";
  // The sender's current frame, and the latest `now` it has received from us (to measure the round trip).
  now: number;
  ack: number;
  // Consecutive inputs starting at frame `from`.
  from: number;
  inputs: number[];
}

export interface SumMessage {
  t: "sum";
  frame: number;
  sum: number;
}

export type NetMessage = InputMessage | SumMessage;

export interface Transport {
  send: (message: NetMessage) => void;
  receive: () => NetMessage[];
}

export interface Game<S> {
  step: (inputs: number[]) => void;
  save: () => S;
  restore: (snapshot: S) => void;
  checksum: () => number;
}

export interface RollbackStats {
  frame: number;
  rollbacks: number;
  longestRollback: number;
  stalls: number;
  // First frame whose checksum differed from the peer's, or -1.
  desync: number;
  // Smoothed round trip and lead over the peer, in frames.
  rtt: number;
  ahead: number;
}

export interface Rollback {
  // One step: sends local input, applies remote input, rolls back if needed, then advances a frame unless too
  // far ahead of the peer. Returns whether a frame was simulated.
  tick: (localInput: number) => boolean;
  stats: () => RollbackStats;
}

export function createRollback<S>(options: {
  game: Game<S>;
  transport: Transport;
  localSeat: number;
  inputDelay: number;
  maxRollback: number;
}): Rollback {
  const { game, transport, localSeat, inputDelay, maxRollback } = options;
  const remoteSeat = 1 - localSeat;
  const local: number[] = [];
  const remote: number[] = [];
  const used: number[] = [];
  const snapshots: (S | null)[] = [];
  const sums: number[] = [];
  const peerSums = new Map<number, number>();
  let frame = 0;
  // Every remote input below this frame is known.
  let confirmed = inputDelay;
  let peerNow = 0;
  let rtt = 0;
  let ahead = 0;
  let sentSums = 0;
  const stats: RollbackStats = {
    frame: 0,
    rollbacks: 0,
    longestRollback: 0,
    stalls: 0,
    desync: -1,
    rtt: 0,
    ahead: 0,
  };
  for (let f = 0; f < inputDelay; f++) {
    local[f] = 0;
    remote[f] = 0;
  }

  const remoteFor = (f: number): number =>
    f < confirmed ? remote[f] : confirmed > 0 ? remote[confirmed - 1] : 0;

  const simulate = (f: number): void => {
    snapshots[f] = game.save();
    const inputs = [0, 0];
    inputs[localSeat] = local[f] ?? 0;
    const r = remoteFor(f);
    inputs[remoteSeat] = r;
    used[f] = r;
    game.step(inputs);
    sums[f] = game.checksum();
    const drop = f - maxRollback - 2;
    if (drop >= 0) snapshots[drop] = null;
  };

  const settle = (): void => {
    let rollbackTo = frame;
    for (const message of transport.receive()) {
      if (message.t === "sum") {
        peerSums.set(message.frame, message.sum);
        continue;
      }
      if (message.now >= peerNow) {
        peerNow = message.now;
        rtt =
          rtt * (1 - SMOOTHING) + Math.max(0, frame - message.ack) * SMOOTHING;
      }
      for (let i = 0; i < message.inputs.length; i++) {
        const f = message.from + i;
        if (f < confirmed) continue;
        if (f !== confirmed) break;
        remote[f] = message.inputs[i];
        confirmed = f + 1;
        if (f < frame && used[f] !== remote[f] && f < rollbackTo)
          rollbackTo = f;
      }
    }
    for (let f = confirmed; f < frame && rollbackTo === frame; f++)
      if (used[f] !== remoteFor(f)) rollbackTo = f;
    if (rollbackTo < frame) {
      const snapshot = snapshots[rollbackTo];
      if (snapshot) {
        stats.rollbacks += 1;
        stats.longestRollback = Math.max(
          stats.longestRollback,
          frame - rollbackTo,
        );
        game.restore(snapshot);
        for (let f = rollbackTo; f < frame; f++) simulate(f);
      }
    }
  };

  const tick = (localInput: number): boolean => {
    settle();
    ahead = ahead * (1 - SMOOTHING) + (frame - (peerNow + rtt / 2)) * SMOOTHING;
    stats.rtt = rtt;
    stats.ahead = ahead;
    if (frame - confirmed >= maxRollback || ahead > 1) {
      stats.stalls += 1;
      const from = Math.max(0, frame + inputDelay - RESEND);
      transport.send({
        t: "input",
        now: frame,
        ack: peerNow,
        from,
        inputs: local.slice(from, frame + inputDelay),
      });
      return false;
    }
    local[frame + inputDelay] = localInput;
    const from = Math.max(0, frame + inputDelay + 1 - RESEND);
    transport.send({
      t: "input",
      now: frame,
      ack: peerNow,
      from,
      inputs: local.slice(from, frame + inputDelay + 1),
    });
    simulate(frame);
    frame += 1;
    while (sentSums + SUM_EVERY < confirmed && sentSums + SUM_EVERY < frame) {
      sentSums += SUM_EVERY;
      transport.send({ t: "sum", frame: sentSums, sum: sums[sentSums] });
    }
    for (const [f, sum] of peerSums) {
      if (f >= confirmed || f >= frame) continue;
      if (sums[f] !== sum && stats.desync < 0) stats.desync = f;
      peerSums.delete(f);
    }
    stats.frame = frame;
    return true;
  };

  return { tick, stats: (): RollbackStats => stats };
}
