// The whole game loop after loading, shared by the web, Discord and iOS entries: setup, local hot-seat, and online
// play over the relay with rollback. Each entry supplies the platform bits (how to reach the relay, share a link,
// and name the room).
import type { Draw2D } from "dotframe/src/draw2d";
import { type Input, Key } from "dotframe/src/input";
import type { Probe } from "dotframe/src/probe";
import type { BattleView, PlayerOptions } from "../../packages/shared/src";
import type { Speakers } from "./audio";
import { createControls } from "./controls";
import { avatarPath, displayName, type People, plates } from "./identity";
import {
  Bit,
  checksum,
  createMatch,
  type Match,
  type MatchOptions,
  mapPicker,
  pickBits,
  pickOf,
  power01,
  ROLLBACK_WINDOW,
  seatOf,
  step,
  view,
  WINDOW,
} from "./match";
import { createRollback, NOBODY, type Rollback } from "./netplay";
import type { OnlineLink } from "./online";
import { drawBanner, drawNetStats } from "./render";
import { createSetup, press, renderSetup, type Setup } from "./setup";
import { createSetupInput } from "./setupInput";
import { restoreMatch, snapshotMatch } from "./snapshot";

const STEP = 1 / 60;
// Rollback only has to cover one-way latency plus jitter: a Discord link at 526 ms of ping hit 20 frames, so the
// window is a second (ROLLBACK_WINDOW) and the player with the turn sees their own input after 2 frames.
const INPUT_DELAY = 2;

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
  // Discord only: who the signed-in player is and what Discord says about any user id; and the avatar loader, which
  // gets the avatar's path on the Discord CDN for a seat ("" clears it). Names and avatars are drawn, never simulated.
  people: People | null;
  avatar: (seat: number, path: string) => void;
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
  // Smoothed display frame time in ms (time is in seconds), shown next to the netplay stats to tell a slow renderer from a slow link.
  let lastTime = -1;
  let frameMs = 0;
  let mapHeld = 0;
  // The guest's own critter screen (online), and whether its pick went out.
  let guest: Setup | null = null;
  let guestPick: PlayerOptions | null = null;
  let guestSentAt = -1;
  // The rematch screen after a finished match: the same screen as setup, with this player's rows (and the map, for
  // the loser) editable. `ready` latches once this player confirmed.
  let rematch: Setup | null = null;
  let rematchArmed = false;
  let rematchReady = false;
  let seenRematches = 0;
  let whoSentAt = -1;
  const begin = (options: MatchOptions, seed: number): Match => {
    o.prepare(options);
    const m = createMatch(seed, options);
    match = m;
    seenRematches = 0;
    rematch = null;
    rematchReady = false;
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
      clock: () => performance.now(),
      // The seat with the turn owns the input, so it aims and shoots with no wait on any ping and the rival
      // watches the shot arrive. The kickoff uses no input; a finished match needs both (either seat rematches).
      owner: (): number =>
        m.kickoff > 0
          ? NOBODY
          : m.battle.state.phase === "finished"
            ? -1
            : seatOf(m),
    });
  };
  // Name plates for the two seats from Discord, once both players are in and have said who they are. Never part of
  // the match: the sim, the inputs and the checksum do not see them.
  const syncPlates = (time: number): void => {
    const people = o.people;
    const slot = link ? link.relay.slot() : -1;
    if (!people || !link || !rollback || slot < 0) {
      for (let seat = 0; seat < 2; seat++)
        if (plates[seat].id !== "") {
          plates[seat] = { id: "", name: "" };
          o.avatar(seat, "");
        }
      return;
    }
    const me = people.me();
    if (
      me !== "" &&
      link.relay.status() === "paired" &&
      time - whoSentAt >= 1
    ) {
      link.relay.send({ t: "who", id: me });
      whoSentAt = time;
    }
    const seats = [me, link.who()];
    for (let n = 0; n < 2; n++) {
      const seat = n === 0 ? slot : 1 - slot;
      const id = seats[n];
      if (plates[seat].id === id) continue;
      const person = id === "" ? null : people.find(id);
      if (id !== "" && !person) continue;
      plates[seat] = { id, name: person ? displayName(person) : "" };
      o.avatar(seat, person ? avatarPath(person) : "");
    }
  };
  const openRematch = (m: Match): void => {
    const s = createSetup(m.lineup, false);
    const picker = mapPicker(m);
    s.title = "REMATCH";
    s.startLabel = "READY";
    s.waiting = "";
    if (rollback && link) {
      const mine = link.relay.slot();
      s.editOne = mine === 0;
      s.editTwo = mine === 1;
      s.editMap = picker === mine;
      s.tags = [mine === 0 ? "YOU" : "RIVAL", mine === 1 ? "YOU" : "RIVAL"];
      s.subtitle =
        picker === mine
          ? "You lost: pick the next map"
          : "Your rival lost: they pick the next map";
    } else s.subtitle = `Player ${picker + 1} lost and picks the next map`;
    rematch = s;
    rematchArmed = false;
    rematchReady = false;
  };
  // This frame's input word per seat once the match is over: nothing until a rematch screen is open, then each
  // seat's pick (map, critter, coat), plus Restart once its player confirmed.
  const rematchWords = (m: Match, polled: number): number[] => {
    const words = [0, 0];
    const s = rematch;
    if (!s) {
      if (polled & Bit.Restart) openRematch(m);
      return words;
    }
    const mine = rollback && link ? link.relay.slot() : -1;
    if (!rematchArmed) {
      // The click that opened the screen is still down; ignore the pointer until it lifts.
      const p = input.pointer();
      rematchArmed = input.touches().length === 0 && (p.buttons & 1) === 0;
    }
    if (mine >= 0) {
      // The rival's choices show up live on their seat's rows.
      const rival = pickOf(m.picks[1 - mine]);
      if (rival) {
        const seat = mine === 0 ? s.options.two : s.options.one;
        seat.species = rival.species;
        seat.coat = rival.coat;
        if (mapPicker(m) !== mine) s.options.map = rival.map;
      }
    }
    if (!rematchReady && rematchArmed) {
      const choice = setupInput.poll(s, WINDOW.width, WINDOW.height);
      if (choice) {
        rematchReady = true;
        if (mine >= 0) s.waiting = "Waiting for your rival...";
        o.prepare(s.options);
      }
    }
    const word = (seat: number): number => {
      const pick = seat === 0 ? s.options.one : s.options.two;
      return (
        pickBits({
          map: s.options.map,
          species: pick.species,
          coat: pick.coat,
        }) | (rematchReady ? Bit.Restart : 0)
      );
    };
    if (mine >= 0) words[mine] = word(mine);
    else {
      words[0] = word(0);
      words[1] = word(1);
    }
    return words;
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
      const rival = l.pick();
      if (slot === 1 && start) startOnline(l, start.seed, start.options);
      else if (slot === 1 && status === "paired") {
        // Guest: pick this seat's critter, send it to the host, wait for the host's match.
        if (!guestPick && o.mashing) guestPick = o.setupOptions.two;
        if (!guestPick) {
          if (!guest) {
            const g = createSetup(o.setupOptions, false);
            g.editMap = false;
            g.editOne = false;
            g.title = "PICK YOUR CRITTER";
            g.subtitle = "The host picks the map";
            g.startLabel = "READY";
            g.tags = ["HOST", "YOU"];
            // Land on the first row this player can change.
            press(g, "down");
            guest = g;
          }
          const choice = setupInput.poll(guest, W, H);
          if (choice) {
            guestPick = choice.options.two;
            guest.waiting = "Waiting for the host to start...";
            o.prepare(choice.options);
          }
          renderSetup(guest, draw, W, H);
        } else if (guest) renderSetup(guest, draw, W, H);
        else
          drawBanner(draw, W, H, "Online", [
            "Waiting for the host to start the match",
            `Room ${l.room}`,
          ]);
        // Until the host answers with the match, say it again: the first message can reach an empty room.
        if (guestPick && time - guestSentAt >= 1) {
          l.relay.send({
            t: "pick",
            species: guestPick.species,
            coat: guestPick.coat,
          });
          guestSentAt = time;
        }
        return finish();
      } else if (slot === 1 || status === "connecting" || status === "closed") {
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
      } else if (pending && status === "paired" && rival) {
        // The host decides the match: its own critter and the map, the guest's critter as the guest picked it.
        const seed = Math.floor(Math.random() * 0x1_0000_0000);
        const options: MatchOptions = { ...pending, two: rival };
        l.relay.send({ t: "start", seed, options });
        startOnline(l, seed, options);
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
        if (down && !bannerDown && !o.embedded && status !== "paired")
          shared = o.share(o.invite(l.room), touching);
        bannerDown = down;
        drawBanner(
          draw,
          W,
          H,
          status === "paired" ? "Your rival is picking" : "Waiting for a rival",
          status === "paired"
            ? [
                "The match starts when they pick their critter",
                "Esc plays hot-seat on this screen",
              ]
            : [
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
              ],
        );
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
    const over = m.battle.state.phase === "finished";
    if (rematch && !over) {
      rematch = null;
      rematchReady = false;
    }
    if (over) {
      // Escape closes the rematch screen; without it, Escape or MENU goes back to setup (local play only; online,
      // rematches only).
      const esc = setupInput.tapped([Key.Escape]);
      if (rematch) {
        if (esc && !rematchReady) rematch = null;
      } else if (!link && (esc || controls.menu())) {
        match = null;
        heard = null;
        return finish();
      }
    }
    if (m.rematches !== seenRematches) {
      seenRematches = m.rematches;
      o.prepare(m.lineup);
    }
    syncPlates(time);
    if (simulated < 0) simulated = time;
    if (lastTime >= 0) frameMs = frameMs * 0.9 + (time - lastTime) * 100;
    lastTime = time;
    // Behind the peer (a hitch, a throttled tab): one extra step this display frame to catch up, or the peer
    // stalls waiting for us every frame from then on.
    if (rollback && rollback.stats().ahead < -1) simulated -= STEP;
    const speakers = o.speakers();
    // Once the match is over the players' input is their rematch picks, not aim and buttons.
    const lobby =
      over && !o.mashing ? rematchWords(m, controls.bits(m)) : [0, 0];
    for (let n = 0; simulated + STEP <= time && n < 5; n++) {
      const bits = o.mashing ? o.masher() : over ? 0 : controls.bits(m);
      const seat = seatOf(m);
      const listener = m.battle.state.currentPlayer;
      if (rollback) {
        // Online the overview is each player's own view: toggled here, outside the step, which ignores the input
        // of the seat without the turn. Restores keep it (snapshot.ts).
        if (bits & ~mapHeld & Bit.Map) m.camera.map = !m.camera.map;
        mapHeld = bits & Bit.Map;
        rollback.tick(
          over && !o.mashing
            ? lobby[link ? link.relay.slot() : 0]
            : bits & ~Bit.Map,
        );
      } else if (over && !o.mashing) step(m, lobby);
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
    if (rematch) renderSetup(rematch, draw, W, H);
    const r = rollback;
    if (link && r) {
      const stats = r.stats();
      const status = link.relay.status();
      if (o.probe) o.probe.update(r, status);
      if (status === "connecting")
        drawBanner(draw, W, H, "Reconnecting", [
          "The match resumes where it was",
        ]);
      else if (status !== "paired")
        drawBanner(draw, W, H, "Rival left", ["The other player disconnected"]);
      else if (stats.desync >= 0)
        drawBanner(draw, W, H, "Desync", [
          `Frame ${stats.desync}: restart both games`,
        ]);
      drawNetStats(
        draw,
        W,
        H,
        `you are P${link.relay.slot() + 1} · ping ${Math.round((stats.rtt * 1000) / 60)} ms · rollbacks ${stats.rollbacks} (max ${stats.longestRollback}) · stalls ${stats.stalls} · ahead ${stats.ahead.toFixed(1)} · tick ${stats.tickMs.toFixed(1)} ms · frame ${frameMs.toFixed(1)} ms`,
      );
    }
    return finish();
  };
}
