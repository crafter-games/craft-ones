// Fast save and restore of a live match for rollback netplay: the Battle copies its own state, and the port's
// per-step state (aim, charge, camera, effects) is plain data. Unlike save/restore in match.ts, which replays
// the input log from frame 0, this costs the same at minute one and minute ten. JSON copies make it web-only.
import type { BattleSnapshot } from "../../packages/shared/src";
import type { Match } from "./match";

export interface MatchSnapshot {
  battle: BattleSnapshot;
  // The fields of Match other than battle, options and seed, deep-copied.
  rest: string;
  logLength: number;
  rematches: number;
}

const copied = (match: Match): object => ({
  frame: match.frame,
  elapsed: match.elapsed,
  angle: match.angle,
  charge: match.charge,
  previous: match.previous,
  sequence: match.sequence,
  movedAt: match.movedAt,
  kickoff: match.kickoff,
  notice: match.notice,
  noticeUntil: match.noticeUntil,
  camera: match.camera,
  fx: match.fx,
});

export function snapshotMatch(match: Match): MatchSnapshot {
  return {
    battle: match.battle.snapshot(),
    // -Infinity (movedAt before the first move) does not survive JSON.
    rest: JSON.stringify(copied(match), (_k, v) =>
      v === Number.NEGATIVE_INFINITY ? "-Infinity" : v,
    ),
    logLength: match.log.length,
    rematches: match.rematches,
  };
}

export function restoreMatch(match: Match, snap: MatchSnapshot): void {
  match.battle.restore(snap.battle);
  const rest = JSON.parse(snap.rest, (_k, v) =>
    v === "-Infinity" ? Number.NEGATIVE_INFINITY : v,
  ) as ReturnType<typeof copied> & Match;
  match.frame = rest.frame;
  match.elapsed = rest.elapsed;
  match.angle = rest.angle;
  match.charge = rest.charge;
  match.previous = rest.previous;
  match.sequence = rest.sequence;
  match.movedAt = rest.movedAt;
  match.kickoff = rest.kickoff;
  match.notice = rest.notice;
  match.noticeUntil = rest.noticeUntil;
  match.camera = rest.camera;
  match.fx = rest.fx;
  match.log.length = snap.logLength;
  match.rematches = snap.rematches;
}
