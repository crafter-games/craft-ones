import { expect, test } from "bun:test";
import {
  checksum,
  createMatch,
  ROLLBACK_WINDOW,
  randomInput,
  step,
} from "../src/match";
import { createRollback, type NetMessage } from "../src/netplay";
import { restoreMatch, snapshotMatch } from "../src/snapshot";

const rng = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

test("two rollback peers over a slow link end in the same state as a direct run", () => {
  const latency = 24;
  const frames = 1500;
  const queues: { at: number; message: NetMessage }[][] = [[], []];
  let clock = 0;
  const peers = [0, 1].map((seat) => {
    const match = createMatch(9);
    const rollback = createRollback({
      sim: {
        step: (inputs: number[]): void => step(match, inputs),
        save: () => snapshotMatch(match),
        restore: (s) => restoreMatch(match, s),
        checksum: (): number => checksum(match),
      },
      transport: {
        send: (message: NetMessage): void => {
          queues[1 - seat].push({
            at: clock + latency,
            message: structuredClone(message),
          });
        },
        receive: (): NetMessage[] => {
          const ready = queues[seat].filter((q) => q.at <= clock);
          queues[seat] = queues[seat].filter((q) => q.at > clock);
          return ready.map((q) => q.message);
        },
      },
      localPort: seat,
      neutral: 0,
      inputDelay: 10,
      maxRollback: ROLLBACK_WINDOW,
    });
    return { match, rollback, next: rng(100 + seat), sent: [] as number[] };
  });
  while (
    peers.some((p) => p.rollback.stats().frame < frames) &&
    clock < frames * 4
  ) {
    for (const p of peers)
      if (p.rollback.stats().frame < frames) {
        const input = randomInput(p.next);
        if (p.rollback.tick(input)) p.sent.push(input);
      }
    clock += 1;
  }
  // Let the last inputs land, then compare against one machine running the agreed inputs.
  for (let i = 0; i < latency * 3; i++) {
    clock += 1;
    for (const p of peers) p.rollback.tick(0);
  }
  for (const p of peers) expect(p.rollback.stats().desync).toBe(-1);
  expect(peers[0].rollback.stats().rollbacks).toBeGreaterThan(0);
  const direct = createMatch(9);
  const frame = Math.min(...peers.map((p) => p.match.frame)) - latency * 2;
  const inputsAt = (seat: number, f: number): number =>
    f < 10 ? 0 : (peers[seat].sent[f - 10] ?? 0);
  for (let f = 0; f < frame; f++)
    step(direct, [inputsAt(0, f), inputsAt(1, f)]);
  expect(peers[0].match.log.slice(0, frame)).toEqual(direct.log);
  expect(peers[1].match.log.slice(0, frame)).toEqual(direct.log);
}, 30000);
