"use client";

import {
  CHARACTERS,
  PLAYABLE_MAP_IDS,
  type PlayableMapId,
  type PlayerOptions,
  WORLD_MAPS,
} from "@craft-ones/shared";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Brand } from "../../components/Brand";
import { MapPicker, SeatPicker } from "../../components/MatchSetup";
import { createBattle } from "../../lib/connection";

export default function SetupScreen() {
  const router = useRouter();
  const search = useSearchParams();
  // Playground fills both seats locally; Create Game only picks the host's.
  const local = search.get("mode") !== "create";
  const creating = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mapId, setMapId] = useState<PlayableMapId>(
    PLAYABLE_MAP_IDS.find((id) => id === search.get("map")) ?? "andes",
  );
  const [one, setOne] = useState<PlayerOptions>({
    species: "cuy",
    coat: "caramel",
  });
  const [two, setTwo] = useState<PlayerOptions>({
    species: "llama",
    coat: "cream",
  });

  async function start() {
    if (local) {
      const query = new URLSearchParams({
        map: mapId,
        species: one.species,
        coat: one.coat,
        species2: two.species,
        coat2: two.coat,
      });
      router.push(`/playground?${query}`);
      return;
    }
    if (creating.current) return;
    creating.current = true;
    setBusy(true);
    setError("");
    try {
      router.push(`/game/${await createBattle(mapId, one)}`);
    } catch {
      setError(
        "Could not reach the game server. Make sure it is running, then try again.",
      );
      creating.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="lobby setup">
      <header className="lobby-header">
        <Brand />
        <div className="step-line">
          <span className="step" aria-current="step">
            1 · SETUP
          </span>
          <span aria-hidden="true" style={{ color: "#526a53" }}>
            ———
          </span>
          <span className="step">2 · PLAY</span>
        </div>
        <span className="pill">
          {local ? "Playground · Local" : "Create Game · Invite"}
        </span>
      </header>
      <div className={`setup-body ${local ? "" : "is-single"}`}>
        <SeatPicker
          value={one}
          onChange={setOne}
          seat="one"
          label={local ? "Player 1" : "Your critter"}
        />
        {local ? (
          <SeatPicker
            value={two}
            onChange={setTwo}
            seat="two"
            label="Player 2"
          />
        ) : null}
        <MapPicker value={mapId} onChange={setMapId} />
      </div>
      {error ? (
        <p role="alert" className="px-4 text-sm text-[#ffae9d] lg:px-12">
          {error}
        </p>
      ) : null}
      <footer className="setup-footer">
        <p className="setup-summary">
          {CHARACTERS[one.species].name} <b>vs</b>{" "}
          {local ? CHARACTERS[two.species].name : "your rival"} ·{" "}
          {WORLD_MAPS[mapId].name} · 100 HP · 15 s turns
        </p>
        <Link href="/" className="cta dark">
          Back
        </Link>
        <button
          type="button"
          className="cta gold"
          onClick={start}
          disabled={busy}
        >
          {busy ? "Creating game…" : "Start match"}{" "}
          <span aria-hidden="true">→</span>
        </button>
      </footer>
    </main>
  );
}
