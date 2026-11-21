import { existsSync } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";

interface SfxSpec {
  prompt: string;
  duration: number;
  influence?: number;
  maxTrimSec?: number;
}

interface MusicSpec {
  prompt: string;
  lengthMs: number;
}

const SFX_SPECS: Record<string, SfxSpec> = {
  bounce: {
    prompt:
      "Crisp cartoon rubbery metallic grenade bounce boing on stone, short arcade game sound effect",
    duration: 0.5,
    maxTrimSec: 0.35,
  },
  stick: {
    prompt:
      "Sticky bomb squelchy suction thud sticking onto a rock wall, snappy video game sound effect",
    duration: 0.5,
    maxTrimSec: 0.35,
  },
  heal: {
    prompt:
      "Bright magical arcade healing chime sparkles ascending notes, joyful video game power-up sound",
    duration: 0.9,
  },
  shield: {
    prompt:
      "Energetic sci-fi bubble energy shield activation hum with bright shimmer, arcade game SFX",
    duration: 0.8,
  },
  leap: {
    prompt:
      "Springy cartoon high jump whoosh boing, upbeat platformer video game sound effect",
    duration: 0.6,
  },
  dash: {
    prompt:
      "Fast snappy anime arcade air dash wind whoosh zip, crisp video game movement SFX",
    duration: 0.5,
    maxTrimSec: 0.4,
  },
  bite: {
    prompt:
      "Quick playful fierce cartoon critter chomp jaws snapping shut with a brief whoosh, game SFX",
    duration: 0.6,
  },
  pounce: {
    prompt:
      "Agile cartoon wildcat pounce leap with energetic wind whoosh, arcade brawler SFX",
    duration: 0.6,
  },
  stomp: {
    prompt:
      "Heavy cartoon ground slam seismic stomp impact thud on earth, punchy arcade fighting game SFX",
    duration: 0.8,
  },
  claw: {
    prompt:
      "Sharp double claw swipe air slash, crisp arcade fighting game attack sound effect",
    duration: 0.5,
  },
  jump: {
    prompt:
      "Cute snappy retro-modern platformer critter hop jump pop, very short clean video game SFX",
    duration: 0.5,
    maxTrimSec: 0.28,
  },
  step: {
    prompt:
      "Tiny soft cartoon footstep tap on grass and dirt, very brief subtle video game step SFX",
    duration: 0.5,
    maxTrimSec: 0.16,
  },
  win: {
    prompt:
      "Upbeat victorious arcade video game fanfare jingle, bright brass and celebratory chimes, joyful",
    duration: 2.2,
  },
  lose: {
    prompt:
      "Playful cartoon video game defeat jingle, comical descending muted brass notes, lighthearted",
    duration: 2.0,
  },
  "turn-mine": {
    prompt:
      "Bright crisp upbeat two-note marimba and bell notification chime for player turn start, arcade UI SFX",
    duration: 0.6,
  },
  "turn-other": {
    prompt:
      "Soft mellow neutral wooden xylophone two-note chime for opponent turn, clean game UI SFX",
    duration: 0.6,
  },
  charge: {
    prompt:
      "Clean short electronic arcade power charge synth pulse tone, steady crisp game UI beep",
    duration: 0.5,
    maxTrimSec: 0.14,
  },
  "fire-rocket": {
    prompt:
      "Punchy cartoon bazooka rocket launcher firing whoosh and ignition pop, arcade artillery game SFX",
    duration: 0.7,
  },
  "fire-grenade": {
    prompt:
      "Crisp mechanical grenade launcher hollow thump pop launch, playful arcade artillery game SFX",
    duration: 0.6,
  },
  "fire-sticky": {
    prompt:
      "Pneumatic cartoon bloop launch of a sticky bomb, bouncy video game weapon SFX",
    duration: 0.6,
  },
  "fire-mortar": {
    prompt:
      "Deep heavy artillery mortar cannon thoomp boom launch, punchy cartoon war game SFX",
    duration: 0.8,
  },
  "fire-dynamite": {
    prompt:
      "Quick cartoon dynamite stick toss whoosh with brief fuse spark sizzle, arcade game SFX",
    duration: 0.6,
  },
  "fire-grapple": {
    prompt:
      "Crisp metallic grappling hook zip launch with mechanical click, arcade action game SFX",
    duration: 0.6,
  },
  "fire-rift": {
    prompt:
      "Cosmic sci-fi dimensional portal rift zap whoosh, energetic arcade special weapon SFX",
    duration: 0.8,
  },
  "fire-meow": {
    prompt:
      "Playful quirky cartoon cat meow blended with a bright laser zap, funny arcade game weapon SFX",
    duration: 0.7,
  },
  "fire-shuriken": {
    prompt:
      "Sharp metallic ninja shuriken star throw swish through the air, crisp arcade game SFX",
    duration: 0.5,
  },
  "fire-papa": {
    prompt:
      "Comical bouncy cartoon potato cannon pop thump launch, quirky arcade artillery SFX",
    duration: 0.6,
  },
  "fire-condor": {
    prompt:
      "Majestic sharp Andean condor eagle screech cry swooping down through the wind, arcade game special weapon SFX",
    duration: 0.8,
  },
  "fire-egg": {
    prompt:
      "Playful cartoon egg drop plop whoosh falling through air, whimsical arcade artillery SFX",
    duration: 0.5,
  },
  "fire-drill": {
    prompt:
      "Snappy cartoon mechanical power drill whirring launch zip, punchy arcade game weapon SFX",
    duration: 0.7,
  },
  "fire-spit": {
    prompt:
      "Comical fast cartoon llama spit ptooey wet pop launch, funny arcade game SFX",
    duration: 0.5,
    maxTrimSec: 0.38,
  },
  "fire-totora": {
    prompt:
      "Bouncy wooden reed bundle sling toss whoosh with light bamboo rattle, playful arcade weapon SFX",
    duration: 0.6,
  },
  "fire-choclo": {
    prompt:
      "Chunky comical corn cob cannon lob pop thump, playful cartoon artillery game SFX",
    duration: 0.6,
  },
  "fire-kernel": {
    prompt:
      "Crisp snappy popcorn kernel pop burst, very short playful arcade game SFX",
    duration: 0.5,
    maxTrimSec: 0.28,
  },
  "blast-0": {
    prompt:
      "Small crisp cartoon arcade explosion pop bang, tight punchy video game SFX",
    duration: 0.7,
  },
  "blast-1": {
    prompt:
      "Medium punchy cartoon artillery explosion boom with crisp debris crackle, arcade game SFX",
    duration: 1.0,
  },
  "blast-2": {
    prompt:
      "Massive epic cartoon dynamite explosion kaboom with deep punchy bass rumble, arcade brawler SFX",
    duration: 1.5,
  },
  "hit-mine-0": {
    prompt:
      "Crisp arcade light hit confirm slap with a bright tiny chime ding, fighting game SFX",
    duration: 0.5,
    maxTrimSec: 0.4,
  },
  "hit-mine-1": {
    prompt:
      "Punchy medium arcade hit confirm smash with a bright rewarding double bell chime, brawler game SFX",
    duration: 0.6,
  },
  "hit-mine-2": {
    prompt:
      "Huge critical hit confirm crunch impact with dramatic bright sparkle chime, arcade platform fighter SFX",
    duration: 0.8,
  },
  "hit-other-0": {
    prompt: "Soft muffled light cartoon impact thud, brief video game hit SFX",
    duration: 0.5,
    maxTrimSec: 0.35,
  },
  "hit-other-1": {
    prompt:
      "Medium cartoon body impact thwack punch, clean arcade fighting game SFX",
    duration: 0.5,
    maxTrimSec: 0.45,
  },
  "hit-other-2": {
    prompt:
      "Heavy dramatic cartoon knockback impact smash thud, arcade brawler SFX",
    duration: 0.7,
  },
  "hurt-mine-0": {
    prompt:
      "Cute short cartoon critter squeak ouch yelp, playful video game hurt SFX",
    duration: 0.5,
    maxTrimSec: 0.35,
  },
  "hurt-mine-1": {
    prompt: "Dramatic comical cartoon critter hurt oof yelp, arcade game SFX",
    duration: 0.6,
  },
  "hurt-other-0": {
    prompt:
      "Brief playful rival cartoon critter hit squeak, short video game SFX",
    duration: 0.5,
    maxTrimSec: 0.35,
  },
  "hurt-other-1": {
    prompt: "Rival cartoon critter big knockback comedic yelp, arcade game SFX",
    duration: 0.6,
  },
};

