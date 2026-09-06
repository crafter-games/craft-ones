"use client";

import type { BattleView, PlayerView } from "@craft-ones/shared";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { GameBridge } from "../game/ArenaScene";
import { acquireBattle } from "../lib/connection";

const ArenaCanvas = dynamic(() => import("./ArenaCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-[16/9] items-center justify-center bg-[#1c261e] font-mono text-sm text-[#a3aca0]">
      Loading arena…
    </div>
  ),
});

function Health({
  player,
  number,
  you,
}: {
  player?: PlayerView;
  number: number;
  you: boolean;
}) {
  const color = number === 1 ? "#d2fb78" : "#d7b7ff";
  return (
    <div
      className="min-w-0 flex-1"
      data-testid={`player-${number}`}
      data-hp={player?.hp ?? ""}
      data-x={player?.x ?? ""}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs sm:text-sm">
        <span className="truncate font-bold" style={{ color }}>
          Player {number}{" "}
          <span className="font-normal text-[#a3aca0]">
            {you ? "(you)" : player ? "" : "— waiting"}
          </span>
        </span>
        <span className="shrink-0 font-mono text-xs">
          {player ? `${player.hp} HP` : "—"}
        </span>
      </div>
      <meter
        aria-label={`Player ${number} health`}
        min={0}
        max={100}
        value={player?.hp ?? 0}
        className="block h-2 w-full"
        style={{ color }}
      />
    </div>
  );
}

