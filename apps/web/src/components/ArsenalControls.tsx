"use client";
import {
  ABILITIES,
  type BattleView,
  WEAPONS,
  type WeaponId,
} from "@craft-ones/shared";
import Image from "next/image";
import { type RefObject, useState } from "react";
import type { GameBridge } from "../game/GameBridge";

export function ArsenalControls({
  bridge,
  state,
  disabled,
}: {
  bridge: RefObject<GameBridge>;
  state: BattleView | null;
  disabled: boolean;
}) {
  const [weapon, setWeapon] = useState<WeaponId>("rocket"),
    [focus, setFocus] = useState(false);
  const me = state?.players.find(
    (p) => p.sessionId === bridge.current.sessionId,
  );
  const ability = ABILITIES[me?.species ?? "cuy"];
  const cooldown = me
    ? Math.max(
        0,
        Math.ceil((me.abilityReadyTurn - (state?.turnNumber ?? 0)) / 2),
      )
    : 0;
  return (
    <div className="arsenal">
      <div className="arsenal-weapons">
        {(
          Object.entries(WEAPONS) as [WeaponId, (typeof WEAPONS)[WeaponId]][]
        ).map(([id, spec]) => (
          <button
            key={id}
            type="button"
            className="weapon-card"
            aria-pressed={weapon === id}
            disabled={disabled}
            onClick={() => {
              setWeapon(id);
              bridge.current.weapon = id;
            }}
            title={spec.description}
          >
            <Image
              src={`/art/weapons/${id}.svg`}
              alt=""
              width={48}
              height={36}
            />
            <span>{spec.name}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2">
        <p className="text-[10px] text-[#b7c9b6]">
          {WEAPONS[weapon].description} · one action per turn
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="tool-button ability-button"
            title={ability.description}
            disabled={
              disabled ||
              cooldown > 0 ||
              (me?.species === "cuy" && me.hp === 100) ||
              (me?.species === "ronsoco" && me.shield > 0)
            }
            onClick={() => bridge.current.ability()}
          >
            {ability.name}
            {cooldown ? ` · ${cooldown} turns` : " · 1 turn"}
          </button>
          <button
            type="button"
            aria-pressed={focus}
            className="tool-button"
            onClick={() => {
              setFocus(!focus);
              bridge.current.focus = !focus;
            }}
          >
            {focus ? "View whole map" : "Focus character"}
          </button>
        </div>
      </div>
    </div>
  );
}
