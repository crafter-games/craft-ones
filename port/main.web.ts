// Craft Ones on the web: setup screen, then a local hot-seat match where one keyboard drives whichever seat
// has the turn, like /playground. ?online opens a room and shows its link; ?room=<code> joins it, and the two
// browsers play over the relay with rollback netplay (the host picks the match). ?map=coast&species=puma&coat=sage&species2=zorro&coat2=slate skips setup;
// &infiniteHp=1 and &destructible=0 are the lab toggles.
import { createDraw2D } from "dotframe/src/draw2d";
import type { Frame } from "dotframe/src/gpu";
import { Key } from "dotframe/src/input";
import type { Platform } from "dotframe/src/platform";
import { loadBytes, run } from "dotframe/src/web/run";
import {
  type BattleView,
  COATS,
  type CoatId,
  type PlayableMapId,
  SPECIES,
  type Species,
} from "../packages/shared/src";
import { loadSpeakers, type Speakers } from "./src/audio";
import { createControls } from "./src/controls";
import { isDiscordActivity, showMessage, startDiscord } from "./src/discord";
import {
  Bit,
  checksum,
  createMatch,
  DEFAULT_OPTIONS,
  type Match,
  type MatchOptions,
  power01,
  ROLLBACK_WINDOW,
  seatOf,
  step,
  view,
  WINDOW,
} from "./src/match";
import { createRollback, type Rollback } from "./src/netplay";
import { connectOnline, type OnlineLink } from "./src/online";
import {
  createRenderer,
  drawBanner,
  drawNetStats,
  loadArt,
  loadCritter,
} from "./src/render";
import { createSetup, press, renderSetup, type SetupKey } from "./src/setup";
import { restoreMatch, snapshotMatch } from "./src/snapshot";

const STEP = 1 / 60;
const params = new URLSearchParams(location.search);
const direct = params.has("map") || params.has("species");
const fromUrl: MatchOptions = {
  ...DEFAULT_OPTIONS,
  // Lab toggles from the web /playground?lab drawer.
  infiniteHp: params.get("infiniteHp") === "1",
  destructible: params.get("destructible") !== "0",
  map: (params.get("map") ?? DEFAULT_OPTIONS.map) as PlayableMapId,
  one: {
    species: (params.get("species") ?? DEFAULT_OPTIONS.one.species) as Species,
    coat: (params.get("coat") ?? DEFAULT_OPTIONS.one.coat) as CoatId,
  },
  two: {
    species: (params.get("species2") ?? DEFAULT_OPTIONS.two.species) as Species,
    coat: (params.get("coat2") ?? DEFAULT_OPTIONS.two.coat) as CoatId,
  },
};
// Online: ?online creates a room, ?room=<code> joins one. ?relay= overrides the relay.
const INPUT_DELAY = 10;
// In Discord the room is the Activity instance.
const discord = isDiscordActivity();
let room = params.get("room");
if (discord) {
  try {
    room = await startDiscord();
  } catch (error) {
    showMessage(
      error instanceof Error ? error.message : "Discord failed to start.",
    );
    throw error;
  }
} else if (params.has("online") && !room) {
  room = Math.random().toString(36).slice(2, 8);
  params.set("room", room);
  params.delete("online");
  history.replaceState(null, "", `${location.pathname}?${params}`);
}
// The relay sits next to the game at /relay (on the VPS, and through Discord's /relay URL mapping).
const local =
  location.hostname === "localhost" || location.hostname === "127.0.0.1";
const relay =
  params.get("relay") ??
  (local ? "ws://localhost:8787" : `wss://${location.host}/relay`);
let link: OnlineLink | null = room ? connectOnline(relay, room) : null;
const SETUP_KEYS: [SetupKey, number[]][] = [
  ["up", [Key.Up, Key.W]],
  ["down", [Key.Down, Key.S]],
  ["left", [Key.Left, Key.A]],
  ["right", [Key.Right, Key.D]],
  ["confirm", [Key.Enter, Key.Space, Key.F]],
];

