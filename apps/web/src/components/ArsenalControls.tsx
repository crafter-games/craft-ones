"use client";
import {
  ABILITIES,
  type BattleView,
  CHARACTERS,
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
  const [weapon, setWeapon] = useState<WeaponId>("rocket");
  const [focus, setFocus] = useState(false);
  const me = state?.players.find(
    (p) => p.sessionId === bridge.current.sessionId,
  );
  const ability = me ? ABILITIES[me.species] : null;
  const cooldown = me
    ? Math.max(
        0,
        Math.ceil((me.abilityReadyTurn - (state?.turnNumber ?? 0)) / 2),
      )
    : 0;
  const shieldActive = me?.species === "ronsoco" && me.shield > 0;
  const abilityStatus = shieldActive
    ? "Shield active"
    : cooldown
      ? `${cooldown} turn${cooldown === 1 ? "" : "s"} cooldown`
      : "1 turn";
  return (
    <div className="arsenal">
      <fieldset
        className={`arsenal-weapons ${ability ? "has-ability" : ""}`}
        aria-label="Arsenal"
      >
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
        {ability && me ? (
          <button
            type="button"
            className="weapon-card species-ability"
            data-testid="character-ability"
            aria-label={`${ability.name} · ${abilityStatus}`}
            title={ability.description}
            disabled={disabled || cooldown > 0 || shieldActive}
            onClick={() => bridge.current.ability()}
          >
            <Image
              src={`/art/${me.species}/${me.coat}/portrait.svg`}
              alt=""
              width={38}
              height={40}
            />
            <span>
              <small>{CHARACTERS[me.species].name} exclusive</small>
              {ability.name}
              <small>{abilityStatus}</small>
            </span>
          </button>
        ) : null}
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2">
        <div>
          <p className="text-[10px] text-[#b7c9b6]">
            {WEAPONS[weapon].description} · one action per turn
          </p>
          {me ? (
            <p className="ability-state">
              {ability
                ? `${ability.name}: ${ability.description}`
                : "Cuy · Standard loadout. No special ability."}
            </p>
          ) : null}
        </div>
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
  );
}