export default function GameSession({ roomId }: { roomId: string }) {
  const [state, setState] = useState<BattleView | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [power, setPower] = useState(0);
  const [copied, setCopied] = useState(false);
  const [manualLink, setManualLink] = useState("");
  const bridge = useRef<GameBridge>({
    state: null,
    sessionId: "",
    connected: false,
    fire: () => undefined,
    charge: setPower,
  });

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    const connection = acquireBattle(roomId);
    void connection.promise
      .then((room) => {
        if (!active) return;
        setSessionId(room.sessionId);
        setConnected(true);
        bridge.current.sessionId = room.sessionId;
        bridge.current.connected = true;
        bridge.current.fire = (action) => room.send("fire", action);
        const sync = () => {
          if (!active || !room.state.players) return;
          const snapshot = room.state.toJSON() as BattleView;
          bridge.current.state = snapshot;
          setState(snapshot);
        };
        const onLeave = () => {
          if (!active) return;
          bridge.current.connected = false;
          setConnected(false);
          setError(
            "Disconnected from the room. Create a new game to play again.",
          );
        };
        const onError = () => {
          if (active) setError("The connection encountered an error.");
        };
        room.onStateChange(sync);
        room.onLeave(onLeave);
        room.onError(onError);
        const offAction = room.onMessage("actionError", (message: string) => {
          if (active) setError(message);
        });
        unsubscribe = () => {
          room.onStateChange.remove(sync);
          room.onLeave.remove(onLeave);
          room.onError.remove(onError);
          offAction();
        };
        sync();
      })
      .catch(() => {
        if (active)
          setError(
            "This room is full, has ended, or no longer exists. Check that the game server is running, or create a new game.",
          );
      });
    return () => {
      active = false;
      bridge.current.connected = false;
      unsubscribe();
      connection.release();
    };
  }, [roomId]);

  async function copyInvite() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setManualLink("");
    } catch {
      setManualLink(url);
    }
  }

  const myTurn = state?.currentPlayer === sessionId;
  const current = state?.players.find(
    (p) => p.sessionId === state.currentPlayer,
  );
  const winner = state?.players.find((p) => p.sessionId === state.winner);
  const waiting = state?.phase === "waiting";
  const finished = state?.phase === "finished";
  const aiming = state?.phase === "aiming";
  const status = !state
    ? "Connecting to arena…"
    : waiting
      ? "Waiting for another player…"
      : finished
        ? winner
          ? `Player ${winner.number} wins!`
          : "It's a draw!"
        : aiming
          ? myTurn
            ? "Your turn. Make it count."
            : `Player ${current?.number}'s turn`
          : state.phase === "flying"
            ? "Rocket in flight…"
            : "Impact!";

  return (
    <main className="mx-auto min-h-svh max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="text-sm font-bold tracking-tight">
          CRAFT ONES <span className="text-[#d2fb78]">/</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#a3aca0]">
            Room <span className="text-[#f1f0e5]">{roomId}</span>
          </span>
          <button
            type="button"
            onClick={copyInvite}
            className="rounded-md border border-white/20 px-3 py-2 text-xs font-bold hover:border-[#d2fb78]"
          >
            {copied ? "Link copied" : "Copy Invite Link"}
          </button>
        </div>
      </header>
      {manualLink ? (
        <label className="mb-5 block text-xs text-[#a3aca0]">
          Copy this invite URL
          <input
            aria-label="Invite link"
            readOnly
            value={manualLink}
            onFocus={(event) => event.target.select()}
            className="mt-2 w-full rounded border border-white/20 p-3 font-mono text-[#f1f0e5]"
          />
        </label>
      ) : null}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#a3aca0]">
            {finished
              ? "Duel complete"
              : waiting
                ? "Invite your rival"
                : `Round ${Math.max(1, Math.ceil((state?.turnNumber ?? 1) / 2))} / Flatland`}
          </p>
          <h1
            aria-live="polite"
            className="text-xl font-bold tracking-tight sm:text-2xl"
            data-testid="match-status"
          >
            {status}
          </h1>
        </div>
        <div
          className={`shrink-0 rounded-lg border px-4 py-2 text-center ${aiming && (state?.remainingMs ?? 0) < 5000 ? "border-[#ffae9d]/40 text-[#ffae9d]" : "border-white/10"}`}
        >
          <span
            className="font-mono text-2xl tabular-nums"
            data-testid="turn-timer"
          >
            {aiming
              ? Math.ceil((state?.remainingMs ?? 0) / 1000)
                  .toString()
                  .padStart(2, "0")
              : "—"}
          </span>
          <span className="ml-1 text-[10px] text-[#a3aca0]">SEC</span>
        </div>
      </div>
      {error ? (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-[#ffae9d]/30 bg-[#ffae9d]/5 p-4 text-sm text-[#ffae9d]"
        >
          {error}{" "}
          <Link href="/" className="ml-2 underline">
            Back to home
          </Link>
        </div>
      ) : null}
      <section
        className="overflow-hidden rounded-xl border border-white/10"
        data-testid="battle"
        data-phase={state?.phase ?? "connecting"}
        data-turn={state?.turnNumber ?? 0}
        data-current-player={current?.number ?? 0}
        data-connected={connected}
      >
        <div className="flex items-center gap-6 bg-[#191e19] p-4 sm:gap-14 sm:px-6 sm:py-5">
          <Health
            number={1}
            player={state?.players.find((p) => p.number === 1)}
            you={
              state?.players.find((p) => p.number === 1)?.sessionId ===
              sessionId
            }
          />
          <span className="font-mono text-[10px] text-[#a3aca0]">VS</span>
          <Health
            number={2}
            player={state?.players.find((p) => p.number === 2)}
            you={
              state?.players.find((p) => p.number === 2)?.sessionId ===
              sessionId
            }
          />
        </div>
        <div className="relative">
          <ArenaCanvas bridge={bridge} />
          {waiting || finished || !state ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-5">
              <div className="max-w-sm rounded-xl border border-white/15 bg-[#111512]/95 px-7 py-6 text-center shadow-xl">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#d2fb78]">
                  {finished ? "GG. Well played." : "Two players. One winner."}
                </p>
                <p className="text-lg font-bold">{status}</p>
                <p className="mt-2 text-xs leading-relaxed text-[#a3aca0]">
                  {finished
                    ? state?.finishReason === "forfeit"
                      ? "Your opponent disconnected."
                      : "One good shot changes everything."
                    : "Copy the invite link and open it in another browser."}
                </p>
                {finished ? (
                  <Link
                    href="/"
                    className="pointer-events-auto mt-5 inline-block rounded-md bg-[#d2fb78] px-5 py-3 text-sm font-bold text-[#17200f]"
                  >
                    New Game
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#191e19] px-5 py-4">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#a3aca0]">
              Rocket / 01
            </span>
            <span className="h-5 w-px bg-white/10" />
            <span className="text-xs text-[#a3aca0]">
              {aiming && myTurn
                ? "Hold to charge. Release to fire."
                : "Watch. Calculate. Take your turn."}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <label
              htmlFor="power"
              className="font-mono text-[10px] uppercase text-[#a3aca0]"
            >
              Power
            </label>
            <meter
              id="power"
              min={0}
              max={100}
              value={power}
              className="h-2 w-24 accent-[#d2fb78]"
            />
            <span className="w-8 font-mono text-xs tabular-nums">{power}%</span>
          </div>
        </div>
      </section>
      <footer className="mt-5 flex flex-wrap justify-between gap-3 font-mono text-[10px] leading-relaxed text-[#a3aca0]">
        <p>
          Mouse / touch: aim, hold, release. Keyboard: focus arena, ← → aim,
          hold Space.
        </p>
        <p>
          {connected ? "CONNECTED / SERVER-AUTHORITATIVE" : "OFFLINE"} · 1 v 1
        </p>
      </footer>
    </main>
  );
}
