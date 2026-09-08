"use client";
import {
  ABILITIES,
  ARENA,
  CHARACTERS,
  COATS,
  type CoatId,
  PLAYABLE_MAP_IDS,
  type PlayableMapId,
  type PlayerOptions,
  SPECIES,
  WEAPONS,
  WORLD_MAPS,
} from "@craft-ones/shared";
import Image from "next/image";

export function CharacterPicker({
  value,
  onChange,
  label,
}: {
  value: PlayerOptions;
  onChange: (value: PlayerOptions) => void;
  label: string;
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
    <fieldset className="critter-picker roster-picker">
      <legend>{label}</legend>
      <div className="roster-kicker">
        <span>Meet the mischief</span>
        <span>
          {String(index + 1).padStart(2, "0")} /{" "}
          {String(SPECIES.length).padStart(2, "0")}
        </span>
      </div>
      <div className="character-lineup" aria-hidden="true">
        <div className="lineup-stage" />
        {SPECIES.map((species, i) => {
          const slot = (i - index + SPECIES.length) % SPECIES.length;
          return (
            <div
              key={species}
              className={`lineup-critter ${slot === 0 ? "is-selected" : ""} ${slot === 2 ? "is-distant" : ""}`}
              style={{
                left: `${[50, 83, 50, 17][slot]}%`,
                zIndex: slot === 0 ? 4 : slot === 2 ? 1 : 2,
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
      <fieldset
        className="roster-choices"
        aria-label={`${label} character roster`}
      >
        {SPECIES.map((species) => (
          <button
            key={species}
            type="button"
            aria-label={CHARACTERS[species].name}
            aria-pressed={value.species === species}
            onClick={() => onChange({ ...value, species })}
          >
            <span>{CHARACTERS[species].name}</span>
          </button>
        ))}
      </fieldset>
      <div className="roster-profile">
        <button
          type="button"
          className="roster-arrow"
          aria-label="Previous character"
          onClick={() => cycle(-1)}
        >
          ‹
        </button>
        <div className="character-bio" aria-live="polite" aria-atomic="true">
          <span className="critter-role">
            {value.species === "cuy" ? "Default critter" : character.role}
          </span>
          <h3>{character.name}</h3>
          <p>{character.tagline}</p>
        </div>
        <button
          type="button"
          className="roster-arrow"
          aria-label="Next character"
          onClick={() => cycle(1)}
        >
          ›
        </button>
      </div>
      <div className="roster-stats">
        <span>
          <strong>100</strong> HP
        </span>
        <span>
          <strong>{ARENA.turnMs / 1000}s</strong> TURN
        </span>
        <span>
          <strong>{Object.keys(WEAPONS).length}</strong> TOOLS
        </span>
      </div>
      <fieldset className="coat-options" aria-label={`${label} coat color`}>
        <legend>Coat / {COATS[value.coat].name}</legend>
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
      <div className="ability-description">
        <span>{ability ? "UNIQUE ABILITY · 1 TURN" : "STANDARD LOADOUT"}</span>
        <h4>{ability?.name ?? "No special ability"}</h4>
        <p>
          {ability?.description ??
            "The original all-rounder. Six shared tools, no special move. Win with your aim, movement and timing."}
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
    <fieldset className="map-picker">
      <legend>Choose your battleground</legend>
      <div className="grid grid-cols-2 gap-3">
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
              className="w-full"
            />
            <span className="block p-3 text-left">
              <strong className="block text-sm">{WORLD_MAPS[id].name}</strong>
              <small className="mt-1 block text-[10px] text-[#b9c4b0]">
                {WORLD_MAPS[id].subtitle}
              </small>
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
