"use client";
import { ARENA } from "@craft-ones/shared";
import { type RefObject, useEffect, useRef } from "react";
import type { GameBridge } from "../game/GameBridge";

/** Walk, jump and the range left, as hold buttons anchored to the thumbs. */
export function TouchControls({
  bridge,
  disabled,
  budget,
  home,
}: {
  bridge: RefObject<GameBridge>;
  disabled: boolean;
  budget: number;
  /** The way back to where the turn began, which always has range to spare. */
  home: -1 | 0 | 1;
}) {
  const heldDirection = useRef<-1 | 0 | 1>(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    heldDirection.current = 0;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => {
    if (budget <= 0 && heldDirection.current !== home && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, [budget, home]);
  useEffect(() => {
    if (disabled && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
      heldDirection.current = 0;
    }
    const cancel = () => {
      heldDirection.current = 0;
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
    window.addEventListener("blur", cancel);
    return () => {
      cancel();
      window.removeEventListener("blur", cancel);
    };
  }, [disabled]);
  const percent = Math.round((budget / ARENA.moveBudget) * 100);
  return (
    <>
      <div className="hud-range hud-panel">
        <div>
          <span>RANGE</span>
          <strong data-testid="movement-left">
            {Math.ceil(budget)} / {ARENA.moveBudget}
          </strong>
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: a <meter> cannot carry the HUD's flat segmented styling */}
        <div
          className="hud-bar"
          role="meter"
          aria-label="Range remaining"
          aria-valuemin={0}
          aria-valuemax={ARENA.moveBudget}
          aria-valuenow={Math.ceil(budget)}
        >
          <i style={{ width: `${percent}%`, background: "#d2fb78" }} />
        </div>
      </div>
      <div className="hud-walk">
        {([-1, 1] as const).map((direction) => (
          <button
            key={direction}
            type="button"
            aria-label={direction === -1 ? "Move left" : "Move right"}
            disabled={disabled || (budget <= 0 && direction !== home)}
            className="hud-hold"
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              stop();
              heldDirection.current = direction;
              bridge.current.move(direction);
              timer.current = setInterval(
                () => bridge.current.move(direction),
                100,
              );
            }}
            onPointerUp={stop}
            onPointerCancel={stop}
            onLostPointerCapture={stop}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                bridge.current.move(direction);
              }
            }}
          >
            {direction === -1 ? "←" : "→"}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="hud-hold hud-jump"
        aria-label="Jump"
        title="W jumps; A/D sets direction. Jumps are free and stay inside your range. Keeps your shot."
        disabled={disabled}
        onPointerDown={(event) => {
          event.preventDefault();
          bridge.current.jump(
            heldDirection.current || bridge.current.movementDirection,
          );
        }}
        onClick={(event) => {
          if (event.detail === 0)
            bridge.current.jump(
              heldDirection.current || bridge.current.movementDirection,
            );
        }}
      >
        <span aria-hidden="true">↥</span>JUMP
      </button>
    </>
  );
}
