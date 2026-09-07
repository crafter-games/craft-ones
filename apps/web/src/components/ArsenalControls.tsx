"use client";
import {
  ABILITIES,
  type BattleView,
  WEAPONS,
  type WeaponId,
} from "@craft-ones/shared";
import { type RefObject, useState } from "react";
import type { GameBridge } from "../game/GameBridge";

function WeaponIcon({ kind }: { kind: WeaponId }) {
  const paths = {
    rocket: (
      <>
        <path d="M7 13h18l7 7-7 7H7Z" fill="#c4dbcb" />
        <path d="m25 13 7 7-7 7Z" fill="#e99170" />
        <path d="m6 16-5 4 5 4" fill="#f0c576" />
      </>
    ),
    grenade: (
      <>
        <circle cx="20" cy="23" r="11" fill="#8aa266" />
        <path d="M16 12V8h9l2 7M11 23h18M20 13v20" fill="none" />
      </>
    ),
    mortar: (
      <>
        <path d="M10 27 22 8l9 6-12 19Z" fill="#b5a3c3" />
        <path d="m22 8 5-5 9 6-5 5M7 34h24" fill="#f0c576" />
      </>
    ),
    dynamite: (
      <>
        <path d="M6 13h25v18H6Z" fill="#d97965" />
        <path d="M15 13v18M22 13v18M6 22h25M28 13q8-4 3-9" fill="none" />
      </>
    ),
    grapple: (
      <>
        <path d="M8 34 27 10M27 10 15 11M27 10l-1 13M27 10l6-7" fill="none" />
        <path d="m8 34-5-5 8-8 5 5Z" fill="#dcb784" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 40 40" width="32" height="32" aria-hidden="true">
      <g
        stroke="#343b39"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths[kind]}
      </g>
    </svg>
  );
}
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
            <WeaponIcon kind={id} />
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
              (me?.species === "cuy" && me.hp === 100)
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
