"use client";
import { ARENA } from "@craft-ones/shared";
import { type RefObject, useEffect, useRef } from "react";
import type { GameBridge } from "../game/GameBridge";

export function MovementControls({
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
  return (
    <div className="flex items-center gap-2">
      {([-1, 1] as const).map((direction) => (
        <button
          key={direction}
          type="button"
          aria-label={direction === -1 ? "Move left" : "Move right"}
          disabled={disabled || (budget <= 0 && direction !== home)}
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
        title={`W jumps; A/D sets direction. Jump spends ${ARENA.jumpCost} of your range for good. Keeps your shot.`}
        disabled={disabled || budget < ARENA.jumpCost}
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
        ↥ <span>Jump</span>
      </button>
      <div className="min-w-24 flex-1 text-[10px] leading-tight text-[#b5bfb3]">
        <div className="mb-1 flex justify-between gap-2">
          <span>RANGE</span>
          <strong data-testid="movement-left">
            {Math.ceil(budget)} / {ARENA.moveBudget}
          </strong>
        </div>
        <meter
          aria-label="Range remaining"
          min={0}
          max={ARENA.moveBudget}
          value={budget}
          className="block h-2 w-full"
        />
        <span className="mt-1 block">
          {budget <= 0
            ? "At the edge · walk back to refill"
            : `Range from where your turn began · jump costs ${ARENA.jumpCost}`}
        </span>
      </div>
    </div>
  );
}
