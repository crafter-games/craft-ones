"use client";

import * as Phaser from "phaser";
import { type RefObject, useEffect, useRef, useState } from "react";
import { ArenaScene, type GameBridge } from "../game/ArenaScene";

function rendererType() {
  const probe = document.createElement("canvas");
  const gl = probe.getContext("webgl", { failIfMajorPerformanceCaveat: true });
  if (!gl) return Phaser.CANVAS;
  try {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info
      ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
      : "";
    return /swiftshader|llvmpipe|softpipe|software rasterizer/i.test(renderer)
      ? Phaser.CANVAS
      : Phaser.WEBGL;
  } finally {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

export default function ArenaCanvas({
  bridge,
}: {
  bridge: RefObject<GameBridge>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    parent.dataset.loadAttempt = String(attempt);
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
      if (game) {
        game.scale.resize(width, height);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.dataset.ready = "false";
      game = new Phaser.Game({
        canvas,
        type: rendererType(),
        parent,
        width,
        height,
        backgroundColor: "#1c261e",
        scene: new ArenaScene(bridge.current, () => {
          if (active) setLoadError(true);
        }),
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
      bridge.current.ready = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("orientationchange", fit);
      document.removeEventListener("visibilitychange", fit);
      if (game) {
        if (game.canvas) {
          game.canvas.dataset.ready = "false";
          game.canvas.remove();
        }
        game.destroy(true);
        game.loop.wake();
      }
    };
  }, [bridge, attempt]);

  return (
    <>
      <div ref={host} className="game-canvas" />
      {loadError && (
        <dialog
          ref={(dialog) => {
            if (dialog && !dialog.open) dialog.showModal();
          }}
          onCancel={(event) => event.preventDefault()}
          className="arena-load-error"
          role="alertdialog"
          aria-modal="true"
          aria-label="Arena load error"
        >
          <p>
            Some game art could not load. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={(event) => {
              event.currentTarget.closest("dialog")?.close();
              setLoadError(false);
              setAttempt((value) => value + 1);
            }}
          >
            Reload arena
          </button>
        </dialog>
      )}
    </>
  );
}
