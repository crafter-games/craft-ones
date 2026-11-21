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
      "Upbeat, bouncy, catchy instrumental retro-modern video game lobby and character select background music. Playful marimba, bright brass stabs, cheerful chiptune synth lead melody, groovy slap bass, crisp tight drums, 128 BPM. Repetitive catchy arcade loop feel, cheerful and energetic without vocals, designed to loop seamlessly in the background of a colorful 2D critter battle game.",
    lengthMs: 30000,
  },
  andes: {
    prompt:
      "Bright, uplifting instrumental video game stage background music for a sunlit mountain valley with hanging gardens and stone arches. Cheerful pan flute and charango-inspired plucked melody blended with playful retro-modern chiptune synth lead, crisp light upbeat percussion, 126 BPM. Repetitive catchy platformer loop, warm breezy high-altitude adventure vibe, no vocals.",
    lengthMs: 30000,
  },
  coast: {
    prompt:
      "Warm, sun-drenched instrumental arcade video game stage background music for wind-carved coastal sandstone cliffs and caves. Groovy acoustic-meets-synth guitar riff, playful marimba, bouncy upbeat surf-adventure rhythm, crisp drums, 130 BPM. Repetitive catchy video game loop, sunny golden canyon energy, no vocals.",
    lengthMs: 30000,
  },
  canopy: {
    prompt:
      "Playful, bouncy instrumental treetop jungle platformer video game background music. Lively congas, woodblock, bright marimba, cheerful wooden flute and chiptune lead melody, groovy upbeat bassline, 132 BPM. Repetitive catchy tropical canopy adventure loop, joyful and rhythmic, no vocals.",
    lengthMs: 30000,
  },
  caldera: {
    prompt:
      "Energetic, fiery instrumental volcanic crater arcade arena video game background music. Driving punchy drums, bold playful brass stabs, heroic retro-modern synth lead melody, rhythmic bassline, 140 BPM. Repetitive catchy boss-stage game loop, exciting molten adventure vibe without being harsh, no vocals.",
    lengthMs: 30000,
  },
  totora: {
    prompt:
      "Relaxed yet upbeat instrumental lakeside reed-village video game background music. Warm wooden marimba, gentle kalimba, bouncy light bassline, playful soft percussion, cheerful sunlit water reflections vibe, 118 BPM. Repetitive catchy cozy adventure game loop, breezy and pleasant, no vocals.",
    lengthMs: 30000,
  },
  saltglass: {
    prompt:
      "Shimmering, crystalline, dreamy yet upbeat instrumental video game stage background music for white salt flats and crystal arches. Sparkling bell synths, arpeggiated glassy chimes, crisp light electronic beat, warm airy pad, 124 BPM. Repetitive catchy sky-mirror platformer loop, bright ethereal atmosphere, no vocals.",
    lengthMs: 30000,
  },
  huaca: {
    prompt:
      "Playful, mysterious nocturnal ancient-temple instrumental video game background music for moonlit adobe ruins. Sneaky groovy pizzicato bassline, mystical wooden flute, warm plucked strings, crisp rhythmic hand percussion, 122 BPM. Repetitive catchy moonlit ruins game loop, magical and intriguing, no vocals.",
    lengthMs: 30000,
  },
  frost: {
    prompt:
      "Crisp, sparkling winter snow-stage instrumental video game background music for glacier halls and snow bridges. Bright glockenspiel and icy celesta melody, subtle sleigh bells, bouncy cheerful upbeat bass and light drums, 126 BPM. Repetitive catchy playful winter platformer loop, cozy and lively, no vocals.",
    lengthMs: 30000,
  },
  loom: {
    prompt:
      "Dramatic, electric sky-storm instrumental video game arena background music for floating woven islands above thunder clouds. Energetic synth arpeggios, punchy crisp snare groove, soaring heroic chiptune-brass lead melody, 138 BPM. Repetitive catchy sky-battle game loop, exhilarating adventure vibe, no vocals.",
    lengthMs: 30000,
  },
  harbor: {
    prompt:
      "Jaunty, upbeat steampunk-harbor sea-shanty instrumental video game background music for timber docks and towering cranes. Cheerful accordion and bright brass melody, rhythmic ticking clockwork percussion, bouncy lively bassline, 130 BPM. Repetitive catchy dockside adventure game loop, playful and spirited, no vocals.",
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
const runSfx =
  args.has("--sfx") ||
  (!args.has("--music") && !onlyNames) ||
  Boolean(onlyNames);
const runMusic =
  args.has("--music") ||
  (!args.has("--sfx") && !onlyNames) ||
  Boolean(onlyNames);

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
  await Bun.write(outPath, await res.arrayBuffer());
  const sizeKb = Math.round(Bun.file(outPath).size / 1024);
  console.log(`[music] generated ${name}.mp3 (${sizeKb} KB)`);
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

console.log("Done generating ElevenLabs audio.");
