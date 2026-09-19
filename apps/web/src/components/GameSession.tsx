"use client";

import {
  type BattleView,
  CHARACTERS,
  PLAYABLE_MAP_IDS,
  type PlayableMapId,
  type PlayerOptions,
  validPlayerOptions,
  WORLD_MAPS,
} from "@craft-ones/shared";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createBridge } from "../game/GameBridge";
import { acquireBattle, hasBattle } from "../lib/connection";
import { useActionNotice } from "../lib/useActionNotice";
import { Brand } from "./Brand";
import { HudOverlay } from "./HudOverlay";
import { SeatPicker } from "./MatchSetup";

export default function GameSession({
  roomId,
  invitePath,
  platform,
}: {
  roomId: string;
  invitePath?: string;
  platform?: { invite: () => Promise<void>; leave: () => void };
}) {
  const [state, setState] = useState<BattleView | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const { message: actionNotice, notice } = useActionNotice(
    `${roomId}:${state?.turnNumber ?? 0}`,
  );
  const [power, setPower] = useState(0);
  const [copied, setCopied] = useState(false);
  const [manualLink, setManualLink] = useState("");
  const bridge = useRef(createBridge(setPower));
  const restart = useRef(() => {});
  const [joined, setJoined] = useState<boolean | null>(null);
  // The host stamps its critter and map on the invite so the guest sees them.
  const [invited, setInvited] = useState<{
    host: PlayerOptions | null;
    mapId: PlayableMapId | null;
  }>({ host: null, mapId: null });
  useEffect(() => setJoined(hasBattle(roomId)), [roomId]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const host = {
      species: params.get("host"),
      coat: params.get("coat"),
    };
    setInvited({
      host: validPlayerOptions(host) ? host : null,
      mapId: PLAYABLE_MAP_IDS.find((id) => id === params.get("map")) ?? null,
    });
  }, []);
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
        bridge.current.jump = (direction = 0) =>
          room.send("jump", {
            turnNumber: bridge.current.state?.turnNumber,
            direction,
          });
        bridge.current.ability = (aim) =>
          room.send("ability", {
            turnNumber: bridge.current.state?.turnNumber,
            direction: aim
              ? Math.cos(aim.angle) >= 0
                ? 1
                : -1
              : bridge.current.direction,
            ...aim,
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
          if (active) notice.report(message);
        });
        const offAccepted = room.onMessage("actionAccepted", () => {
          if (active) notice.clear();
        });
        unsubscribe = () => {
          room.onStateChange.remove(sync);
          room.onLeave.remove(onLeave);
          room.onError.remove(onError);
          offAction();
          offAccepted();
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
  }, [roomId, joined, notice]);

  async function copyInvite() {
    if (platform) {
      try {
        await platform.invite();
      } catch {
        setError(
          "Could not open Discord invites. Use the Activity invite button in Discord.",
        );
      }
      return;
    }
    const url = new URL(
      invitePath ?? window.location.pathname,
      window.location.origin,
    );
    const host = state?.players[0];
    if (host) {
      url.searchParams.set("host", host.species);
      url.searchParams.set("coat", host.coat);
    }
    if (state?.mapId) url.searchParams.set("map", state.mapId);
    try {
      await navigator.clipboard.writeText(url.href);
      setCopied(true);
      setManualLink("");
    } catch {
      setManualLink(url.href);
    }
  }

  const canRestart =
    state?.phase === "finished" &&
    state.players[0]?.sessionId === sessionId &&
    state.players.every((p) => p.connected);
  if (joined === null)
    return <main className="mx-auto max-w-lg px-5 py-12">Opening arena…</main>;
  if (!joined) {
    const { host } = invited;
    const map = invited.mapId ? WORLD_MAPS[invited.mapId] : null;
    return (
      <main className="lobby join">
        <header className="lobby-header">
          <Brand />
          <span className="font-mono text-xs text-[#a9b7a5]">
            room {roomId}
          </span>
        </header>
        <div className="join-body">
          <div className="join-intro">
            <p className="hero-kicker">You’ve been challenged</p>
            <h1 className="hero-title">
              Join the <span>rivalry.</span>
            </h1>
            <p className="host-card">
              {host ? (
                <Image
                  src={`/art/${host.species}/${host.coat}/portrait.svg`}
                  alt=""
                  width={60}
                  height={62}
                />
              ) : null}
              <span>
                {host ? (
                  <strong>{CHARACTERS[host.species].name}</strong>
                ) : (
                  "Your rival"
                )}{" "}
                is waiting
                {map ? (
                  <>
                    {" "}
                    in <b>{map.name}</b>
                  </>
                ) : null}
              </span>
            </p>
            <p className="hero-lead">
              Pick your critter and coat. The match starts the moment you join —
              15-second turns, 100 HP each.
            </p>
          </div>
          <SeatPicker
            label="Your critter"
            seat="two"
            value={profile}
            onChange={setProfile}
          />
          <div className="join-actions">
            <button
              type="button"
              className="cta gold"
              onClick={() => setJoined(true)}
            >
              Join Game
            </button>
          </div>
        </div>
      </main>
    );
  }
  return (
    <HudOverlay
      state={state}
      sessionId={sessionId}
      connected={connected}
      bridge={bridge}
      power={power}
      restart={canRestart ? () => restart.current() : undefined}
      invite={{
        roomId,
        copied,
        manualLink,
        copy: copyInvite,
        label: platform ? "Invite in Discord" : undefined,
      }}
      leave={platform?.leave}
      error={error}
      actionNotice={actionNotice}
    />
  );
}