const MUSIC_SPECS: Record<string, MusicSpec> = {
  menu: {
    prompt:
      "Super playful, nostalgic late-90s 64-bit console party brawler character-select screen music, instrumental only. Punchy upbeat brass fanfare stabs, bouncy funky slap bass, bright cheerful synth lead melody, lively xylophone runs, crisp energetic arcade drum groove, 134 BPM. Joyful, cheeky, catchy repetitive video game lobby loop, pure fun, no vocals.",
    lengthMs: 30000,
  },
  andes: {
    prompt:
      "Playful, heroic late-90s 64-bit console arena fighter stage music set in a sunny Andean mountain valley, instrumental only. Bouncy bright brass hits and cheerful pan-flute lead trading catchy hooks with retro console synths, groovy walking slap bass, upbeat crisp drums and playful marimba accents, 138 BPM. Nostalgic joyful adventure brawler loop, no vocals.",
    lengthMs: 30000,
  },
  coast: {
    prompt:
      "Super playful, sunny late-90s console party brawler beach-canyon stage music, instrumental only. Catchy surf-rock guitar riff, cheerful punchy horn section, bouncy funky slap bass, lively marimba and bright retro synth melody, crisp upbeat drums, 140 BPM. Joyful nostalgic arcade arena loop full of energy, no vocals.",
    lengthMs: 30000,
  },
  canopy: {
    prompt:
      "Quirky, hyper-playful late-90s 64-bit console jungle-treetop brawler stage music, instrumental only. Bouncy marimba and xylophone lead melody, lively congas and woodblock groove, funky slap bass, cheeky brass stabs and bright retro synth hooks, 142 BPM. Fun mischievous classic console platform-fighter loop, no vocals.",
    lengthMs: 30000,
  },
  caldera: {
    prompt:
      "Exciting yet playful late-90s console arena fighter volcano-stage music, instrumental only. Heroic punchy brass fanfares, fast groovy electric bass, bright retro-arcade synth guitar lead, energetic driving drums and playful timpani accents, 146 BPM. Classic nostalgic cartoon boss-arena energy, upbeat and fun rather than dark, no vocals.",
    lengthMs: 30000,
  },
  totora: {
    prompt:
      "Cheerful, bouncy late-90s console party brawler lakeside-village stage music, instrumental only. Playful wooden marimba and bright whistle-synth melody, groovy upbeat bassline, light jazzy brass pops, crisp bouncy snare and shaker groove, 132 BPM. Sunny, whimsical, catchy classic video game stage loop, no vocals.",
    lengthMs: 30000,
  },
  saltglass: {
    prompt:
      "Sparkling, playful late-90s 64-bit console sky-palace brawler stage music, instrumental only. Bright shimmering bell synths and cheerful glockenspiel arpeggios over a groovy funky bassline, crisp upbeat arcade drums, soaring joyful brass and synth lead hook, 136 BPM. Dreamy yet super fun nostalgic fighter stage loop, no vocals.",
    lengthMs: 30000,
  },
  huaca: {
    prompt:
      "Cheeky, playful late-90s console haunted-temple party brawler stage music, instrumental only. Mischievous bouncy pizzicato bass, playful staccato brass and xylophone melody, quirky retro organ and flute hooks, crisp upbeat groovy drums, 134 BPM. Fun cartoon moonlit ruins adventure vibe, lighthearted and catchy, no vocals.",
    lengthMs: 30000,
  },
  frost: {
    prompt:
      "Joyful, super playful late-90s console snow-level party brawler stage music, instrumental only. Sparkling glockenspiel and bright celesta melody, cheerful brass stabs, jingling sleigh bells, bouncy funky bassline and lively upbeat arcade drums, 138 BPM. Cozy, festive, nostalgic winter platform-fighter loop, no vocals.",
    lengthMs: 30000,
  },
  loom: {
    prompt:
      "High-spirited, playful late-90s console sky-arena fighter stage music, instrumental only. Heroic soaring synth-brass melody, fast sparkling retro arpeggios, funky driving slap bass, punchy energetic arcade drums and triumphant horn hits, 144 BPM. Exhilarating nostalgic cartoon brawler showdown loop, joyful and catchy, no vocals.",
    lengthMs: 30000,
  },
  harbor: {
    prompt:
      "Rollicking, super playful late-90s console harbor-docks party brawler stage music, instrumental only. Jaunty accordion and punchy brass sea-shanty melody, bouncy tuba-meets-slap-bass groove, crisp lively drums and whimsical clockwork xylophone ticks, 140 BPM. Cheeky, energetic classic console arena loop, no vocals.",
    lengthMs: 30000,
  },
};

