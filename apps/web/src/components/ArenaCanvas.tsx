"use client";

import * as Phaser from "phaser";
import { type RefObject, useEffect, useRef } from "react";
import type { HudInsets } from "../game/ArenaCamera";
import { ArenaScene, type GameBridge } from "../game/ArenaScene";

/** Edges the fixed HUD covers at this size, in CSS pixels. */
function hudInsets(): HudInsets {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  document.body.append(probe);
  const style = getComputedStyle(probe);
  const safe = {
    top: Number.parseFloat(style.paddingTop) || 0,
    right: Number.parseFloat(style.paddingRight) || 0,
    bottom: Number.parseFloat(style.paddingBottom) || 0,
    left: Number.parseFloat(style.paddingLeft) || 0,
  };
  probe.remove();
  if (window.innerHeight < 600 && window.innerWidth > window.innerHeight)
    return {
      top: 104,
      bottom: 116,
      left: 150 + safe.left,
      right: 150 + safe.right,
    };
  if (window.innerWidth < 640)
    return {
      top: 172 + safe.top,
      bottom: 300 + safe.bottom,
      left: 0,
      right: 0,
    };
  return { top: 150, bottom: 140, left: 0, right: 0 };
}

export default function ArenaCanvas({
  bridge,
}: {
  bridge: RefObject<GameBridge>;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    let active = true;
    bridge.current.ready = false;
    let game: Phaser.Game | null = null;
    // A hidden tab never lays the page out, and a zero-sized parent boots a
    // dead renderer: wait for the arena to have room before starting.
    const fit = () => {
      if (!active || document.hidden) return;
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      if (!width || !height) return;
      bridge.current.hudInsets = hudInsets();
      if (game) {
        game.scale.resize(width, height);
        return;
      }
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent,
        width,
        height,
        backgroundColor: "#1c261e",
        scene: new ArenaScene(bridge.current),
        // The arena fills the viewport and follows it; the HUD floats over it.
        scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
        render: { antialias: true },
        input: { activePointers: 1 },
        banner: false,
        audio: { noAudio: true },
      });
    };
    const observer = new ResizeObserver(fit);
    observer.observe(parent);
    const frame = requestAnimationFrame(fit);
    window.addEventListener("orientationchange", fit);
    document.addEventListener("visibilitychange", fit);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("orientationchange", fit);
      document.removeEventListener("visibilitychange", fit);
      if (game) {
        game.canvas?.remove();
        game.destroy(true);
        game.loop.wake();
      }
    };
  }, [bridge]);

  return <div ref={host} className="game-canvas" />;
}
