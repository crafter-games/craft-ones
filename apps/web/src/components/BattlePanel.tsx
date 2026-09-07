"use client";
import {
  type BattleView,
  type PlayerView,
  WORLD_MAPS,
} from "@craft-ones/shared";
import dynamic from "next/dynamic";
import type { RefObject } from "react";
import type { GameBridge } from "../game/GameBridge";
import { ArsenalControls } from "./ArsenalControls";
import { MovementControls } from "./MovementControls";

const ArenaCanvas = dynamic(() => import("./ArenaCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-[16/9] items-center justify-center bg-[#b6e3df] text-[#3b2b38]">
      Waking up the critters…
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
  const color = number === 1 ? "#f3c677" : "#82d7c1";
  return (
    <div
      className="min-w-0 flex-1"
      data-testid={`player-${number}`}
      data-hp={player?.hp ?? ""}
      data-x={player?.x ?? ""}
      data-y={player?.y ?? ""}
      data-movement={player?.movementLeft ?? ""}
      data-species={player?.species}
      data-coat={player?.coat}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs sm:text-sm">
        <span className="truncate font-black" style={{ color }}>
          {player?.species === "llama" ? "Llama" : "Cuy"}{" "}
          <span className="font-normal text-[#b5bfb3]">
            / P{number}
            {you ? " (you)" : player ? "" : " — waiting"}
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

export function BattlePanel({
  state,
  sessionId,
  connected,
  bridge,
  power,
  local = false,
  restart,
}: {
  state: BattleView | null;
  sessionId: string;
  connected: boolean;
  bridge: RefObject<GameBridge>;
  power: number;
  local?: boolean;
  restart?: () => void;
}) {
  const current = state?.players.find(
    (p) => p.sessionId === state.currentPlayer,
  );
  const me = state?.players.find((p) => p.sessionId === sessionId);
  const winner = state?.players.find((p) => p.sessionId === state.winner);
  const aiming = state?.phase === "aiming",
    finished = state?.phase === "finished",
    waiting = state?.phase === "waiting";
  const myTurn = current?.sessionId === sessionId;
  const status = !state
    ? "Loading arena…"
    : waiting
      ? "Waiting for another player…"
      : finished
        ? winner
          ? `Player ${winner.number} wins!`
          : "It's a draw!"
        : aiming
          ? local
            ? `${current?.species === "llama" ? "Llama" : "Cuy"}'s turn. Let it fly!`
            : myTurn
              ? "Your turn. Make it count."
              : `Player ${current?.number}'s turn`
          : state.phase === "flying"
            ? `${state.projectile.kind === "grapple" ? "Hook" : "Projectile"} in flight…`
            : state.phase === "grappling"
              ? "Hold tight!"
              : state.phase === "resolving"
                ? "Making a move…"
                : "Impact!";
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9daa9b]">
            {finished
              ? "A tiny rivalry, settled."
              : `${local ? "Pass & play" : "Friendly duel"} · Round ${Math.max(1, Math.ceil((state?.turnNumber ?? 1) / 2))} · ${state?.mapId === "coast" ? WORLD_MAPS.coast.name : WORLD_MAPS.andes.name}`}
          </p>
          <h1
            data-testid="match-status"
            aria-live="polite"
            className="text-xl font-black tracking-tight sm:text-2xl"
          >
            {status}
          </h1>
        </div>
        <div
          className={`turn-clock ${aiming && (state?.remainingMs ?? 0) < 5000 ? "urgent" : ""}`}
        >
          <span data-testid="turn-timer">
            {aiming
              ? Math.ceil((state?.remainingMs ?? 0) / 1000)
                  .toString()
                  .padStart(2, "0")
              : "—"}
          </span>
          <small>SEC</small>
        </div>
      </div>
      <section
        className="battle-panel"
        data-testid="battle"
        data-phase={state?.phase ?? "connecting"}
        data-turn={state?.turnNumber ?? 0}
        data-current-player={current?.number ?? 0}
        data-connected={connected}
        data-map={state?.mapId ?? ""}
        data-explosion={state?.explosion.id ?? 0}
        data-terrain-revision={state?.terrainRevision ?? 0}
      >
        <div className="flex items-center gap-4 bg-[#283a35] p-4 sm:gap-12 sm:px-6">
          <Health
            number={1}
            player={state?.players[0]}
            you={!local && state?.players[0]?.sessionId === sessionId}
          />
          <span className="text-xs font-black italic text-[#b5bfb3]">VS</span>
          <Health
            number={2}
            player={state?.players[1]}
            you={!local && state?.players[1]?.sessionId === sessionId}
          />
        </div>
        <div className="relative">
          <ArenaCanvas bridge={bridge} />
          {waiting || finished || !state ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3">
              <div className="result-card">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f3c677]">
                  {finished ? "THAT’S A WRAP!" : "BRING A FRIEND"}
                </p>
                <p className="mt-2 text-xl font-black">{status}</p>
                <p className="mt-2 text-xs text-[#bdc9bc]">
                  {finished
                    ? state?.finishReason === "forfeit"
                      ? "Your opponent disconnected."
                      : "Small paws. Big bragging rights."
                    : "Copy the invite link and open it in another browser."}
                </p>
                {finished && restart ? (
                  <button
                    type="button"
                    className="primary-button pointer-events-auto mt-4"
                    onClick={restart}
                  >
                    Play again
                  </button>
                ) : finished ? (
                  <p className="mt-4 text-xs">
                    {state?.finishReason === "forfeit"
                      ? "Create a new game from home."
                      : "Waiting for Player 1 to restart."}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#283a35] px-4 py-3">
          <MovementControls
            bridge={bridge}
            disabled={!aiming || !myTurn || !connected || power > 0}
            budget={myTurn ? (me?.movementLeft ?? 0) : 0}
            limited={!!state && !state.terrainRows.length}
          />
          <div className="flex items-center gap-3">
            <label htmlFor="power" className="text-xs font-bold text-[#bdc9bc]">
              POWER
            </label>
            <meter
              id="power"
              min={0}
              max={100}
              value={power}
              className="h-2 w-24"
            />
            <span className="w-9 font-mono text-xs">{power}%</span>
          </div>
        </div>
        <ArsenalControls
          bridge={bridge}
          state={state}
          disabled={!aiming || !myTurn || !connected || power > 0}
        />
      </section>
      <p className="mt-3 text-center text-xs leading-relaxed text-[#a9b7a5]">
        Aim · hold to charge · release to fire{" "}
        <span className="hidden sm:inline">
          / A D move · W jump · ← → aim · hold Space
        </span>
      </p>
      {local ? (
        <p className="mt-1 text-center text-[11px] text-[#82947f]">
          You control both critters. The dotted arc previews 50% power until you
          charge.
        </p>
      ) : null}
    </>
  );
}
