# Craft Ones on dotframe

Port of Craft Ones to [dotframe](https://github.com/crafter-games/dotframe). Run `dotframe skills get core` before changing anything; it explains the edit, sim, snap, replay loop.

- The simulation is the shared `Battle` engine from `packages/shared`, unchanged. `src/match.ts` turns one encoded input per seat into Battle intentions on a fixed 60 Hz clock and keeps aim and charge in sim state.
- `src/render.ts` draws a match and never writes it. The critter rig reuses `apps/web/src/game/characters/pose.ts`.
- Art: `bun tools/rasterize.ts` turns the web app's SVGs into PNGs under `assets/art` (generated, not committed).
- Check a change: `dotframe sim --mash 7 --frames 1800 --json`, then `dotframe snap --frame 400 --mash 7 --out f.png` and look at it.
- Golden replay: `replays/mash-7.json`, verified by `bun run test`. `dotframe desync` must stay clean.
- Web: `dotframe build web`, serve `dist/web`. Keys: arrows/A-D walk, Space/W jump, Up/Down or Q/E aim, hold F to charge and release to fire, Tab/X cycle weapon, C ability, R rematch.
