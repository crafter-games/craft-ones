"use client";
import {
  Battle,
  type BattleView,
  PLAYABLE_MAP_IDS,
  type PlayableMapId,
  type PlayerOptions,
  validPlayerOptions,
} from "@craft-ones/shared";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HudOverlay } from "../../components/HudOverlay";
import { MapPicker, SeatPicker } from "../../components/MatchSetup";
import { createBridge } from "../../game/GameBridge";

export default function Playground() {
  const search = useSearchParams();
  const initialProfile = {
    species: search.get("species"),
    coat: search.get("coat"),
  };
  const initialRival = {
    species: search.get("species2"),
    coat: search.get("coat2"),
  };
  const [mapId, setMapId] = useState<PlayableMapId>(
    PLAYABLE_MAP_IDS.find((id) => id === search.get("map")) ?? "andes",
  );
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<BattleView | null>(null);
  const [power, setPower] = useState(0);
  const [infiniteHp, setInfiniteHp] = useState(false);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [debug, setDebug] = useState(false);
  const [destructible, setDestructible] = useState(true);
  const [one, setOne] = useState<PlayerOptions>(
    validPlayerOptions(initialProfile)
      ? initialProfile
      : {
          species: "cuy",
          coat: "caramel",
        },
  );
  const [two, setTwo] = useState<PlayerOptions>(
    validPlayerOptions(initialRival)
      ? initialRival
      : {
          species: "llama",
          coat: "cream",
        },
  );
  const [error, setError] = useState("");
  const profiles = useRef({ one, two });
  profiles.current = { one, two };
  const battle = useRef<Battle | null>(null);
  const bridge = useRef(createBridge(setPower));
  const options = useRef({ infiniteHp, destructible });
  useEffect(() => {
    options.current = { infiniteHp, destructible };
    if (battle.current) {
      battle.current.infiniteHp = infiniteHp;
      battle.current.destructible = destructible;
    }
    bridge.current.showTrajectory = showTrajectory;
    bridge.current.debug = debug;
  }, [infiniteHp, destructible, showTrajectory, debug]);
  // One simulation, two local seats. No socket or server needed by this route.
  useEffect(() => {
    const engine = new Battle(undefined, mapId);
    engine.infiniteHp = options.current.infiniteHp;
    engine.destructible = options.current.destructible;
    engine.addPlayer("local-cuy", profiles.current.one);
    engine.addPlayer("local-llama", profiles.current.two);
    battle.current = engine;
    let sequence = 0;
    const sync = () => {
      const snapshot = engine.state.toJSON() as BattleView;
      bridge.current.state = snapshot;
      bridge.current.sessionId = engine.state.currentPlayer;
      setState(snapshot);
    };
    bridge.current.generation = revision;
    bridge.current.connected = true;
    bridge.current.fire = (action) => {
      setError(engine.fire(engine.state.currentPlayer, action) ?? "");
      sync();
    };
    bridge.current.move = (direction) => {
      engine.move(engine.state.currentPlayer, {
        direction,
        sequence: ++sequence,
        turnNumber: engine.state.turnNumber,
      });
      sync();
    };
    bridge.current.jump = (direction = 0) => {
      setError(
        engine.jump(engine.state.currentPlayer, {
          turnNumber: engine.state.turnNumber,
          direction,
        }) ?? "",
      );
      sync();
    };
    bridge.current.ability = (aim) => {
      setError(
        engine.ability(engine.state.currentPlayer, {
          turnNumber: engine.state.turnNumber,
          direction: bridge.current.direction,
          ...aim,
        }) ?? "",
      );
      sync();
    };
    setError("");
    sync();
    let previous = performance.now(),
      reported = previous;
    const timer = setInterval(() => {
      const now = performance.now();
      engine.step(now - previous);
      previous = now;
      bridge.current.state = engine.state.toJSON() as BattleView;
      bridge.current.sessionId = engine.state.currentPlayer;
      if (now - reported >= 40) {
        setState(bridge.current.state);
        reported = now;
      }
    }, 1000 / 60);
    return () => {
      clearInterval(timer);
      bridge.current.connected = false;
      battle.current = null;
    };
  }, [mapId, revision]);
  const reset = () => setRevision((value) => value + 1);
  const lab = (
    <fieldset className="hud-lab">
      <legend>LAB TOOLS</legend>
      <div>
        <label>
          <input
            type="checkbox"
            checked={infiniteHp}
            onChange={(e) => setInfiniteHp(e.target.checked)}
          />
          Infinite HP
        </label>
        <label>
          <input
            type="checkbox"
            checked={showTrajectory}
            onChange={(e) => setShowTrajectory(e.target.checked)}
          />
          Show trajectory
        </label>
        <label>
          <input
            type="checkbox"
            checked={debug}
            onChange={(e) => setDebug(e.target.checked)}
          />
          Show collisions
        </label>
        <label>
          <input
            type="checkbox"
            checked={destructible}
            onChange={(e) => setDestructible(e.target.checked)}
          />
          Destructible ground
        </label>
      </div>
    </fieldset>
  );
  // Changing a map or critter in the drawer starts a fresh match.
  const setup = (
    <>
      <MapPicker
        value={mapId}
        onChange={(id) => {
          setMapId(id);
          reset();
        }}
      />
      <SeatPicker
        value={one}
        seat="one"
        label="Player 1"
        onChange={(value) => {
          setOne(value);
          reset();
        }}
      />
      <SeatPicker
        value={two}
        seat="two"
        label="Player 2"
        onChange={(value) => {
          setTwo(value);
          reset();
        }}
      />
    </>
  );
  return (
    <HudOverlay
      state={state}
      sessionId={state?.currentPlayer ?? ""}
      connected={!!state}
      bridge={bridge}
      power={power}
      local
      restart={reset}
      labTools={lab}
      setupDrawer={setup}
      error={error}
    />
  );
}
