// Craft Ones on the web: setup screen, then a local hot-seat match where one keyboard drives whichever seat
// has the turn, like /playground. ?online opens a room and shows its link; ?room=<code> joins it, and the two
// browsers play over the relay with rollback netplay (the host picks the match). ?map=coast&species=puma&coat=sage&species2=zorro&coat2=slate skips setup;
// &infiniteHp=1 and &destructible=0 are the lab toggles.
import { createDraw2D } from "dotframe/src/draw2d";
import type { Frame } from "dotframe/src/gpu";
import type { Platform } from "dotframe/src/platform";
import { createMasher, createProbe } from "dotframe/src/probe";
import { publishProbe } from "dotframe/src/probe-web";
import { connectRelay } from "dotframe/src/relay-client";
import { loadBytes, run } from "dotframe/src/web/run";
import {
  COATS,
  type CoatId,
  type PlayableMapId,
  SPECIES,
  type Species,
} from "../packages/shared/src";
import { loadSpeakers, type Speakers } from "./src/audio";
import { isDiscordActivity, showMessage, startDiscord } from "./src/discord";
import {
  DEFAULT_OPTIONS,
  fitAspect,
  type MatchOptions,
  randomInput,
  WINDOW,
} from "./src/match";
import { type OnlineLink, roomKey, wrapLink } from "./src/online";
import { createRenderer, loadArt, loadCritter } from "./src/render";
import { createSession } from "./src/session";

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
const connect = (code: string): OnlineLink =>
  wrapLink(connectRelay(relay, roomKey(code)), code);
const link: OnlineLink | null = room ? connect(room) : null;
// Fill the window: the logical view takes the screen's aspect (kept between 5:4 and 2.4:1), and CSS scales the
// canvas to the largest size that fits.
fitAspect(Math.min(2.4, Math.max(1.25, innerWidth / Math.max(innerHeight, 1))));
document.documentElement.style.setProperty(
  "--aspect",
  String(WINDOW.width / WINDOW.height),
);

await run(WINDOW, ({ gpu, input, audio }: Platform): Frame => {
  const draw = createDraw2D(gpu, WINDOW.width, WINDOW.height);
  const renderer = createRenderer(gpu, WINDOW);
  let speakers: Speakers | null = null;
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
  // ?mash=<seed> (dotframe play --online): skip setup and mash random input, and publish progress for the CLI.
  const mashSeed = params.get("mash");
  const probe = createProbe();
  publishProbe(probe.state);
  const session = createSession({
    input,
    draw,
    render: renderer.render,
    speakers: () => speakers,
    online: true,
    connect,
    newRoom: (): string => {
      const code = Math.random().toString(36).slice(2, 8);
      params.set("room", code);
      history.replaceState(null, "", `${location.pathname}?${params}`);
      return code;
    },
    invite: (code: string): string =>
      discord
        ? `Instance ${code}`
        : `${location.origin}${location.pathname}?room=${code}`,
    share: (text: string, touching: boolean): string => {
      const nav = navigator as Navigator & {
        share?: (data: { url: string }) => Promise<void>;
      };
      if (touching && nav.share) {
        nav.share({ url: text }).catch(() => undefined);
        return "shared";
      }
      navigator.clipboard?.writeText(text).catch(() => undefined);
      return "copied";
    },
    embedded: discord,
    setupOptions: fromUrl,
    link,
    autoHost: mashSeed !== null && link ? fromUrl : null,
    direct: direct ? fromUrl : null,
    mashing: mashSeed !== null,
    masher: createMasher(Number(mashSeed ?? 0), randomInput),
    probe,
    prepare: (): void => undefined,
  });
  return (time: number): boolean => {
    if (ready) return session(time);
    draw.begin();
    draw.setFillStyle("#2b2330");
    draw.fillRect(0, 0, WINDOW.width, WINDOW.height);
    draw.end({ r: 0, g: 0, b: 0 });
    return true;
  };
});
