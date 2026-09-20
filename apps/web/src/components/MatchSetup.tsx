"use client";
import {
  ABILITIES,
  CHARACTERS,
  COATS,
  type CoatId,
  isExclusive,
  OPENING_SEATS,
  type OpeningSeat,
  PLAYABLE_MAP_IDS,
  type PlayableMapId,
  type PlayerOptions,
  SELECTABLE_SPECIES,
  type Species,
  WORLD_MAPS,
} from "@craft-ones/shared";
import Image from "next/image";
import { useRef, useState } from "react";

/** One seat: the roster lineup, coat swatches and the ability note. */
export function SeatPicker({
  value,
  onChange,
  label,
  seat = "one",
}: {
  value: PlayerOptions;
  onChange: (value: PlayerOptions) => void;
  label: string;
  seat?: "one" | "two";
}) {
  const index = (SELECTABLE_SPECIES as readonly Species[]).indexOf(
    value.species,
  );
  const character = CHARACTERS[value.species];
  const ability = ABILITIES[value.species];
  const cycle = (direction: number) =>
    onChange({
      ...value,
      species:
        SELECTABLE_SPECIES[
          (index + direction + SELECTABLE_SPECIES.length) %
            SELECTABLE_SPECIES.length
        ],
    });
  return (
    <fieldset className={`panel seat is-${seat}`}>
      <legend>{label}</legend>
      {isExclusive(value.species) ? (
        <p className="exclusive-bubble">
          <i aria-hidden="true" />
          Exclusive guest
        </p>
      ) : null}
      <div className="character-lineup" aria-hidden="true">
        <div className="lineup-stage" />
        {SELECTABLE_SPECIES.map((species, i) => {
          // Only the pick and its two neighbours are on stage; the rest wait.
          const slot =
            (i - index + SELECTABLE_SPECIES.length) % SELECTABLE_SPECIES.length;
          const place =
            slot === 0
              ? 0
              : slot === 1
                ? 1
                : slot === SELECTABLE_SPECIES.length - 1
                  ? -1
                  : 2;
          return (
            <div
              key={species}
              className={`lineup-critter ${place === 0 ? "is-selected" : ""} ${place === 2 ? "is-distant" : ""}`}
              style={{
                left: `${place === 0 ? 50 : place === 1 ? 83 : place === -1 ? 17 : 50}%`,
                zIndex: place === 0 ? 4 : place === 2 ? 1 : 2,
              }}
            >
              <Image
                src={`/art/${species}/${value.coat}/portrait.svg`}
                alt=""
                width={300}
                height={312}
                loading="eager"
                draggable={false}
              />
            </div>
          );
        })}
      </div>
      <div className="seat-nav">
        <button
          type="button"
          className="roster-arrow"
          aria-label="Previous character"
          onClick={() => cycle(-1)}
        >
          ‹
        </button>
        <span>
          {String(index + 1).padStart(2, "0")} /{" "}
          {String(SELECTABLE_SPECIES.length).padStart(2, "0")}
        </span>
        <button
          type="button"
          className="roster-arrow"
          aria-label="Next character"
          onClick={() => cycle(1)}
        >
          ›
        </button>
      </div>
      <div className="seat-identity">
        <div aria-live="polite" aria-atomic="true">
          <span className="critter-role">
            {value.species === "cuy" ? "All-rounder" : character.role}
          </span>
          <span className="critter-name">{character.name}</span>{" "}
          <span className="critter-tagline">{character.tagline}</span>
        </div>
        {isExclusive(value.species) ? (
          <span className="signature-look">Signature look</span>
        ) : (
          <fieldset className="coat-options" aria-label={`${label} coat color`}>
            {(Object.entries(COATS) as [CoatId, (typeof COATS)[CoatId]][]).map(
              ([coat, palette]) => (
                <button
                  key={coat}
                  type="button"
                  title={palette.name}
                  aria-label={`${label}: ${palette.name}`}
                  aria-pressed={coat === value.coat}
                  className="coat-swatch"
                  style={{ background: palette.fur }}
                  onClick={() => onChange({ ...value, coat })}
                />
              ),
            )}
          </fieldset>
        )}
      </div>
      <div className="ability-note">
        <span>{ability ? "UNIQUE ABILITY · 1 TURN" : "STANDARD LOADOUT"}</span>
        <p>
          <strong>{ability?.name ?? "No special ability"}</strong>{" "}
          {ability?.description ??
            "Six shared tools. Win with aim, movement and timing."}
        </p>
      </div>
    </fieldset>
  );
}

export function MapPicker({
  value,
  onChange,
}: {
  value: PlayableMapId;
  onChange: (id: PlayableMapId) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [surpriseId, setSurpriseId] = useState<PlayableMapId | null>(null);

  const pickRandom = () => {
    const others = PLAYABLE_MAP_IDS.filter((id) => id !== value);
    const next = others[Math.floor(Math.random() * others.length)] ?? value;
    onChange(next);
    setSurpriseId(next);
    requestAnimationFrame(() => {
      const card = listRef.current?.querySelector<HTMLButtonElement>(
        `[data-map-id="${next}"]`,
      );
      card?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
      card?.focus({ preventScroll: true });
    });
  };

  return (
    <fieldset className="panel map-picker">
      <legend>Battleground</legend>
      <div className="map-list" ref={listRef}>
        {PLAYABLE_MAP_IDS.map((id) => (
          <button
            type="button"
            key={id}
            data-map-id={id}
            aria-pressed={value === id}
            className={`map-card${surpriseId === id ? " is-surprise" : ""}`}
            onClick={() => onChange(id)}
            onAnimationEnd={() => {
              if (surpriseId === id) setSurpriseId(null);
            }}
          >
            <Image
              src={`/art/maps/${id}-preview.svg`}
              alt=""
              width={280}
              height={160}
            />
            <span>
              <strong>{WORLD_MAPS[id].name}</strong>
              <small>{WORLD_MAPS[id].subtitle}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="map-picker-foot">
        <p className="map-tip" aria-live="polite">
          {WORLD_MAPS[value].tip}
        </p>
        <button
          type="button"
          className="map-random"
          data-map-random=""
          onClick={pickRandom}
        >
          Surprise me
        </button>
      </div>
    </fieldset>
  );
}

const OPENING_LABELS: Record<OpeningSeat, string> = {
  host: "Host first",
  guest: "Guest first",
  random: "Coin flip",
};

/** Who takes the first aiming turn — fair rules, no handicaps. */
export function OpeningSeatPicker({
  value,
  onChange,
  hostLabel = "Host first",
  guestLabel = "Guest first",
}: {
  value: OpeningSeat;
  onChange: (value: OpeningSeat) => void;
  hostLabel?: string;
  guestLabel?: string;
}) {
  const labels = {
    host: hostLabel,
    guest: guestLabel,
    random: OPENING_LABELS.random,
  };
  return (
    <fieldset className="panel opening-picker">
      <legend>Who starts</legend>
      <div className="opening-options">
        {OPENING_SEATS.map((seat) => (
          <button
            type="button"
            key={seat}
            data-opening-seat={seat}
            aria-pressed={value === seat}
            className="opening-option"
            onClick={() => onChange(seat)}
          >
            {labels[seat]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
