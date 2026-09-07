"use client";
import {
  ABILITIES,
  COATS,
  type CoatId,
  type PlayerOptions,
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
  return (
    <fieldset className="critter-picker">
      <legend>{label}</legend>
      <div className="flex items-center gap-3">
        <Image
          src={`/art/${value.species}/${value.coat}/portrait.svg`}
          alt={`${value.coat} ${value.species}`}
          width={100}
          height={100}
          className="critter-portrait"
        />
        <div className="min-w-0 flex-1">
          <div className="flex gap-2">
            {(["cuy", "llama"] as const).map((species) => (
              <button
                key={species}
                type="button"
                aria-pressed={value.species === species}
                className="species-button"
                onClick={() => onChange({ ...value, species })}
              >
                {species === "cuy" ? "Cuy" : "Llama"}
              </button>
            ))}
          </div>
          <fieldset
            className="mt-3 flex gap-2"
            aria-label={`${label} coat color`}
          >
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
          <p className="mt-3 text-[11px] text-[#becdb6]">
            <strong>{ABILITIES[value.species].name}</strong> ·{" "}
            {value.species === "cuy" ? "+25 HP" : "Long leap"}
            <br />
            Spends one turn
          </p>
        </div>
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