await run(WINDOW, ({ gpu, input, audio }: Platform): Frame => {
  const draw = createDraw2D(gpu, WINDOW.width, WINDOW.height);
  const renderer = createRenderer(gpu, WINDOW);
  const setup = createSetup(fromUrl);
  let match: Match | null = direct
    ? createMatch(Math.floor(Math.random() * 0x1_0000_0000), fromUrl)
    : null;
  let speakers: Speakers | null = null;
  let heard: BattleView | null = null;
  let ready = false;
  // Every critter loads up front (about 4 MB) so the setup screen can preview any pick.
  Promise.all([
    loadArt(gpu, draw, loadBytes, "."),
    ...SPECIES.flatMap((species) =>
      Object.keys(COATS).map((coat) =>
        loadCritter(gpu, loadBytes, ".", species, coat),
      ),
    ),
  ]).then((): void => {
    ready = true;
  });
  loadSpeakers(audio, loadBytes, ".").then((s: Speakers): void => {
    speakers = s;
  });
  const held = new Set<number>();
  // Edge-triggered keys for the setup screen, which is not part of the simulation.
  const tapped = (keys: number[]): boolean => {
    const down = keys.some((k) => input.down(k));
    const was = keys.some((k) => held.has(k));
    for (const k of keys)
      if (input.down(k)) held.add(k);
      else held.delete(k);
    return down && !was;
  };
  const controls = createControls(input, WINDOW.width, WINDOW.height);
  let simulated = -1;
  // Online host: the options picked in setup, sent once the guest arrives.
  let pending: MatchOptions | null = null;
  let rollback: Rollback | null = null;
  const startOnline = (seed: number, options: MatchOptions): void => {
    if (!link) return;
    const m = createMatch(seed, options);
    match = m;
    rollback = createRollback({
      game: {
        step: (inputs: number[]): void => step(m, inputs),
        save: () => snapshotMatch(m),
        restore: (snap) => restoreMatch(m, snap),
        checksum: (): number => checksum(m),
      },
      transport: link.transport,
      localSeat: link.slot(),
      inputDelay: INPUT_DELAY,
      maxRollback: ROLLBACK_WINDOW,
    });
  };
  const share = (): string =>
    `${location.origin}${location.pathname}?room=${link?.room ?? ""}`;
  return (time: number): boolean => {
    draw.begin();
    if (!ready) {
      draw.setFillStyle("#2b2330");
      draw.fillRect(0, 0, WINDOW.width, WINDOW.height);
      draw.end({ r: 0, g: 0, b: 0 });
      return true;
    }
    const W = WINDOW.width;
    const H = WINDOW.height;
    if (link && !rollback) {
      // Guest: wait for the host's match. Host: pick in setup, then wait for the guest and send it.
      const status = link.status();
      const start = link.start();
      if (link.slot() === 1 && start) startOnline(start.seed, start.options);
      else if (
        link.slot() === 1 ||
        status === "connecting" ||
        status === "closed"
      ) {
        drawBanner(
          draw,
          W,
          H,
          status === "closed" ? "Relay closed" : "Online",
          [
            status === "connecting"
              ? "Connecting to the relay..."
              : status === "closed"
                ? "Reload to try again"
                : "Waiting for the host to start the match",
            `Room ${link.room}`,
          ],
        );
        draw.end({ r: 0, g: 0, b: 0 });
        return true;
      } else if (pending && status === "paired") {
        const seed = Math.floor(Math.random() * 0x1_0000_0000);
        link.sendStart({ t: "start", seed, options: pending });
        startOnline(seed, pending);
      } else if (pending && tapped([Key.Escape])) {
        // Nobody came: play hot-seat on this screen instead.
        link.close();
        link = null;
        match = createMatch(Math.floor(Math.random() * 0x1_0000_0000), pending);
        pending = null;
      } else if (pending) {
        drawBanner(draw, W, H, "Waiting for a rival", [
          discord
            ? "Ask a friend to join this Activity"
            : "Send this link to the other player:",
          discord ? `Instance ${link.room}` : share(),
          "Esc plays hot-seat on this screen",
        ]);
        draw.end({ r: 0, g: 0, b: 0 });
        return true;
      }
    }
    if (!match) {
      for (const [key, keys] of SETUP_KEYS)
        if (tapped(keys)) {
          const options = press(setup, key);
          if (options && link) pending = options;
          else if (options)
            match = createMatch(
              Math.floor(Math.random() * 0x1_0000_0000),
              options,
            );
        }
      renderSetup(setup, draw, WINDOW.width, WINDOW.height);
      draw.end({ r: 0, g: 0, b: 0 });
      simulated = -1;
      return true;
    }
    // Escape from a finished match goes back to setup (local play only; online, R asks for a rematch).
    if (
      !link &&
      tapped([Key.Escape]) &&
      match.battle.state.phase === "finished"
    ) {
      match = null;
      heard = null;
      draw.end({ r: 0, g: 0, b: 0 });
      return true;
    }
    if (simulated < 0) simulated = time;
    for (let n = 0; simulated + STEP <= time && n < 5; n++) {
      const bits = controls.bits(match);
      const seat = seatOf(match);
      const listener = match.battle.state.currentPlayer;
      if (rollback) rollback.tick(bits);
      else {
        const inputs = [0, 0];
        if (seat >= 0) inputs[seat] = bits;
        // R and M work for both seats; the rest only for the seat with the turn.
        inputs[1 - Math.max(0, seat)] |= bits & (Bit.Restart | Bit.Map);
        step(match, inputs);
      }
      const now = view(match);
      speakers?.hear(heard, now, listener);
      speakers?.charge(
        seat >= 0 ? power01(match.charge[seat]) : 0,
        match.frame,
      );
      heard = now;
      simulated += STEP;
    }
    if (simulated < time - STEP * 5) simulated = time;
    renderer.render(match, draw, controls.touched(), controls.preview());
    if (link && rollback) {
      const stats = rollback.stats();
      if (link.status() !== "paired")
        drawBanner(draw, W, H, "Rival left", ["The other player disconnected"]);
      else if (stats.desync >= 0)
        drawBanner(draw, W, H, "Desync", [
          `Frame ${stats.desync}: reload both pages`,
        ]);
      drawNetStats(
        draw,
        W,
        H,
        `you are P${link.slot() + 1} · ping ${Math.round((stats.rtt * 1000) / 60)} ms · rollbacks ${stats.rollbacks}`,
      );
    }
    draw.end({ r: 0, g: 0, b: 0 });
    return true;
  };
});
