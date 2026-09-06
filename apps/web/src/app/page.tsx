"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createBattle } from "../lib/connection";

export default function Home() {
  const router = useRouter();
  const creating = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    if (creating.current) return;
    creating.current = true;
    setBusy(true);
    setError("");
    try {
      const id = await createBattle();
      router.push(`/game/${id}`);
    } catch {
      setError(
        "Could not reach the game server. Make sure it is running, then try again.",
      );
      creating.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col px-6 sm:px-10">
      <header className="flex items-center justify-between border-b border-white/10 py-7">
        <span className="text-sm font-bold tracking-tight">
          CRAFT ONES<span className="ml-2 text-[#d2fb78]">/</span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#a3aca0]">
          Crafter Station · Play Lab
        </span>
      </header>
      <section className="grid flex-1 items-center gap-10 py-16 md:grid-cols-[1.1fr_1fr] md:gap-16">
        <div>
          <p className="mb-7 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-[#d2fb78]">
            <span className="h-2 w-2 rounded-full bg-[#d2fb78]" /> Multiplayer
            prototype / 001
          </p>
          <h1 className="text-6xl font-black leading-[0.95] tracking-[-0.065em] sm:text-8xl">
            Small arena.
            <br />
            <span className="text-[#d2fb78]">Big rivalry.</span>
          </h1>
          <p className="mt-7 max-w-sm text-base leading-relaxed text-[#a3aca0]">
            One friend. One rocket. Fifteen seconds.
            <br />
            An original turn-based duel where every shot counts.
          </p>
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="mt-9 flex w-full items-center justify-between gap-16 rounded-lg bg-[#d2fb78] px-6 py-4 text-base font-bold text-[#17200f] transition-colors hover:bg-[#e2ffa7] sm:w-auto"
          >
            {busy ? "Creating game…" : "Create Game"}
            <span aria-hidden="true">↗</span>
          </button>
          <p className="mt-4 font-mono text-[11px] text-[#a3aca0]">
            No sign-up. Share a link. Settle it.
          </p>
          {error ? (
            <p role="alert" className="mt-5 max-w-sm text-sm text-[#ffae9d]">
              {error}
            </p>
          ) : null}
        </div>
        <div
          aria-hidden="true"
          className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-[#1c261e]"
        >
          <div className="absolute top-5 right-5 left-5 flex justify-between font-mono text-[10px] tracking-widest text-[#a3aca0]">
            <span>THE PROVING GROUND</span>
            <span>1 v 1</span>
          </div>
          <svg
            viewBox="0 0 420 420"
            className="h-full w-full"
            role="presentation"
          >
            <defs>
              <pattern
                id="grid"
                width="30"
                height="30"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 30 0 L 0 0 0 30"
                  fill="none"
                  stroke="#a3aca0"
                  strokeWidth="0.5"
                  opacity="0.12"
                />
              </pattern>
            </defs>
            <rect width="420" height="420" fill="url(#grid)" />
            <circle cx="322" cy="105" r="42" fill="#d2fb78" opacity="0.07" />
            <path
              d="M 95 296 Q 185 30 328 270"
              stroke="#d2fb78"
              strokeWidth="2"
              strokeDasharray="5 9"
              fill="none"
              opacity="0.65"
            />
            <path d="m 286 210 10 12 -15 -4" fill="#d2fb78" />
            <rect y="325" width="420" height="95" fill="#253426" />
            <path d="M 0 325 H 420" stroke="#657e4e" />
            <circle cx="90" cy="303" r="22" fill="#d2fb78" />
            <path
              d="m 96 295 19 -23"
              stroke="#d2fb78"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <circle cx="330" cy="303" r="22" fill="#d7b7ff" />
            <path
              d="m 324 295 -19 -23"
              stroke="#d7b7ff"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <text
              x="90"
              y="365"
              fill="#d2fb78"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="middle"
            >
              PLAYER 01
            </text>
            <text
              x="330"
              y="365"
              fill="#d7b7ff"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="middle"
            >
              PLAYER 02
            </text>
          </svg>
          <span className="absolute bottom-5 left-5 font-mono text-[9px] tracking-widest text-[#a3aca0]">
            AIM. CHARGE. LET GO.
          </span>
        </div>
      </section>
      <footer className="flex flex-wrap justify-between gap-4 border-t border-white/10 py-6 font-mono text-[10px] uppercase tracking-widest text-[#a3aca0]">
        <span>Built to play. Not to grind.</span>
        <span>2 players · 100 HP · 1 rocket</span>
      </footer>
    </main>
  );
}