const apiKey = process.env.ELEVENLABS_API_KEY ?? "";
if (!apiKey) {
  console.error("ELEVENLABS_API_KEY is not set");
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const onlyArg = process.argv.slice(2).find((a) => a.startsWith("--only="));
const onlyNames = onlyArg
  ? new Set(onlyArg.slice("--only=".length).split(",").filter(Boolean))
  : null;
const force = args.has("--force");
const loopOnly = args.has("--loop-only");
const runSfx =
  !loopOnly &&
  (args.has("--sfx") ||
    (!args.has("--music") && !onlyNames) ||
    Boolean(onlyNames));
const runMusic =
  !loopOnly &&
  (args.has("--music") ||
    (!args.has("--sfx") && !onlyNames) ||
    Boolean(onlyNames));

const sfxDir = join(import.meta.dir, "../assets/sfx");
const musicDir = join(import.meta.dir, "../assets/music");

async function postProcessSfx(
  rawPath: string,
  outPath: string,
  maxTrimSec?: number,
): Promise<void> {
  const filters = [
    "silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.01",
  ];
  if (maxTrimSec !== undefined) {
    const fadeStart = Math.max(0.02, maxTrimSec - 0.03);
    filters.push(`atrim=0:${maxTrimSec}`);
    filters.push(`afade=t=out:st=${fadeStart}:d=0.03`);
  }
  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-y",
      "-loglevel",
      "error",
      "-i",
      rawPath,
      "-af",
      filters.join(","),
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "128k",
      outPath,
    ],
    { stderr: "pipe" },
  );
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`ffmpeg failed for ${outPath}: ${err}`);
  }
  await unlink(rawPath).catch(() => undefined);
}

