"use client";

import type { BattleView, PlayerOptions } from "@craft-ones/shared";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createBridge } from "../game/GameBridge";
import { acquireBattle, hasBattle } from "../lib/connection";
import { BattlePanel } from "./BattlePanel";
import { SeatPicker } from "./MatchSetup";

export default function GameSession({
  roomId,
  invitePath,
}: {
  roomId: string;
  invitePath?: string;
}) {
  const [state, setState] = useState<BattleView | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [power, setPower] = useState(0);
  const [copied, setCopied] = useState(false);
  const [manualLink, setManualLink] = useState("");
  const bridge = useRef(createBridge(setPower));
  const restart = useRef(() => {});
  const [joined, setJoined] = useState<boolean | null>(null);
  useEffect(() => setJoined(hasBattle(roomId)), [roomId]);
  const [profile, setProfile] = useState<PlayerOptions>({
    species: "llama",
    coat: "cream",
  });
  const selectedProfile = useRef(profile);
  selectedProfile.current = profile;

  useEffect(() => {
    if (!joined) return;
    let active = true;
    let unsubscribe = () => {};
    const connection = acquireBattle(roomId, selectedProfile.current);
    void connection.promise
      .then((room) => {
        if (!active) return;
        setSessionId(room.sessionId);
        setConnected(true);
        bridge.current.sessionId = room.sessionId;
        bridge.current.connected = true;
        let sequence = 0;
        bridge.current.fire = (action) => room.send("fire", action);
        bridge.current.move = (direction) =>
          room.send("move", {
            direction,
            sequence: ++sequence,
            turnNumber: bridge.current.state?.turnNumber,
          });
        for (const action of ["jump", "ability"] as const)
          bridge.current[action] = (direction?: -1 | 0 | 1) =>
            room.send(action, {
              turnNumber: bridge.current.state?.turnNumber,
              direction:
                action === "jump" ? (direction ?? 0) : bridge.current.direction,
            });
        restart.current = () =>
          room.send("restart", {
            turnNumber: bridge.current.state?.turnNumber,
          });
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
  }, [roomId, joined]);

  async function copyInvite() {
    const url = invitePath
      ? new URL(invitePath, window.location.origin).href
      : window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setManualLink("");
    } catch {
      setManualLink(url);
    }
  }

  const canRestart =
    state?.phase === "finished" &&
    state.players[0]?.sessionId === sessionId &&
    state.players.every((p) => p.connected);
  if (joined === null)
    return <main className="mx-auto max-w-lg px-5 py-12">Opening arena…</main>;
  if (!joined)
    return (
      <main className="mx-auto max-w-lg px-5 py-12">
        <Link href="/" className="brand">
          CRAFT <span>ONES</span>
        </Link>
        <h1 className="my-6 text-3xl font-black">Join the rivalry</h1>
        <SeatPicker
          label="Your critter"
          seat="two"
          value={profile}
          onChange={setProfile}
        />
        <button
          type="button"
          className="primary-button mt-6 w-full"
          onClick={() => setJoined(true)}
        >
          Join Game
        </button>
      </main>
    );
  return (
    <main className="game-shell mx-auto min-h-svh max-w-6xl px-3 py-5 sm:px-8">
      <header className="game-header">
        <Link href="/" className="brand">
          CRAFT <span>ONES</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-xs text-[#a9b7a5] sm:inline">
            Room {roomId}
          </span>
          <button
            type="button"
            className="secondary-button"
            onClick={copyInvite}
          >
            {copied ? "Link copied" : "Copy Invite Link"}
          </button>
        </div>
      </header>
      {manualLink ? (
        <label className="mb-4 block text-xs">
          Copy this invite URL
          <input
            aria-label="Invite link"
            readOnly
            value={manualLink}
            onFocus={(event) => event.target.select()}
            className="mt-2 w-full rounded border border-white/20 p-3"
          />
        </label>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-[#ffae9d]/10 p-4 text-sm text-[#ffae9d]"
        >
          {error}{" "}
          <Link href="/" className="underline">
            Back to home
          </Link>
        </div>
      ) : null}
      <BattlePanel
        state={state}
        sessionId={sessionId}
        connected={connected}
        bridge={bridge}
        power={power}
        restart={canRestart ? () => restart.current() : undefined}
      />
    </main>
  );
}
