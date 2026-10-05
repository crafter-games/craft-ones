// The whole game loop after loading, shared by the web, Discord and iOS entries: setup, local hot-seat, and online
// play over the relay with rollback. Each entry supplies the platform bits (how to reach the relay, share a link,
// and name the room).
import type { Draw2D } from "dotframe/src/draw2d";
import { type Input, Key } from "dotframe/src/input";
import { createRollback, type Rollback } from "dotframe/src/netplay";
import type { Probe } from "dotframe/src/probe";
import type { BattleView } from "../../packages/shared/src";
import type { Speakers } from "./audio";
import { createControls } from "./controls";
import {
  Bit,
  checksum,
  createMatch,
  type Match,
  type MatchOptions,
  power01,
  ROLLBACK_WINDOW,
  seatOf,
  step,
  view,
  WINDOW,
} from "./match";
import type { OnlineLink } from "./online";
import { drawBanner, drawNetStats } from "./render";
import { createSetup, renderSetup } from "./setup";
import { createSetupInput } from "./setupInput";
import { restoreMatch, snapshotMatch } from "./snapshot";

const STEP = 1 / 60;
const INPUT_DELAY = 10;

export interface SessionOptions {
  input: Input;
  draw: Draw2D;
  render: (
    match: Match,
    draw: Draw2D,
    touched: boolean,
    preview: number,
  ) => void;
  speakers: () => Speakers | null;
  // Whether PLAY ONLINE is offered, and how to open a room. Plain functions, never null: scriptc compiles a
  // nullable function only with its dynamic engine.
  online: boolean;
  connect: (room: string) => OnlineLink;
  // A fresh room code; web entries also put it in the address bar.
  newRoom: () => string;
  // What the waiting banner shows and shares for a room.
  invite: (room: string) => string;
  // Shares the invite: "shared", "copied" or "failed".
  share: (text: string, touching: boolean) => string;
  // Labels for embedded hosts (Discord names an instance, not a link).
  embedded: boolean;
  setupOptions: MatchOptions;
  // A link already open (a ?room= URL or a Discord instance), and whether this peer hosts with these options at once.
  link: OnlineLink | null;
  autoHost: MatchOptions | null;
  // Starts straight into a local match (web ?map= links).
  direct: MatchOptions | null;
  // Scripted input and progress probe for dotframe play --online.
  mashing: boolean;
  masher: () => number;
  probe: Probe | null;
  // Called before a match starts, so native builds can load the two critters it needs.
  prepare: (options: MatchOptions) => void;
}