async function generateSfx(name: string, spec: SfxSpec): Promise<void> {
  const outPath = join(sfxDir, `${name}.mp3`);
  if (!force && existsSync(outPath)) {
    console.log(`[sfx] skip ${name} (exists)`);
    return;
  }
  const res = await fetch(
    "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128",
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: spec.prompt,
        duration_seconds: spec.duration,
        prompt_influence: spec.influence ?? 0.45,
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SFX ${name} failed (${res.status}): ${body}`);
  }
  const rawPath = join(sfxDir, `.${name}.raw.mp3`);
  await Bun.write(rawPath, await res.arrayBuffer());
  await postProcessSfx(rawPath, outPath, spec.maxTrimSec);
  const sizeKb = Math.round(Bun.file(outPath).size / 1024);
  console.log(`[sfx] generated ${name}.mp3 (${sizeKb} KB)`);
}

async function makeSeamlessLoop(
  inPath: string,
  outPath: string,
): Promise<void> {
  const skip = 1.0;
  const loopLen = 24.0;
  const xfade = 2.5;
  const tailStart = skip + loopLen;
  const filter = [
    `[0:a]atrim=start=${skip}:duration=${xfade},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${xfade}:curve=qsin[bhead]`,
    `[0:a]atrim=start=${skip + xfade}:duration=${loopLen - xfade},asetpts=PTS-STARTPTS[brest]`,
    `[0:a]atrim=start=${tailStart}:duration=${xfade},asetpts=PTS-STARTPTS,afade=t=out:st=0:d=${xfade}:curve=qsin[tail]`,
    "[bhead][tail]amix=inputs=2:duration=shortest:normalize=0[seam]",
    "[seam][brest]concat=n=2:v=0:a=1[out]",
  ].join(";");
  const tmpPath = `${outPath}.loop.mp3`;
  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-y",
      "-loglevel",
      "error",
      "-i",
      inPath,
      "-filter_complex",
      filter,
      "-map",
      "[out]",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "128k",
      tmpPath,
    ],
    { stderr: "pipe" },
  );
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`ffmpeg loop failed for ${outPath}: ${err}`);
  }
  await Bun.write(outPath, Bun.file(tmpPath));
  await unlink(tmpPath).catch(() => undefined);
}

async function generateMusic(name: string, spec: MusicSpec): Promise<void> {
  const outPath = join(musicDir, `${name}.mp3`);
  if (!force && existsSync(outPath)) {
    console.log(`[music] skip ${name} (exists)`);
    return;
  }
  console.log(`[music] generating ${name}.mp3 (${spec.lengthMs}ms)...`);
  const res = await fetch(
    "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128",
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: spec.prompt,
        music_length_ms: spec.lengthMs,
        model_id: "music_v2",
        force_instrumental: true,
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Music ${name} failed (${res.status}): ${body}`);
  }
  const rawPath = join(musicDir, `.${name}.raw.mp3`);
  await Bun.write(rawPath, await res.arrayBuffer());
  await makeSeamlessLoop(rawPath, outPath);
  await unlink(rawPath).catch(() => undefined);
  const sizeKb = Math.round(Bun.file(outPath).size / 1024);
  console.log(`[music] generated seamless loop ${name}.mp3 (${sizeKb} KB)`);
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const current = items[index++];
        await worker(current);
      }
    }),
  );
}

await mkdir(sfxDir, { recursive: true });
await mkdir(musicDir, { recursive: true });

if (runSfx) {
  const entries = Object.entries(SFX_SPECS).filter(
    ([name]) => !onlyNames || onlyNames.has(name),
  );
  await runPool(entries, 4, ([name, spec]) => generateSfx(name, spec));
}

if (runMusic) {
  const entries = Object.entries(MUSIC_SPECS).filter(
    ([name]) => !onlyNames || onlyNames.has(name),
  );
  await runPool(entries, 2, ([name, spec]) => generateMusic(name, spec));
}

if (loopOnly) {
  const entries = Object.keys(MUSIC_SPECS).filter(
    (name) => !onlyNames || onlyNames.has(name),
  );
  await runPool(entries, 4, async (name) => {
    const path = join(musicDir, `${name}.mp3`);
    await makeSeamlessLoop(path, path);
    const sizeKb = Math.round(Bun.file(path).size / 1024);
    console.log(`[music] seamless-looped ${name}.mp3 (${sizeKb} KB)`);
  });
}

console.log("Done generating ElevenLabs audio.");
