"use client";

import type {
  OpeningSeat,
  PlayableMapId,
  PlayerOptions,
} from "@craft-ones/shared";
import { useEffect, useRef, useState } from "react";
import { consumeDiscordReservation } from "../lib/connection";
import {
  closeDiscord,
  type DiscordSession,
  discordRequest,
  openDiscord,
} from "../lib/discord";
import { Brand } from "./Brand";
import GameSession from "./GameSession";
import { MapPicker, OpeningSeatPicker, SeatPicker } from "./MatchSetup";

export default function DiscordActivity() {
  const [session, setSession] = useState<DiscordSession | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [roomId, setRoomId] = useState("");
  const [mapId, setMapId] = useState<PlayableMapId>("andes");
  const [openingSeat, setOpeningSeat] = useState<OpeningSeat>("host");
  const [player, setPlayer] = useState<PlayerOptions>({
    species: "cuy",
    coat: "caramel",
  });
  const joining = useRef(false);
  useEffect(() => {
    let active = true;
    if (attempt > 0) closeDiscord();
    document.documentElement.classList.add("discord-activity");
    setError("");
    void openDiscord()
      .then((value) => {
        if (active) setSession(value);
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "Could not connect to Discord.",
          );
      });
    return () => {
      active = false;
      document.documentElement.classList.remove("discord-activity");
    };
  }, [attempt]);
  async function join() {
    if (!session || joining.current) return;
    joining.current = true;
    setBusy(true);
    setError("");
    try {
      const reservation = await discordRequest("session", {
        clientId: session.sdk.clientId,
        instanceId: session.sdk.instanceId,
        accessToken: session.accessToken,
        mapId,
        openingSeat,
        player,
      });
      setRoomId(await consumeDiscordReservation(reservation));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not join this arena.",
      );
    } finally {
      joining.current = false;
      setBusy(false);
    }
  }
  if (roomId && session)
    return (
      <GameSession
        roomId={roomId}
        platform={{
          invite: async () => {
            await session.sdk.commands.openInviteDialog();
          },
          leave: closeDiscord,
        }}
      />
    );
  return (
    <main className="lobby setup" data-testid="discord-setup">
      <header className="lobby-header">
        <Brand as="span" />
        <span className="pill">Discord · 2 players</span>
      </header>
      <div className="px-5 py-4">
        <h1 className="text-2xl font-bold">
          {session ? `Ready, ${session.name}?` : "Connecting to Discord…"}
        </h1>
        <p>
          Pick your critter. The first player chooses the world; your friend
          joins the same arena.
        </p>
      </div>
      {session ? (
        <>
          <div className="setup-body is-single">
            <SeatPicker
              label="Your critter"
              seat="one"
              value={player}
              onChange={setPlayer}
            />
            <MapPicker value={mapId} onChange={setMapId} />
            <OpeningSeatPicker
              value={openingSeat}
              onChange={setOpeningSeat}
            />
          </div>
          <footer className="setup-footer">
            <button type="button" className="cta dark" onClick={closeDiscord}>
              Leave
            </button>
            <button
              type="button"
              className="cta gold"
              disabled={busy}
              onClick={join}
            >
              {busy ? "Joining arena…" : "Join arena"}
            </button>
          </footer>
        </>
      ) : null}
      {error ? (
        <div className="p-5">
          <p role="alert">{error}</p>
          {!session ? (
            <button
              type="button"
              className="cta gold"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
