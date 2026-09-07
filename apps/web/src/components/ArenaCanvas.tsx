"use client";

import { ARENA } from "@craft-ones/shared";
import * as Phaser from "phaser";
import { type RefObject, useEffect, useRef } from "react";
import { ArenaScene, type GameBridge } from "../game/ArenaScene";

export default function ArenaCanvas({
  bridge,
}: {
  bridge: RefObject<GameBridge>;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: ARENA.width,
      height: ARENA.height,
      backgroundColor: "#1c261e",
      scene: new ArenaScene(bridge.current),
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true },
      input: { activePointers: 1 },
      banner: false,
      audio: { noAudio: true },
    });
    return () => game.destroy(true);
  }, [bridge]);

  return <div ref={host} className="game-canvas aspect-[16/9] w-full" />;
}
