# Craft Ones

Original 1v1 turn-based artillery game by Crafter Station, built on dotframe. One codebase runs on the web, as a Discord Activity, natively on macOS, and on iOS.

## Layout
- `packages/shared`: the battle engine (physics, turns, damage, terrain). Plain TypeScript that also compiles with scriptc, so avoid what scriptc cannot lower (see the dotframe macos skill). Tests in `packages/shared/tests`.
- `port`: the dotframe game. `sim.ts` is the dotframe contract; `src/match.ts` wraps the engine in a deterministic per-frame step; `src/render.ts` draws; `src/controls.ts` maps keyboard, mouse and touch to the input word; `src/online.ts` and `src/snapshot.ts` plug the match into dotframe's rollback engine (`dotframe/src/netplay`) and relay client; the relay is `dotframe relay serve`.
- `port/art`: SVG sources, rasterized into `port/assets/art` by `bun tools/rasterize.ts`.
- `port/deploy`: nginx web image, relay image and the Dokploy compose.

## Rules
- The simulation is deterministic: no Math.random, Date or rendering side effects in `step`, and trig/exp/hypot go through `detmath` (`Math.sin` and friends differ between platforms). `dotframe doctor` flags them; render-only lines carry `// dotframe-allow-math`. Checksums add numbers in a fixed order (`dotframe/src/checksum`).
- scriptc copies a class instance passed as a structural type; mutate through the class type or copy back.
- Install with `bun install --frozen-lockfile`, root and `port/`.

## Verify
- `bun test` (engine), `bun run typecheck`, `cd port && bun run test` (tests plus golden replays).
- `cd port && dotframe desync --latency 474ms --jitter 40ms --delay 10 --mash 3` before touching netplay or the step.
- Builds: `dotframe build web`, `dotframe build native`, `dotframe build ios` (entry `main.ios.ts`; set `DOTFRAME_VENDOR` or run `dotframe vendor ios`) then `dotframe device install ios --yes`.

## Deploy
- Production is the `craft-ones` compose on the Crafter VPS, built from `main` (autodeploy; `dotframe deploy web` also triggers it): `/` serves the web build, `/relay` the relay. `port/deploy` comes from `dotframe deploy init web --provider dokploy`. The Discord Activity maps `/` and `/relay` to the same host.
