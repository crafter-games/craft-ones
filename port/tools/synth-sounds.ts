// Renders src/sounds.ts recipes offline (oscillators, seeded noise through an RBJ biquad) to MP3 with ffmpeg.
// Output: assets/sfx/<name>.mp3, generated and not committed.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { type Op, RECIPES, type Wave } from "../src/sounds";

const RATE = 44100;
const out = join(import.meta.dir, "../assets/sfx");

// Web Audio's exponentialRampToValueAtTime between two positive values.
const ramp = (from: number, to: number, t: number): number =>
  from * (to / from) ** Math.min(1, Math.max(0, t));

function oscillator(type: Wave, phase: number): number {
  const p = phase - Math.floor(phase);
  if (type === "sine") return Math.sin(2 * Math.PI * p);
  if (type === "square") return p < 0.5 ? 1 : -1;
  if (type === "sawtooth") return 2 * p - 1;
  return 1 - 4 * Math.abs(p - 0.5);
}

function render(ops: Op[]): Float32Array {
  const length =
    Math.max(
      ...ops.map(
        (op) =>
          (op.delay ?? 0) +
          (op.tone
            ? (op.attack ?? 0.006) + (op.hold ?? 0) + (op.decay ?? 0.2)
            : op.decay),
      ),
    ) + 0.05;
  const buffer = new Float32Array(Math.ceil(length * RATE));
  let seed = 0x9e3779b9;
  const noise = (): number => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
  for (const op of ops) {
    const start = Math.round((op.delay ?? 0) * RATE);
    if (op.tone) {
      const attack = op.attack ?? 0.006;
      const hold = op.hold ?? 0;
      const decay = op.decay ?? 0.2;
      const gain = op.gain ?? 0.15;
      const total = attack + hold + decay;
      let phase = 0;
      for (let i = 0; i < total * RATE && start + i < buffer.length; i++) {
        const t = i / RATE;
        const frequency =
          op.to === undefined
            ? op.from
            : ramp(op.from, Math.max(1, op.to), t / total);
        const level =
          t < attack
            ? ramp(0.0001, gain, t / attack)
            : t < attack + hold
              ? gain
              : ramp(gain, 0.0001, (t - attack - hold) / decay);
        phase += frequency / RATE;
        buffer[start + i] += oscillator(op.type ?? "sine", phase) * level;
      }
    } else {
      const gain = op.gain ?? 0.12;
      const from = op.from ?? 1200;
      const q = op.q ?? 1;
      let x1 = 0;
      let x2 = 0;
      let y1 = 0;
      let y2 = 0;
      for (let i = 0; i < op.decay * RATE && start + i < buffer.length; i++) {
        const t = i / RATE;
        const frequency =
          op.to === undefined
            ? from
            : ramp(from, Math.max(1, op.to), t / op.decay);
        const w = (2 * Math.PI * Math.min(frequency, RATE * 0.45)) / RATE;
        const alpha = Math.sin(w) / (2 * q);
        const cos = Math.cos(w);
        // RBJ cookbook coefficients, recomputed per sample because the cutoff sweeps.
        const [b0, b1, b2] =
          op.type === "lowpass"
            ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2]
            : [alpha, 0, -alpha];
        const a0 = 1 + alpha;
        const x = noise();
        const y =
          (b0 * x + b1 * x1 + b2 * x2 + 2 * cos * y1 - (1 - alpha) * y2) / a0;
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        buffer[start + i] += y * ramp(gain, 0.0001, t / op.decay);
      }
    }
  }
  return buffer;
}

function wav(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) bytes[offset + i] = s.charCodeAt(i);
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => {
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s * 0.9)) * 32767, true);
  });
  return bytes;
}

await mkdir(out, { recursive: true });
const names = Object.keys(RECIPES);
await Promise.all(
  names.map(async (name): Promise<void> => {
    const proc = Bun.spawn(
      [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-f",
        "wav",
        "-i",
        "pipe:0",
        "-codec:a",
        "libmp3lame",
        "-q:a",
        "4",
        join(out, `${name}.mp3`),
      ],
      { stdin: "pipe" },
    );
    proc.stdin.write(wav(render(RECIPES[name])));
    proc.stdin.end();
    if ((await proc.exited) !== 0) throw new Error(`ffmpeg failed for ${name}`);
  }),
);
console.log(`synthesized ${names.length} sounds into assets/sfx`);
