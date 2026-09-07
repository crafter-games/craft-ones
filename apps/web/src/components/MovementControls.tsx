"use client";
import { type RefObject, useEffect, useRef } from "react";
import type { GameBridge } from "../game/GameBridge";

export function MovementControls({
  bridge,
  disabled,
  budget,
}: {
  bridge: RefObject<GameBridge>;
  disabled: boolean;
  budget: number;
}) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => {
    if (budget <= 0 && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, [budget]);
  useEffect(() => {
    if (disabled && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    const cancel = () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
    window.addEventListener("blur", cancel);
    return () => {
      cancel();
      window.removeEventListener("blur", cancel);
    };
  }, [disabled]);
  return (
    <div className="flex items-center gap-2">
      {([-1, 1] as const).map((direction) => (
        <button
          key={direction}
          type="button"
          aria-label={direction === -1 ? "Move left" : "Move right"}
          disabled={disabled || budget <= 0}
          className="move-button"
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            stop();
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
      <span className="text-xs text-[#b5bfb3]">
        Move{" "}
        <strong className="text-[#f2dc9e]" data-testid="movement-left">
          {Math.round(budget)}
        </strong>
      </span>
    </div>
  );
}
