"use client";

import Link from "next/link";
import type { ReactNode } from "react";

const SOUND_KEY = "craft-ones:sound";

/** A short launch blip, synthesised on the click that asked for it. */
function blip() {
  try {
    if (localStorage.getItem(SOUND_KEY) === "off") return;
  } catch {
    // A browser with storage switched off still gets the sound.
  }
  try {
    play();
  } catch {
    // Audio is a nicety: never let it get between the player and the game.
  }
}

function play() {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return;
  const audio = new Ctor();
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.14, audio.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.26);
  gain.connect(audio.destination);
  const tone = audio.createOscillator();
  tone.type = "triangle";
  tone.frequency.setValueAtTime(320, audio.currentTime);
  tone.frequency.exponentialRampToValueAtTime(760, audio.currentTime + 0.18);
  tone.connect(gain);
  tone.start();
  tone.stop(audio.currentTime + 0.28);
  tone.onended = () => void audio.close();
}

export function CtaLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={blip}>
      {children}
    </Link>
  );
}
