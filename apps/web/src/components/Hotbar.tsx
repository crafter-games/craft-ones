"use client";
import {
  ABILITIES,
  type BattleView,
  CHARACTERS,
  WEAPONS,
  type WeaponId,
} from "@craft-ones/shared";
import Image from "next/image";
import { type RefObject, useEffect, useState } from "react";
import type { GameBridge } from "../game/GameBridge";

const IDS = Object.keys(WEAPONS) as WeaponId[];

/** Six tools plus the species ability, with the label pill above them. */
export function Hotbar({
  bridge,
  state,
  disabled,
}: {
  bridge: RefObject<GameBridge>;
  state: BattleView | null;
  disabled: boolean;
}) {
  const [weapon, setWeapon] = useState<WeaponId>("rocket");
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
  // Keys 1–6 pick a tool, 7 spends the ability.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || disabled) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      const slot = Number(event.key);
      if (!Number.isInteger(slot) || slot < 1 || slot > 7) return;
      if (slot === 7) {
        if (ability && !cooldown && !shieldActive) bridge.current.ability();
        return;
      }
      const id = IDS[slot - 1];
      if (!id) return;
      setWeapon(id);
      bridge.current.weapon = id;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bridge, disabled, ability, cooldown, shieldActive]);
  return (
    <div className="hud-hotbar">
      <p className="hud-weapon-label hud-panel">
        <strong>{WEAPONS[weapon].name}</strong> · {WEAPONS[weapon].description}
        <span className="hud-hint">
          drag to aim · hold to charge · 1–7 pick
        </span>
      </p>
      <div className="hud-tiles hud-panel" role="toolbar" aria-label="Arsenal">
        {IDS.map((id, index) => (
          <button
            key={id}
            type="button"
            className="hud-tile"
            aria-pressed={weapon === id}
            aria-label={WEAPONS[id].name}
            disabled={disabled}
            onClick={() => {
              setWeapon(id);
              bridge.current.weapon = id;
            }}
            title={WEAPONS[id].description}
          >
            <Image
              src={`/art/weapons/${id}.svg`}
              alt=""
              width={40}
              height={30}
            />
            <b aria-hidden="true">{index + 1}</b>
          </button>
        ))}
        {ability && me ? (
          <>
            <span className="hud-tile-divider" aria-hidden="true" />
            <button
              type="button"
              className="hud-tile hud-ability"
              data-testid="character-ability"
              aria-label={`${ability.name} · ${abilityStatus}`}
              title={`${CHARACTERS[me.species].name} exclusive · ${ability.description}`}
              disabled={disabled || cooldown > 0 || shieldActive}
              onClick={() => bridge.current.ability()}
            >
              <Image
                src={`/art/${me.species}/${me.coat}/portrait.svg`}
                alt=""
                width={38}
                height={40}
              />
              <b aria-hidden="true">7</b>
              {cooldown ? (
                <i className="hud-badge" aria-hidden="true">
                  {cooldown}
                </i>
              ) : null}
              {shieldActive ? (
                <i className="hud-badge is-active" aria-hidden="true">
                  ACTIVE
                </i>
              ) : null}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