export function createSession(o: SessionOptions): (time: number) => boolean {
  const draw = o.draw;
  const input = o.input;
  const setup = createSetup(o.setupOptions, o.online && !o.embedded);
  const setupInput = createSetupInput(input);
  const controls = createControls(input, WINDOW.width, WINDOW.height);
  let link = o.link;
  let pending = o.autoHost;
  let match: Match | null = null;
  let rollback: Rollback | null = null;
  let heard: BattleView | null = null;
  let simulated = -1;
  let shared = "";
  let bannerDown = false;
  const begin = (options: MatchOptions, seed: number): Match => {
    o.prepare(options);
    const m = createMatch(seed, options);
    match = m;
    return m;
  };
  if (o.direct) begin(o.direct, Math.floor(Math.random() * 0x1_0000_0000));
  const startOnline = (
    l: OnlineLink,
    seed: number,
    options: MatchOptions,
  ): void => {
    const m = begin(options, seed);
    rollback = createRollback({
      sim: {
        step: (inputs: number[]): void => step(m, inputs),
        save: () => snapshotMatch(m),
        restore: (snap) => restoreMatch(m, snap),
        checksum: (): number => checksum(m),
      },
      transport: l.relay.transport,
      localPort: l.relay.slot(),
      neutral: 0,
      inputDelay: INPUT_DELAY,
      maxRollback: ROLLBACK_WINDOW,
    });
  };
  const finish = (): boolean => {
    draw.end({ r: 0, g: 0, b: 0 });
    return true;
  };

  return (time: number): boolean => {
    draw.begin();
    const W = WINDOW.width;
    const H = WINDOW.height;
    if (link && !rollback) {
      // Guest: wait for the host's match. Host: pick in setup, then wait for the guest and send it.
      const l = link;
      const status = l.relay.status();
      const slot = l.relay.slot();
      const start = l.start();
      if (slot === 1 && start) startOnline(l, start.seed, start.options);
      else if (slot === 1 || status === "connecting" || status === "closed") {
        drawBanner(
          draw,
          W,
          H,
          status === "closed" ? "Relay closed" : "Online",
          [
            status === "connecting"
              ? "Connecting to the relay..."
              : status === "closed"
                ? "Go back and try again"
                : "Waiting for the host to start the match",
            `Room ${l.room}`,
          ],
        );
        return finish();
      } else if (pending && status === "paired") {
        const seed = Math.floor(Math.random() * 0x1_0000_0000);
        l.relay.send({ t: "start", seed, options: pending });
        startOnline(l, seed, pending);
      } else if (pending && setupInput.tapped([Key.Escape])) {
        // Nobody came: play hot-seat on this screen instead.
        l.relay.close();
        link = null;
        begin(pending, Math.floor(Math.random() * 0x1_0000_0000));
        pending = null;
      } else if (pending) {
        // A tap shares the invite: the share sheet on phones, the clipboard elsewhere.
        const touching = input.touches().length > 0;
        const down = touching || (input.pointer().buttons & 1) !== 0;
        if (down && !bannerDown && !o.embedded)
          shared = o.share(o.invite(l.room), touching);
        bannerDown = down;
        drawBanner(draw, W, H, "Waiting for a rival", [
          o.embedded
            ? "Ask a friend to join this Activity"
            : "Send this link to the other player:",
          o.invite(l.room),
          o.embedded
            ? "Esc plays hot-seat on this screen"
            : shared === "copied"
              ? "Link copied"
              : shared === "shared"
                ? "Link shared"
                : "Tap to share the link · Esc plays hot-seat",
        ]);
        return finish();
      }
    }
    if (!match) {
      controls.disarm();
      const choice = setupInput.poll(setup, W, H);
      if (choice && (link || choice.mode === "online") && o.online) {
        // PLAY ONLINE: open a room and show its invite.
        if (!link) {
          link = o.connect(o.newRoom());
          shared = "";
        }
        pending = choice.options;
      } else if (choice)
        begin(choice.options, Math.floor(Math.random() * 0x1_0000_0000));
      renderSetup(setup, draw, W, H);
      simulated = -1;
      return finish();
    }
    const m: Match = match;
    // Escape or MENU on a finished match goes back to setup (local play only; online, rematches only).
    if (
      !link &&
      m.battle.state.phase === "finished" &&
      (setupInput.tapped([Key.Escape]) || controls.menu())
    ) {
      match = null;
      heard = null;
      return finish();
    }
    if (simulated < 0) simulated = time;
    const speakers = o.speakers();
    for (let n = 0; simulated + STEP <= time && n < 5; n++) {
      const bits = o.mashing ? o.masher() : controls.bits(m);
      const seat = seatOf(m);
      const listener = m.battle.state.currentPlayer;
      if (rollback) rollback.tick(bits);
      else {
        const inputs = [0, 0];
        if (seat >= 0) inputs[seat] = bits;
        // R and M work for both seats; the rest only for the seat with the turn.
        inputs[1 - Math.max(0, seat)] |= bits & (Bit.Restart | Bit.Map);
        step(m, inputs);
      }
      const now = view(m);
      if (speakers) {
        speakers.hear(heard, now, listener);
        speakers.charge(seat >= 0 ? power01(m.charge[seat]) : 0, m.frame);
      }
      heard = now;
      simulated += STEP;
    }
    if (simulated < time - STEP * 5) simulated = time;
    o.render(m, draw, controls.touched(), controls.preview());
    const r = rollback;
    if (link && r) {
      const stats = r.stats();
      const status = link.relay.status();
      if (o.probe) o.probe.update(r, status);
      if (status !== "paired")
        drawBanner(draw, W, H, "Rival left", ["The other player disconnected"]);
      else if (stats.desync >= 0)
        drawBanner(draw, W, H, "Desync", [
          `Frame ${stats.desync}: restart both games`,
        ]);
      drawNetStats(
        draw,
        W,
        H,
        `you are P${link.relay.slot() + 1} · ping ${Math.round((stats.rtt * 1000) / 60)} ms · rollbacks ${stats.rollbacks}`,
      );
    }
    return finish();
  };
}
