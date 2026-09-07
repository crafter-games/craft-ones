"use client";
import { Battle, type BattleView, MAPS } from "@craft-ones/shared";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BattlePanel } from "../../components/BattlePanel";
import { createBridge } from "../../game/GameBridge";

export default function Playground() {
  const [mapId, setMapId] = useState<"andes" | "coast">("andes");
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<BattleView | null>(null);
  const [power, setPower] = useState(0);
  const [infiniteHp, setInfiniteHp] = useState(false);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [debug, setDebug] = useState(false);
  const [destructible, setDestructible] = useState(false);
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
    engine.addPlayer("local-cuy");
    engine.addPlayer("local-llama");
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
      engine.fire(engine.state.currentPlayer, action);
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
  return (
    <main className="game-shell mx-auto min-h-svh max-w-6xl px-3 py-5 sm:px-8">
      <header className="game-header">
        <Link href="/" className="brand">
          CRAFT <span>ONES</span>
        </Link>
        <span className="lab-badge">PLAYGROUND · LOCAL</span>
        <button type="button" onClick={reset} className="secondary-button">
          Restart
        </button>
      </header>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#b7c4b1]">
          Two critters. One keyboard. Endless rematches.
        </p>
        <label className="flex items-center gap-2 text-xs font-bold text-[#b7c4b1]">
          MAP
          <select
            aria-label="Map"
            value={mapId}
            onChange={(event) => {
              setMapId(event.target.value as "andes" | "coast");
              reset();
            }}
            className="map-select"
          >
            {Object.entries(MAPS).map(([id, map]) => (
              <option key={id} value={id}>
                {map.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <BattlePanel
        state={state}
        sessionId={state?.currentPlayer ?? ""}
        connected={!!state}
        bridge={bridge}
        power={power}
        local
        restart={reset}
      />
      <details className="lab-tools mt-6">
        <summary>
          Lab tools <span className="text-[#82947f]">/ quick experiments</span>
        </summary>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-4">
          <label>
            <input
              type="checkbox"
              checked={infiniteHp}
              onChange={(e) => setInfiniteHp(e.target.checked)}
            />{" "}
            Infinite HP
          </label>
          <label>
            <input
              type="checkbox"
              checked={showTrajectory}
              onChange={(e) => setShowTrajectory(e.target.checked)}
            />{" "}
            Show trajectory
          </label>
          <label>
            <input
              type="checkbox"
              checked={debug}
              onChange={(e) => setDebug(e.target.checked)}
            />{" "}
            Show collisions
          </label>
          <label>
            <input
              type="checkbox"
              checked={destructible}
              onChange={(e) => setDestructible(e.target.checked)}
            />{" "}
            Destructible ground
          </label>
          <a
            href="/art/character-reference.svg"
            target="_blank"
            rel="noreferrer"
            className="underline text-[#b7c4b1]"
          >
            Character sheet ↗
          </a>
        </div>
      </details>
    </main>
  );
}
