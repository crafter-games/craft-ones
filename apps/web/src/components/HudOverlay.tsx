"use client";
import {
  ARENA,
  type BattleView,
  CHARACTERS,
  type PlayableMapId,
  type PlayerView,
  WORLD_MAPS,
} from "@craft-ones/shared";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useState,
} from "react";
import type { GameBridge } from "../game/GameBridge";
import { Hotbar } from "./Hotbar";
import { TouchControls } from "./TouchControls";

const ArenaCanvas = dynamic(() => import("./ArenaCanvas"), {
  ssr: false,
  loading: () => (
    <div className="game-canvas grid place-items-center text-[#3b2b38]">
      Waking up the critters…
    </div>
  ),
});

const SOUND_KEY = "craft-ones:sound";

export type InviteControls = {
  roomId: string;
  copied: boolean;
  manualLink: string;
  copy: () => void;
  label?: string;
};

function PlayerCard({
  player,
  number,
  you,
  side,
}: {
  player?: PlayerView;
  number: number;
  you: boolean;
  side: "left" | "right";
}) {
  const hp = player?.hp ?? 0;
  const shield = player?.shield ?? 0;
  return (
    <div
      className={`hud-card hud-panel is-${side}`}
      data-testid={`player-${number}`}
      data-hp={player?.hp ?? ""}
      data-x={player?.x ?? ""}
      data-y={player?.y ?? ""}
      data-movement={player?.movementLeft ?? ""}
      data-species={player?.species}
      data-coat={player?.coat}
    >
      {player ? (
        <Image
          className="hud-portrait"
          src={`/art/${player.species}/${player.coat}/portrait.svg`}
          alt=""
          width={56}
          height={58}
        />
      ) : (
        <span className="hud-portrait" />
      )}
      <div className="hud-card-body">
        <div className="hud-card-name">
          <span>{player ? CHARACTERS[player.species].name : "Player"}</span>
          <small>
            P{number}
            {you ? " · YOU" : player ? "" : " · WAITING"}
          </small>
        </div>
        <div className="hud-card-hp">
          {/* biome-ignore lint/a11y/useSemanticElements: health and shield render as two segments in one bar */}
          <div
            className="hud-bar"
            role="meter"
            aria-label={`Player ${number} health`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={hp}
          >
            <i style={{ width: `${hp}%` }} />
            {shield ? (
              <i
                className="is-shield"
                style={{ width: `${Math.min(shield, 100 - hp)}%` }}
              />
            ) : null}
          </div>
          <strong>{hp}</strong>
        </div>
        {shield ? (
          <p className="hud-shield">SHIELD +{shield} · IRON HIDE</p>
        ) : null}
      </div>
    </div>
  );
}

export function HudOverlay({
  state,
  sessionId,
  connected,
  bridge,
  power,
  local = false,
  restart,
  invite,
  labTools,
  setupDrawer,
  leave,
  error,
}: {
  state: BattleView | null;
  sessionId: string;
  connected: boolean;
  bridge: RefObject<GameBridge>;
  power: number;
  local?: boolean;
  restart?: () => void;
  invite?: InviteControls;
  labTools?: ReactNode;
  setupDrawer?: ReactNode;
  error?: string;
  leave?: () => void;
}) {
  const inviteId = useId();
  const [sound, setSound] = useState(true);
  const [focus, setFocus] = useState(false);
  const [menu, setMenu] = useState(false);
  const [setup, setSetup] = useState(false);
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(SOUND_KEY);
    } catch {
      stored = null;
    }
    const enabled = stored !== "off";
    setSound(enabled);
    bridge.current.sound = enabled;
  }, [bridge]);
  const current = state?.players.find(
    (p) => p.sessionId === state.currentPlayer,
  );
  const winner = state?.players.find((p) => p.sessionId === state.winner);
  const aiming = state?.phase === "aiming",
    finished = state?.phase === "finished",
    waiting = state?.phase === "waiting";
  const myTurn = current?.sessionId === sessionId;
  const charging = power > 0;
  const urgent = aiming && !charging && (state?.remainingMs ?? 0) < 5000;
  const locked = !aiming || !myTurn || !connected || charging || menu || setup;
  const result = finished ? (winner ? "win" : "draw") : null;
  const forfeit = finished && state?.finishReason === "forfeit";
  const blocked = !!error && !state;
  // A modal owns the pointer: the arena stops aiming underneath it.
  const modal = menu || setup || waiting || finished || !state;
  useEffect(() => {
    bridge.current.suspended = modal;
    bridge.current.paused = local && (menu || setup);
  }, [bridge, modal, local, menu, setup]);
  useEffect(() => {
    if (!menu && !setup) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenu(false);
      setSetup(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, setup]);
  const status = !state
    ? "Loading arena…"
    : waiting
      ? "Waiting for another player…"
      : finished
        ? winner
          ? `Player ${winner.number} wins!`
          : "It's a draw!"
        : aiming
          ? charging
            ? "Charging… release to fire"
            : local
              ? `${current ? CHARACTERS[current.species].name : "Player"}'s turn. Let it fly!`
              : myTurn
                ? "Your turn. Make it count."
                : `Player ${current?.number}'s turn · wait`
          : state.phase === "flying"
            ? `${state.projectile.kind === "grapple" ? "Hook" : "Projectile"} in flight…`
            : state.phase === "grappling"
              ? "Hold tight!"
              : state.phase === "resolving"
                ? "Making a move…"
                : "Impact!";
  const seconds = Math.ceil((state?.remainingMs ?? 0) / 1000);
  const mapName = WORLD_MAPS[state?.mapId as PlayableMapId]?.name ?? "Flatland";
  const round = Math.max(1, state?.roundNumber ?? 1);
  const wind = state?.wind ?? 0;
  const windDirection = wind < 0 ? "LEFT" : wind > 0 ? "RIGHT" : "CALM";
  const windArrow = wind < 0 ? "←" : wind > 0 ? "→" : "·";
  const windStrength =
    Math.abs(wind) >= 45 ? "STRONG" : Math.abs(wind) >= 20 ? "BREEZE" : "LIGHT";
  const setSoundOn = (next: boolean) => {
    setSound(next);
    bridge.current.sound = next;
    try {
      localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {
      // A browser with storage switched off simply forgets the choice.
    }
  };
  const setFocusOn = (next: boolean) => {
    setFocus(next);
    bridge.current.focus = next;
  };
  return (
    <main
      className="arena"
      data-testid="battle"
      data-phase={state?.phase ?? "connecting"}
      data-projectile-kind={state?.projectile.kind ?? ""}
      data-turn={state?.turnNumber ?? 0}
      data-current-player={current?.number ?? 0}
      data-connected={connected}
      data-map={state?.mapId ?? ""}
      data-explosion={state?.explosion.id ?? 0}
      data-terrain-revision={state?.terrainRevision ?? 0}
      data-remaining={aiming ? seconds : 0}
      data-sound={sound ? "on" : "off"}
    >
      <ArenaCanvas bridge={bridge} />
      <div className="hud">
        <PlayerCard
          number={1}
          side="left"
          player={state?.players[0]}
          you={!local && state?.players[0]?.sessionId === sessionId}
        />
        <PlayerCard
          number={2}
          side="right"
          player={state?.players[1]}
          you={!local && state?.players[1]?.sessionId === sessionId}
        />
        <div className="hud-centre">
          <div className={`hud-clock hud-panel ${urgent ? "is-urgent" : ""}`}>
            <span>
              <b data-testid="turn-timer">
                {aiming
                  ? charging
                    ? "··"
                    : seconds.toString().padStart(2, "0")
                  : "—"}
              </b>
              <i>{charging ? "HOLD" : "SEC"}</i>
            </span>
            <small>
              ROUND {round}
              <span className="hud-map-name"> · {mapName}</span>
            </small>
            <p
              className="hud-wind"
              data-testid="wind-indicator"
              data-wind={wind}
            >
              <span className="sr-only">
                {wind === 0
                  ? "Wind calm"
                  : `Wind ${windDirection.toLowerCase()}, ${windStrength.toLowerCase()}`}
              </span>
              <span aria-hidden="true">
                WIND <i>{windArrow}</i> {wind === 0 ? "CALM" : windStrength}
              </span>
            </p>
          </div>
          <p
            className="hud-status hud-panel"
            data-testid="match-status"
            aria-live="polite"
            data-tone={
              urgent ? "urgent" : myTurn && aiming ? "active" : "neutral"
            }
          >
            {status}
          </p>
        </div>
        <div className="hud-utilities">
          <button
            type="button"
            className="hud-chip"
            data-testid="sound-toggle"
            aria-pressed={sound}
            aria-label={sound ? "Mute sound" : "Unmute sound"}
            onClick={() => setSoundOn(!sound)}
          >
            {sound ? "SOUND ON" : "SOUND OFF"}
          </button>
          <button
            type="button"
            className="hud-chip hud-chip-focus"
            aria-pressed={focus}
            aria-label="Camera focus"
            onClick={() => setFocusOn(!focus)}
          >
            {focus ? "FOCUS" : "MAP"}
          </button>
          <button
            type="button"
            className="hud-chip"
            aria-label="Menu"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
          >
            MENU
          </button>
        </div>
        <div className="hud-movement">
          <TouchControls
            bridge={bridge}
            disabled={locked}
            budget={current?.movementLeft ?? 0}
            home={
              current
                ? (Math.sign(current.originX - current.x) as -1 | 0 | 1)
                : 0
            }
          />
        </div>
        <Hotbar bridge={bridge} state={state} disabled={locked} local={local} />
        <div className="hud-power hud-panel">
          <div>
            <span>POWER{charging ? <i> · CHARGING</i> : null}</span>
            <strong aria-hidden="true">
              {power === 0
                ? "READY"
                : power < 34
                  ? "LOW"
                  : power < 67
                    ? "MID"
                    : "HIGH"}
            </strong>
          </div>
          {/* biome-ignore lint/a11y/useSemanticElements: a <meter> cannot carry the HUD's flat segmented styling */}
          <div
            className="hud-bar"
            id="power"
            role="meter"
            aria-label="Shot power"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={power}
            data-value={power}
          >
            <i
              style={{
                width: `${power}%`,
                background: charging ? "#d2fb78" : "#526a53",
              }}
            />
          </div>
        </div>
      </div>
      {blocked || waiting || finished || !state ? (
        <div className="hud-scrim" role="dialog" aria-modal="true">
          <div className="hud-modal">
            <p className="hud-kicker">
              {blocked || forfeit
                ? "MATCH OVER"
                : finished
                  ? "THAT’S A WRAP!"
                  : "BRING A FRIEND"}
            </p>
            <h2>
              {blocked
                ? "This room is closed"
                : forfeit
                  ? "Your opponent left"
                  : status}
            </h2>
            <p className="hud-modal-body" role={blocked ? "alert" : undefined}>
              {blocked
                ? error
                : finished
                  ? forfeit
                    ? "Your rival disconnected. This room is closed."
                    : result === "draw"
                      ? "Both critters went down together. Nobody brags today."
                      : "Small paws. Big bragging rights."
                  : "Send the invite. The match starts the moment they pick a critter."}
            </p>
            {waiting && invite && !blocked ? (
              <>
                <div className="hud-invite">
                  {!invite.label ? (
                    <input
                      id={inviteId}
                      aria-label="Invite link"
                      readOnly
                      value={
                        invite.manualLink ||
                        (typeof window === "undefined"
                          ? ""
                          : window.location.href)
                      }
                      onFocus={(event) => event.target.select()}
                    />
                  ) : null}
                  <button
                    type="button"
                    className="cta gold"
                    onClick={invite.copy}
                  >
                    {invite.label ??
                      (invite.copied ? "Link copied" : "Copy Invite Link")}
                  </button>
                </div>
                <p className="hud-room">
                  <i aria-hidden="true" />
                  ROOM OPEN · {mapName}
                </p>
              </>
            ) : null}
            {finished && restart ? (
              <button type="button" className="cta gold" onClick={restart}>
                Play again
              </button>
            ) : finished ? (
              <p className="hud-foot">
                {forfeit
                  ? leave
                    ? "Close the Activity together and start a new one."
                    : "Create a new game from home."
                  : "Waiting for Player 1 to restart."}
              </p>
            ) : null}
            {blocked || forfeit ? (
              leave ? (
                <button type="button" onClick={leave}>
                  Leave Discord Activity
                </button>
              ) : (
                <Link href="/" className="hud-home">
                  Back to home
                </Link>
              )
            ) : null}
          </div>
        </div>
      ) : null}
      {menu ? (
        <div
          className="hud-scrim"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div className="hud-modal is-menu">
            <div className="hud-menu-head">
              <h2>{local ? "Paused" : "Menu"}</h2>
              <span>
                {local
                  ? "LOCAL · 2 SEATS"
                  : `ROOM ${invite?.roomId ?? ""} · MATCH CONTINUES`}
              </span>
            </div>
            <div className="hud-menu-list">
              <button
                type="button"
                className="hud-row"
                aria-pressed={sound}
                onClick={() => setSoundOn(!sound)}
              >
                <span>Sound</span>
                <i>{sound ? "ON" : "OFF"}</i>
              </button>
              <div className="hud-segmented">
                <button
                  type="button"
                  aria-pressed={focus}
                  onClick={() => setFocusOn(true)}
                >
                  Focus character
                </button>
                <button
                  type="button"
                  aria-pressed={!focus}
                  onClick={() => setFocusOn(false)}
                >
                  View whole map
                </button>
              </div>
              {setupDrawer ? (
                <button
                  type="button"
                  className="hud-row"
                  onClick={() => {
                    setMenu(false);
                    setSetup(true);
                  }}
                >
                  <span>Match setup</span>
                  <i>Map · critters · coats →</i>
                </button>
              ) : null}
              {labTools}
              {invite ? (
                <button type="button" className="hud-row" onClick={invite.copy}>
                  <span>
                    {invite.label ??
                      (invite.copied ? "Link copied" : "Copy invite link")}
                  </span>
                  <i>room {invite.roomId}</i>
                </button>
              ) : null}
              {restart ? (
                <button
                  type="button"
                  className="hud-row is-danger"
                  onClick={() => {
                    setMenu(false);
                    restart();
                  }}
                >
                  <span>Restart match</span>
                  <i>terrain resets</i>
                </button>
              ) : null}
            </div>
            <div className="hud-menu-foot">
              <button
                type="button"
                className="cta gold"
                onClick={() => setMenu(false)}
              >
                Resume
              </button>
              {leave ? (
                <button type="button" onClick={leave}>
                  Leave Discord Activity
                </button>
              ) : (
                <Link href="/">Leave</Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {setup && setupDrawer ? (
        <div className="hud-drawer-scrim">
          <aside
            className="hud-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Match setup"
          >
            <div className="hud-menu-head">
              <h2>Match setup</h2>
              <button
                type="button"
                className="hud-close"
                aria-label="Close"
                onClick={() => setSetup(false)}
              >
                ×
              </button>
            </div>
            <p className="hud-drawer-note">
              The arena stays visible on the left. Changes restart the match.
            </p>
            {setupDrawer}
            <button
              type="button"
              className="cta gold"
              onClick={() => setSetup(false)}
            >
              Back to the match
            </button>
          </aside>
        </div>
      ) : null}
      {error && !blocked ? (
        <p className="hud-alert hud-panel" role="alert">
          {error}
        </p>
      ) : null}
      <p className="hud-keys">
        A D move · W jump · ← → aim · hold Space · 1–7 tools
        {local ? " · you control both critters" : ""}
        {" · "}
        {ARENA.turnMs / 1000}s turns
      </p>
    </main>
  );
}
