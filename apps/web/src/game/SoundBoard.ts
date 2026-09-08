import type { SoundCue, WeaponId } from "@craft-ones/shared";

/**
 * Every sound in Craft Ones is synthesised here from oscillators and noise.
 * Nothing is sampled or downloaded: the arsenal is a handful of envelopes, so
 * the whole soundtrack costs a few hundred bytes of code and no assets.
 */

type ToneOptions = {
  from: number;
  to?: number;
  type?: OscillatorType;
  attack?: number;
  hold?: number;
  decay?: number;
  gain?: number;
  delay?: number;
};

type NoiseOptions = {
  decay: number;
  gain?: number;
  from?: number;
  to?: number;
  q?: number;
  type?: BiquadFilterType;
  delay?: number;
};

export class SoundBoard {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private charging: { oscillator: OscillatorNode; gain: GainNode } | null =
    null;
  private lastStep = 0;

  constructor(private enabled: boolean) {}

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopCharge();
      this.master?.gain.setTargetAtTime(0, this.now, 0.01);
    } else if (this.master)
      this.master.gain.setTargetAtTime(0.9, this.now, 0.01);
  }

  /** Browsers keep audio asleep until the player acts; call this from a gesture. */
  resume() {
    if (!this.enabled) return;
    const context = this.open();
    if (context?.state === "suspended") void context.resume();
  }

  play(cue: SoundCue) {
    if (!this.enabled || !this.open()) return;
    switch (cue.kind) {
      case "fire":
        return this.fire(cue.weapon);
      case "bounce":
        return this.tone({
          from: 340,
          to: 210,
          type: "triangle",
          decay: 0.09,
          gain: 0.16,
        });
      case "stick":
        this.tone({ from: 190, to: 90, type: "sine", decay: 0.13, gain: 0.2 });
        return this.hiss({ decay: 0.05, from: 900, gain: 0.05 });
      case "blast":
        return this.blast(cue.radius);
      case "hurt":
        return this.hurt(cue.amount, cue.mine);
      case "heal":
        this.tone({
          from: 520,
          to: 780,
          type: "sine",
          decay: 0.18,
          gain: 0.13,
        });
        return this.tone({
          from: 780,
          to: 1040,
          type: "sine",
          decay: 0.22,
          gain: 0.1,
          delay: 0.1,
        });
      case "shield":
        this.tone({
          from: 300,
          to: 600,
          type: "triangle",
          decay: 0.3,
          gain: 0.1,
        });
        return this.tone({
          from: 450,
          to: 900,
          type: "sine",
          decay: 0.34,
          gain: 0.07,
          delay: 0.04,
        });
      case "leap":
        return this.tone({
          from: 260,
          to: 720,
          type: "triangle",
          decay: 0.24,
          gain: 0.13,
        });
      case "dash":
        return this.hiss({ decay: 0.2, from: 700, to: 2600, gain: 0.09, q: 4 });
      case "jump":
        return this.tone({
          from: 300,
          to: 560,
          type: "square",
          decay: 0.11,
          gain: 0.07,
        });
      case "step":
        return this.step();
      case "turn":
        return this.turn(cue.mine);
      case "win":
        return this.fanfare([523, 659, 784, 1047], 0.11);
      case "lose":
        return this.fanfare([440, 370, 294, 220], 0.15, "triangle");
    }
  }

  /** A rising whine that tracks the shot the player is winding up. */
  charge(power: number) {
    if (!this.enabled || power <= 0) return this.stopCharge();
    const context = this.open();
    if (!context || !this.master) return;
    if (!this.charging) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sawtooth";
      gain.gain.value = 0;
      oscillator.connect(gain).connect(this.master);
      oscillator.start();
      this.charging = { oscillator, gain };
    }
    const { oscillator, gain } = this.charging;
    oscillator.frequency.setTargetAtTime(120 + power * 520, this.now, 0.05);
    gain.gain.setTargetAtTime(0.02 + power * 0.05, this.now, 0.05);
  }

  dispose() {
    this.stopCharge();
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.noise = null;
  }

  private get now() {
    return this.context?.currentTime ?? 0;
  }

  private open() {
    if (this.context) return this.context;
    const Ctor =
      typeof window === "undefined"
        ? undefined
        : (window.AudioContext ??
          (window as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext);
    if (!Ctor) return null;
    try {
      this.context = new Ctor();
    } catch {
      return null;
    }
    this.master = this.context.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    this.master.connect(this.context.destination);
    const frames = Math.floor(this.context.sampleRate * 0.6);
    this.noise = this.context.createBuffer(1, frames, this.context.sampleRate);
    const channel = this.noise.getChannelData(0);
    for (let i = 0; i < frames; i++) channel[i] = Math.random() * 2 - 1;
    return this.context;
  }

  private stopCharge() {
    if (!this.charging || !this.context) return;
    const { oscillator, gain } = this.charging;
    this.charging = null;
    gain.gain.setTargetAtTime(0, this.now, 0.02);
    oscillator.stop(this.now + 0.12);
  }

  private tone({
    from,
    to,
    type = "sine",
    attack = 0.006,
    hold = 0,
    decay = 0.2,
    gain = 0.15,
    delay = 0,
  }: ToneOptions) {
    const context = this.open();
    if (!context || !this.master) return;
    const at = this.now + delay;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, at);
    if (to !== undefined)
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, to),
        at + attack + hold + decay,
      );
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(gain, at + attack);
    envelope.gain.setValueAtTime(gain, at + attack + hold);
    envelope.gain.exponentialRampToValueAtTime(
      0.0001,
      at + attack + hold + decay,
    );
    oscillator.connect(envelope).connect(this.master);
    oscillator.start(at);
    oscillator.stop(at + attack + hold + decay + 0.02);
  }

  private hiss({
    decay,
    gain = 0.12,
    from = 1200,
    to,
    q = 1,
    type = "bandpass",
    delay = 0,
  }: NoiseOptions) {
    const context = this.open();
    if (!context || !this.master || !this.noise) return;
    const at = this.now + delay;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = this.noise;
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, at);
    if (to !== undefined)
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(1, to),
        at + decay,
      );
    envelope.gain.setValueAtTime(gain, at);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    source.connect(filter).connect(envelope).connect(this.master);
    source.start(at);
    source.stop(at + decay + 0.02);
  }

  private fire(weapon: WeaponId) {
    switch (weapon) {
      case "grenade":
        this.tone({
          from: 420,
          to: 180,
          type: "square",
          decay: 0.1,
          gain: 0.12,
        });
        return this.hiss({ decay: 0.12, from: 600, to: 240, gain: 0.08 });
      case "mortar":
        this.tone({ from: 150, to: 60, type: "sine", decay: 0.26, gain: 0.26 });
        return this.hiss({ decay: 0.22, from: 400, to: 120, gain: 0.14 });
      case "dynamite":
        this.tone({
          from: 240,
          to: 120,
          type: "triangle",
          decay: 0.14,
          gain: 0.14,
        });
        return this.hiss({ decay: 0.3, from: 2400, gain: 0.05, q: 8 });
      case "grapple":
        this.tone({
          from: 900,
          to: 1800,
          type: "square",
          decay: 0.12,
          gain: 0.08,
        });
        return this.hiss({
          decay: 0.18,
          from: 1800,
          to: 600,
          gain: 0.06,
          q: 6,
        });
      case "sticky":
        this.tone({
          from: 300,
          to: 140,
          type: "sine",
          decay: 0.16,
          gain: 0.16,
        });
        return this.hiss({ decay: 0.1, from: 700, to: 300, gain: 0.07 });
      default:
        this.tone({
          from: 260,
          to: 90,
          type: "sawtooth",
          decay: 0.18,
          gain: 0.18,
        });
        return this.hiss({ decay: 0.28, from: 900, to: 260, gain: 0.13, q: 2 });
    }
  }

  private blast(radius: number) {
    // Bigger craters ring lower and longer, so the arsenal reads by ear.
    const size = Math.min(1.6, Math.max(0.6, radius / 100));
    this.tone({
      from: 150 / size,
      to: 34,
      type: "sine",
      decay: 0.42 * size,
      gain: 0.34,
    });
    this.hiss({ decay: 0.36 * size, from: 1600, to: 120, gain: 0.3, q: 0.7 });
    this.hiss({
      decay: 0.5 * size,
      from: 300,
      to: 60,
      gain: 0.16,
      type: "lowpass",
      delay: 0.03,
    });
  }

  private hurt(amount: number, mine: boolean) {
    const weight = Math.min(1, amount / 55);
    this.tone({
      from: mine ? 300 : 380,
      to: mine ? 110 : 170,
      type: "square",
      decay: 0.12 + weight * 0.12,
      gain: (mine ? 0.15 : 0.1) + weight * 0.08,
    });
  }

  private step() {
    // Footsteps come thick and fast; keep them sparse enough to stay pleasant.
    if (this.now - this.lastStep < 0.09) return;
    this.lastStep = this.now;
    this.hiss({ decay: 0.05, from: 420, to: 180, gain: 0.05, q: 1.4 });
  }

  private turn(mine: boolean) {
    const root = mine ? 660 : 440;
    this.tone({ from: root, type: "triangle", decay: 0.16, gain: 0.1 });
    this.tone({
      from: root * 1.5,
      type: "triangle",
      decay: 0.22,
      gain: 0.08,
      delay: 0.11,
    });
  }

  private fanfare(
    notes: number[],
    step: number,
    type: OscillatorType = "square",
  ) {
    notes.forEach((note, i) => {
      this.tone({
        from: note,
        type,
        decay: 0.26,
        gain: 0.12,
        delay: i * step,
      });
    });
  }
}
