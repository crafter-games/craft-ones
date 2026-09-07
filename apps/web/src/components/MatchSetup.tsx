"use client";
import {
  ABILITIES,
  CHARACTERS,
  COATS,
  type CoatId,
  type PlayerOptions,
  SPECIES,
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
  const character = CHARACTERS[value.species];
  return (
    <fieldset className="critter-picker radial-picker">
      <legend>{label}</legend>
      <div className="character-orbit">
        <div className="orbit-ring" />
        <div className="selected-critter" key={value.species}>
          <Image
            src={`/art/${value.species}/${value.coat}/portrait.svg`}
            alt={`${value.coat} ${character.name}`}
            width={210}
            height={210}
            className="breathing-critter"
          />
        </div>
        {SPECIES.map((species, i) => {
          const angle = ((i * 90 - 90) * Math.PI) / 180;
          return (
            <button
              type="button"
              key={species}
              className="orbit-choice"
              aria-label={CHARACTERS[species].name}
              aria-pressed={value.species === species}
              style={{
                left: `${50 + 37 * Math.cos(angle)}%`,
                top: `${50 + 37 * Math.sin(angle)}%`,
              }}
              onClick={() => onChange({ ...value, species })}
            >
              <Image
                src={`/art/${species}/${value.coat}/portrait.svg`}
                alt=""
                width={76}
                height={76}
                style={{ animationDelay: `${-i * 0.8}s` }}
              />
              <span>{CHARACTERS[species].name}</span>
            </button>
          );
        })}
      </div>
      <div className="character-bio">
        <h3>{character.name}</h3>
        <span className="critter-role">{character.role}</span>
        <p>{character.tagline}</p>
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
      <div className="ability-description">
        <span>UNIQUE ABILITY · 1 TURN</span>
        <h4>{ABILITIES[value.species].name}</h4>
        <p>{ABILITIES[value.species].description}</p>
      </div>
    </fieldset>
  );
}

export function MapPicker({
  value,
  onChange,
}: {
  value: "andes" | "coast";
  onChange: (id: "andes" | "coast") => void;
}) {
  return (
    <fieldset className="map-picker">
      <legend>Choose your battleground</legend>
      <div className="grid grid-cols-2 gap-3">
        {(["andes", "coast"] as const).map((id) => (
          <button
            type="button"
            key={id}
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
