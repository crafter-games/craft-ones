"use client";
import {
  ABILITIES,
  CHARACTERS,
  COATS,
  type CoatId,
  PLAYABLE_MAP_IDS,
  type PlayableMapId,
  type PlayerOptions,
  SPECIES,
  WORLD_MAPS,
} from "@craft-ones/shared";
import Image from "next/image";

/** One seat: lineup, species tabs, coat swatches and the ability note. */
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
  const index = SPECIES.indexOf(value.species);
  const character = CHARACTERS[value.species];
  const ability = ABILITIES[value.species];
  const cycle = (direction: number) =>
    onChange({
      ...value,
      species: SPECIES[(index + direction + SPECIES.length) % SPECIES.length],
    });
  return (
    <fieldset className={`panel seat is-${seat}`}>
      <legend>{label}</legend>
      <div className="character-lineup" aria-hidden="true">
        <div className="lineup-stage" />
        {SPECIES.map((species, i) => {
          // Only the pick and its two neighbours are on stage; the rest wait.
          const slot = (i - index + SPECIES.length) % SPECIES.length;
          const place =
            slot === 0
              ? 0
              : slot === 1
                ? 1
                : slot === SPECIES.length - 1
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
          {String(SPECIES.length).padStart(2, "0")}
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
      <fieldset className="species-tabs" aria-label={`${label} character`}>
        {SPECIES.map((species) => (
          <button
            key={species}
            type="button"
            aria-pressed={value.species === species}
            onClick={() => onChange({ ...value, species })}
          >
            {CHARACTERS[species].name}
          </button>
        ))}
      </fieldset>
      <div className="seat-identity">
        <div aria-live="polite" aria-atomic="true">
          <span className="critter-role">
            {value.species === "cuy" ? "All-rounder" : character.role}
          </span>
          <span className="critter-name">{character.name}</span>{" "}
          <span className="critter-tagline">{character.tagline}</span>
        </div>
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
  return (
    <fieldset className="panel map-picker">
      <legend>Battleground</legend>
      <div className="map-list">
        {PLAYABLE_MAP_IDS.map((id) => (
          <button
            type="button"
            key={id}
            data-map-id={id}
            aria-pressed={value === id}
            className="map-card"
            onClick={() => onChange(id)}
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
      <p className="map-hint">swipe → {PLAYABLE_MAP_IDS.length} maps</p>
    </fieldset>
  );
}
