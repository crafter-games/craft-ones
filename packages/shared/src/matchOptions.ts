export const OPENING_SEATS = ["host", "guest", "random"] as const;
export type OpeningSeat = (typeof OPENING_SEATS)[number];

export function isOpeningSeat(value: unknown): value is OpeningSeat {
  return (
    typeof value === "string" &&
    (OPENING_SEATS as readonly string[]).includes(value)
  );
}

/** Seat index that takes the first aiming turn of a match or rematch. */
export function resolveOpeningIndex(
  seat: OpeningSeat,
  random: () => number = Math.random,
): number {
  if (seat === "guest") return 1;
  if (seat === "random") return random() < 0.5 ? 0 : 1;
  return 0;
}
