// Replays of the matches played since the page (or app) opened. The simulation is deterministic, so a replay is
// the match's seed, options and input log; watching one runs a fresh Match through those inputs. Kept in memory
// only: nothing is written to storage, and a reload starts the list empty.
import { createMatch, type Match, type MatchOptions, step } from "./match";

export interface Replay {
  seed: number;
  options: MatchOptions;
  // Every input since the Match was created; a rematch's replay replays the earlier battles silently first.
  log: number[][];
  // Index in the log where this battle starts.
  from: number;
}

export interface Viewer {
  index: number;
  match: Match;
  cursor: number;
  // Frames shown since the replayed battle finished.
  after: number;
}

const saved: Replay[] = [];

export function replayCount(): number {
  return saved.length;
}

// Saves the battle that started at log index `from`, or refreshes it: online, the last frames can still be
// rolled back when a match is first seen as finished.
export function recordReplay(match: Match, from: number): void {
  const replay: Replay = {
    seed: match.seed,
    options: match.options,
    log: match.log.map((f) => [f[0], f[1]]),
    from,
  };
  for (let i = 0; i < saved.length; i++)
    if (saved[i].seed === replay.seed && saved[i].from === from) {
      saved[i] = replay;
      return;
    }
  saved.push(replay);
}

// Opens a saved replay (0 is the oldest), already past the battles that came before it.
export function openReplay(index: number): Viewer {
  const replay = saved[index];
  const match = createMatch(replay.seed, replay.options);
  for (let i = 0; i < replay.from && i < replay.log.length; i++)
    step(match, replay.log[i]);
  return { index, match, cursor: replay.from, after: 0 };
}

export function advanceReplay(viewer: Viewer): void {
  const log = saved[viewer.index].log;
  if (
    viewer.match.battle.state.phase === "finished" ||
    viewer.cursor >= log.length
  ) {
    viewer.after += 1;
    return;
  }
  step(viewer.match, log[viewer.cursor]);
  viewer.cursor += 1;
}

export function replayEnded(viewer: Viewer): boolean {
  return viewer.after > 0;
}
