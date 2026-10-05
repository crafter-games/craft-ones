# Craft Ones on dotframe

Port of Craft Ones to [dotframe](https://github.com/crafter-games/dotframe). Run `dotframe skills get core` before changing anything; it explains the edit, sim, snap, replay loop.

- The simulation is the shared `Battle` engine from `packages/shared`, unchanged. `src/match.ts` turns one encoded input per seat into Battle intentions on a fixed 60 Hz clock and keeps aim and charge in sim state.
- `src/render.ts` draws a match and never writes it. The critter rig reuses `apps/web/src/game/characters/pose.ts`.
- Art: `bun tools/rasterize.ts` turns the web app's SVGs into PNGs under `assets/art` (generated, not committed).
- Check a change: `dotframe sim --mash 7 --frames 1800 --json`, then `dotframe snap --frame 400 --mash 7 --out f.png` and look at it.
- `bun run test`: unit tests (terrain coverage, kickoff, slots, rematch, aim encoding, walking) and the golden replays (`mash-7`, and `mash-3-finish` to a winner). `dotframe desync` must stay clean.
- Sound: `bun tools/synth-sounds.ts` renders the SoundBoard envelopes in `src/sounds.ts` to `assets/sfx` (generated). `src/audio.ts` plays them from the shared `soundCues`.
- Web: `dotframe build web`, serve `dist/web`. Setup screen first (`?map=` or `?species=` skips it).
- Controls: mouse aims, hold and release to fire, click a hotbar slot; arrows/A-D walk, Space/W jump, Up/Down or Q/E aim, F/Enter charge, 1-7 or Tab pick a tool, C ability, M map view, R rematch, Esc back to setup. Touch gets walk and jump buttons; a finger on the field aims and fires.
- Input encoding (`src/match.ts`): bits 0-9 actions, 10-12 hotbar slot, 13-23 absolute aim angle. In `--inputs` use `{"slot": 4}` and `{"aim": -1.2}`.
