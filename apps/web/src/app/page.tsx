"use client";

import type { PlayableMapId, PlayerOptions } from "@craft-ones/shared";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CharacterPicker, MapPicker } from "../components/MatchSetup";
import { createBattle } from "../lib/connection";

export default function Home() {
  const router = useRouter();
  const creating = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mapId, setMapId] = useState<PlayableMapId>("andes");
  const [player, setPlayer] = useState<PlayerOptions>({
    species: "cuy",
    coat: "caramel",
  });

  async function create() {
    if (creating.current) return;
    creating.current = true;
    setBusy(true);
    setError("");
    try {
      const id = await createBattle(mapId, player);
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
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col px-5 sm:px-10">
      <header className="game-header mt-7">
        <span className="brand">
          CRAFT <span>ONES</span>
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#a9b7a5]">
          Crafter Station · Play Lab
        </span>
      </header>
      <section className="grid items-center gap-10 pb-8 pt-5 md:grid-cols-[1fr_1fr]">
        <div>
          <p className="mb-6 text-xs font-bold uppercase tracking-[0.18em] text-[#8cd5bb]">
            Made of mischief. Born in Peru.
          </p>
          <h1 className="text-6xl font-black leading-[.98] tracking-[-.065em] sm:text-7xl">
            Small paws.
            <br />
            <span className="text-[#f3c677]">Big trouble.</span>
          </h1>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-[#b7c4b1]">
            Four rivals. Six tools. Plenty of bad ideas.
            <br />
            Aim, charge, and send your friendly rivalry flying.
          </p>
        </div>
        <div className="overflow-hidden rounded-[26px] border-[3px] border-[#526a53] shadow-2xl">
          <Image
            src="/art/duel-poster.svg"
            alt="An original caramel Cuy and a cream Llama face off in cartoon Andean grasslands."
            width={720}
            height={620}
            priority
            className="h-auto w-full"
          />
        </div>
      </section>
      <section className="match-setup mb-10" aria-label="Match setup">
        <h2 className="text-sm font-bold">Choose map & character</h2>
        <div className="mt-4 grid items-center gap-8 md:grid-cols-2">
          <CharacterPicker
            value={player}
            onChange={setPlayer}
            label="Your critter"
          />
          <MapPicker value={mapId} onChange={setMapId} />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/playground?map=${mapId}&species=${player.species}&coat=${player.coat}`}
            className="primary-button"
          >
            Playground{" "}
            <span aria-hidden="true" className="ml-7">
              ↗
            </span>
          </Link>
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="secondary-button"
          >
            {busy ? "Creating game…" : "Create Game"}
          </button>
        </div>
        <p className="mt-5 text-xs leading-relaxed text-[#91a38e]">
          Play both sides locally, or invite a friend.
          <br />
          No sign-up. Just a little competitive chaos.
        </p>
        {error ? (
          <p role="alert" className="mt-5 max-w-sm text-sm text-[#ffae9d]">
            {error}
          </p>
        ) : null}
      </section>
      <footer className="flex flex-wrap justify-between gap-3 border-t border-white/10 py-6 text-[10px] font-bold uppercase tracking-wider text-[#82947f]">
        <span>Two critters · 100 HP · 15-second turns</span>
        <span>Craft Ones / First playable</span>
      </footer>
    </main>
  );
}
