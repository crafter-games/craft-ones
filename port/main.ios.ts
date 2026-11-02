// iOS entry (dotframe build ios), compiled with scriptc in library mode. The host calls init once with the bundle's
// game folder, then frame every display refresh. Loading is synchronous: library mode has no promises. Online play
// goes through the production relay with the native WebSocket client; invites are web links, so a phone and a
// browser can play each other.
import { createDraw2D } from "dotframe/src/draw2d";
import { openLibraryPlatform } from "dotframe/src/native/library";
import { connectRelayNative, shareText } from "dotframe/src/native/relay";
import { COATS, SELECTABLE_SPECIES } from "../packages/shared/src";
import { loadSpeakersSync, type Speakers } from "./src/audio";
import {
  DEFAULT_OPTIONS,
  fitAspect,
  type Match,
  type MatchOptions,
  WINDOW,
} from "./src/match";
import { type OnlineLink, roomKey, wrapLink } from "./src/online";
import {
  createRenderer,
  loadArtSync,
  loadCritterSync,
  loadPortraitSync,
} from "./src/render";
import { createSession } from "./src/session";

const RELAY = "wss://craft-ones.crafter.run/relay";
const SITE = "https://craft-ones.crafter.run/play/";
let session: ((time: number) => boolean) | null = null;

export function init(base: string): void {
  const platform = openLibraryPlatform(WINDOW);
  fitAspect(platform.width / Math.max(platform.height, 1));
  const draw = createDraw2D(platform.gpu, WINDOW.width, WINDOW.height);
  const read = (path: string): Uint8Array => platform.readFile(path);
  const image = (png: Uint8Array) => platform.image(png, true);
  loadArtSync(draw, read, image, base, `${base}/dotframe/assets/fonts`, []);
  // Portraits for setup; a critter's parts load when it plays.
  for (const species of SELECTABLE_SPECIES)
    for (const coat of Object.keys(COATS))
      loadPortraitSync(read, image, base, species, coat);
  const speakers: Speakers = loadSpeakersSync(
    platform.audio,
    read,
    platform.sound,
    base,
  );
  const renderer = createRenderer(platform.gpu, WINDOW);
  session = createSession({
    input: platform.input,
    draw,
    render: (m: Match, d, touched: boolean, preview: number): void =>
      renderer.render(m, d, touched, preview),
    speakers: (): Speakers | null => speakers,
    online: true,
    connect: (code: string): OnlineLink =>
      wrapLink(connectRelayNative(RELAY, roomKey(code)), code),
    newRoom: (): string => Math.random().toString(36).slice(2, 8),
    invite: (code: string): string => `${SITE}?room=${code}`,
    share: (text: string): string => {
      const result = shareText(text);
      return result === "sheet"
        ? "shared"
        : result === "clipboard"
          ? "copied"
          : "failed";
    },
    embedded: false,
    setupOptions: DEFAULT_OPTIONS,
    link: null,
    autoHost: null,
    direct: null,
    mashing: false,
    masher: (): number => 0,
    probe: null,
    prepare: (options: MatchOptions): void => {
      loadCritterSync(read, image, base, options.one.species, options.one.coat);
      loadCritterSync(read, image, base, options.two.species, options.two.coat);
    },
  });
}

// Returns false to ask the host to quit.
export function frame(time: number): boolean {
  return session ? session(time) : true;
}
