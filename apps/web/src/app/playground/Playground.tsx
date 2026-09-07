"use client";

import { useRef, useState } from "react";
import GameSession from "../../components/GameSession";
import { createBattle } from "../../lib/connection";

export default function Playground() {
  const creating = useRef(false);
  const [roomId, setRoomId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    if (creating.current) return;
    creating.current = true;
    setBusy(true);
    setError("");

    if (roomId) setRoomId("");

    try {
      setRoomId(await createBattle());
    } catch {
      setError(
        "Could not reach the game server. Make sure it is running, then try again.",
      );
    } finally {
      creating.current = false;
      setBusy(false);
    }
  }

  const gamePath = roomId ? `/game/${roomId}` : "";

  return (
    <main className="mx-auto min-h-svh max-w-[1800px] px-4 py-6 sm:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-5 border-b border-white/10 pb-6">
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#d2fb78]">
            Hidden development view
          </p>
          <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">
            Craft Ones playground
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#a3aca0]">
            Run both sides of one server-authoritative duel in this browser.
            Each panel is a real player connection.
          </p>
        </div>
        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="rounded-lg bg-[#d2fb78] px-5 py-3 text-sm font-bold text-[#17200f] transition-colors hover:bg-[#e2ffa7]"
        >
          {busy
            ? roomId
              ? "Resetting…"
              : "Starting…"
            : roomId
              ? "Reset Playground"
              : "Start Playground"}
        </button>
      </header>

      {error ? (
        <div
          role="alert"
          data-testid="playground-error"
          className="mb-6 rounded-lg border border-[#ffae9d]/30 bg-[#ffae9d]/5 p-4 text-sm text-[#ffae9d]"
        >
          {error}
        </div>
      ) : null}

      {roomId ? (
        <section
          className="grid gap-6 xl:grid-cols-2"
          aria-label="Two-player playground"
        >
          <article className="min-w-0 overflow-hidden rounded-xl border border-[#d2fb78]/25 bg-[#111512]">
            <p className="border-b border-white/10 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#d2fb78]">
              Player 1 / host view
            </p>
            <div data-testid="playground-player-1">
              <GameSession key={roomId} roomId={roomId} invitePath={gamePath} />
            </div>
          </article>

          <article className="min-w-0 overflow-hidden rounded-xl border border-[#d7b7ff]/25 bg-[#111512]">
            <p className="border-b border-white/10 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#d7b7ff]">
              Player 2 / rival view
            </p>
            <iframe
              key={roomId}
              src={gamePath}
              title="Player 2 game"
              className="block h-[900px] w-full border-0"
            />
          </article>
        </section>
      ) : (
        <section className="flex min-h-[55svh] items-center justify-center rounded-xl border border-dashed border-white/15 bg-[#191e19]/40 p-8 text-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#a3aca0]">
              No active sandbox
            </p>
            <p className="mt-3 text-lg font-bold">
              Start the playground to create both players.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
