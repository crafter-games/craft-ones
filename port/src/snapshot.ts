// Fast save and restore of a live match for rollback netplay: the Battle copies its own state, and the port's
// per-step state (aim, charge, camera, effects) is copied field by field. Unlike save/restore in match.ts, which
// replays the input log from frame 0, this costs the same at minute one and minute ten. Plain copies, so it also
// compiles for native and iOS.
import type { BattleSnapshot } from "../../packages/shared/src";
import type { Camera } from "./camera";
import type { Effects } from "./effects";
import type { Match } from "./match";

export interface MatchSnapshot {
  battle: BattleSnapshot;
  frame: number;
  elapsed: number;
  angle: number[];
  charge: number[];
  previous: number[];
  sequence: number;
  movedAt: number;
  kickoff: number;
  notice: string;
  noticeUntil: number;
  camera: Camera;
  fx: Effects;
  logLength: number;
  rematches: number;
}

function copyCamera(c: Camera): Camera {
  return {
    x: c.x,
    y: c.y,
    zoom: c.zoom,
    turn: c.turn,
    intro: c.intro,
    map: c.map,
  };
}

function copyEffects(fx: Effects): Effects {
  const trail: { x: number; y: number }[] = [];
  for (const p of fx.trail) trail.push({ x: p.x, y: p.y });
  const bursts: Effects["bursts"] = [];
  for (const b of fx.bursts)
    bursts.push({
      x: b.x,
      y: b.y,
      radius: b.radius,
      kind: b.kind,
      frame: b.frame,
    });
  const popups: Effects["popups"] = [];
  for (const p of fx.popups)
    popups.push({ x: p.x, y: p.y, amount: p.amount, frame: p.frame });
  return {
    trail,
    bursts,
    popups,
    explosionId: fx.explosionId,
    hp: fx.hp.slice(),
  };
}

export function snapshotMatch(match: Match): MatchSnapshot {
  return {
    battle: match.battle.snapshot(),
    frame: match.frame,
    elapsed: match.elapsed,
    angle: match.angle.slice(),
    charge: match.charge.slice(),
    previous: match.previous.slice(),
    sequence: match.sequence,
    movedAt: match.movedAt,
    kickoff: match.kickoff,
    notice: match.notice,
    noticeUntil: match.noticeUntil,
    camera: copyCamera(match.camera),
    fx: copyEffects(match.fx),
    logLength: match.log.length,
    rematches: match.rematches,
  };
}

export function restoreMatch(match: Match, snap: MatchSnapshot): void {
  match.battle.restore(snap.battle);
  match.frame = snap.frame;
  match.elapsed = snap.elapsed;
  match.angle = snap.angle.slice();
  match.charge = snap.charge.slice();
  match.previous = snap.previous.slice();
  match.sequence = snap.sequence;
  match.movedAt = snap.movedAt;
  match.kickoff = snap.kickoff;
  match.notice = snap.notice;
  match.noticeUntil = snap.noticeUntil;
  match.camera = copyCamera(snap.camera);
  match.fx = copyEffects(snap.fx);
  match.log.length = snap.logLength;
  match.rematches = snap.rematches;
}
