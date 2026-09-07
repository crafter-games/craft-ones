"use client";
import { type RefObject, useEffect, useRef } from "react";
import type { GameBridge } from "../game/GameBridge";

export function MovementControls({
  bridge,
  disabled,
  budget,
  limited = false,
}: {
  bridge: RefObject<GameBridge>;
  disabled: boolean;
  budget: number;
  limited?: boolean;
}) {
  const heldDirection = useRef<-1 | 0 | 1>(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    heldDirection.current = 0;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => {
    if (limited && budget <= 0 && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, [budget, limited]);
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
  return (
    <div className="flex items-center gap-2">
      {([-1, 1] as const).map((direction) => (
        <button
          key={direction}
          type="button"
          aria-label={direction === -1 ? "Move left" : "Move right"}
          disabled={disabled || (limited && budget <= 0)}
          className="move-button"
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
      <button
        type="button"
        className="move-button jump-button"
        aria-label="Jump"
        title="W jumps; hold A or D for direction. Uses time, keeps your shot."
        disabled={disabled}
        onClick={() => bridge.current.jump(heldDirection.current)}
      >
        ↥ <span>Jump</span>
      </button>
      <span className="text-[10px] leading-tight text-[#b5bfb3]">
        {limited ? (
          <>
            Move{" "}
            <strong data-testid="movement-left">{Math.round(budget)}</strong>
          </>
        ) : (
          <>
            Move & jump
            <br />
            <strong className="text-[#d8dda5]">Keeps your shot</strong>
          </>
        )}
      </span>
    </div>
  );
}
