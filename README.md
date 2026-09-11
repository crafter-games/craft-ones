# Craft Ones

An original 1v1 artillery game by Crafter Station. Play locally on one screen or create a room and invite a friend. Nine characters, six weapons/tools, four destructible arenas, 100 HP and 15-second turns.

The arena loads character parts for the selected profiles only, then adds missing parts when a rival joins or a coat changes. The existing canvas, controls, and open setup dialog remain in place. Initial readiness waits for the selected character textures and first scene update. Movement and firing wait for all current character parts. Failed art loads show a keyboard-accessible retry dialog that reloads the arena while preserving the session. Arena mounts own a fresh canvas with readiness cleared before Phaser boots. Scene shutdown and destruction both release external keyboard listeners and synthesized audio.

## Run locally

Requires Bun 1.3.11 and Node 22 or newer.

```sh
bun install --frozen-lockfile
bun dev
```

Open [localhost:3000](http://localhost:3000). **Local** opens setup for two seats on one screen and runs without a game server (`/local`). The unlinked `/playground` route is the same match with lab tools (infinite HP, collisions, trajectory, destructible ground) in the menu. **Create Game** opens online setup. Start a room, copy the invite and open it in a second browser. Guests select their character before joining; a third player cannot join. The host can rematch after a completed duel while both players remain connected.

The web and game processes can also run separately with `bun dev:web` and `bun dev:server`. To use another frontend port:

```sh
bun run --cwd apps/web dev --port 3107
WEB_ORIGIN=http://localhost:3107 bun dev:server
```

The frontend derives a WebSocket endpoint from its hostname on port 2567. Set `NEXT_PUBLIC_GAME_SERVER_URL` in `apps/web/.env.local` before building when the game server has a different address. HTTPS pages require a secure WebSocket endpoint. A relative path such as `/battle` supports the included reverse proxy.

## Play

- Aim with mouse or touch, hold to charge and release to fire. Full charge takes 2.8 seconds. Arrow keys aim; hold/release Space to fire.
- A/D moves; W jumps. Hold A/D and press W to jump directionally. Touch movement and Jump controls are available in both orientations.
- Walking and jumping keep your shot. Walking away from the turn's starting point spends the shared 240-point range; returning restores it. Jumps are free and unlimited, but jump travel stays inside that same range.
- Keys 1–6 choose rocket, grenade, sticky bomb, mortar, dynamite or grapple. All spend a turn. Grenades and sticky bombs have a 3-second fuse, dynamite 2 seconds. Grapples pull toward terrain and stop at obstacles.
- Llama leaps, Fox dashes, Capybara shields, Puma pounces and Alpaca heals 25 HP. Guinea Pig has no ability. Freddy, Michi and Railly Hugo have aimed projectile powers with signature looks. Key 7 selects an ability; aimed abilities use the same charge/release controls. Abilities cost a turn and have a four-global-turn cooldown.
- Explosions carve terrain. Characters fall onto remaining surfaces or lose in the void. The authoritative state determines damage, turns, projectiles and winner.
- The camera briefly follows the active character, then frames the map. Camera focus is also available from the HUD/menu. Charging freezes the camera.
- Sound is synthesized locally and starts after interaction. Mute persists across reloads.
- The local menu pauses time and input. Online matches keep running while menus are open. Local lab tools include restart, infinite HP, trajectories, collision circles and terrain destruction.

Disconnecting forfeits an online match. There is no account system, saved progress or reconnection. Server restarts discard rooms. Connected waiting rooms expire after 5 minutes, finished rooms after 2 minutes, and all rooms after 30 minutes by default.

## Verify

```sh
bun test
bun run typecheck
bun run lint
bun run build
bun audit
bun run test:server:bundle
bunx playwright install chromium
bun run test:e2e
bun run test:e2e:dev
bun run test:container
```

`test:e2e` runs the built production web app and a real game server. It requires a completed build. `test:e2e:dev` checks rendering lifecycle and exclusive abilities under development/Strict Mode. Tests fail if their ports are occupied instead of silently testing an unrelated process. Set `E2E_WEB_PORT=3107` to change the web test port. Reusing servers requires the explicit `E2E_REUSE_SERVERS=1` setting. A custom `E2E_SERVER_PORT` must match `NEXT_PUBLIC_GAME_SERVER_URL` in the tested web build.

`test:container` requires Docker and free local ports 3080, 3443 and 2569. It builds the deployment images, verifies the local HTTPS certificate with curl, runs the online browser tests through Caddy, and measures ten active rooms under a one-CPU/512-MiB game container limit. It removes its test containers on exit.

`bun scripts/converge.ts` runs the primary gates and verifies the original acceptance references. Browser failures retain screenshots under separate `test-results/production/`, `test-results/dev/`, and `test-results/container/` directories. A failed test gets one diagnostic retry with a full trace; a passing retry still fails the gate. Continuous tracing is disabled on the first attempt because it can distort real-time input timings. The arena uses Canvas 2D when WebGL is unavailable or reports SwiftShader, llvmpipe, softpipe, or Software Rasterizer; hardware-accelerated browsers keep WebGL. Test aiming waits for the browser power meter instead of inferring charge from the worker clock. Validate browser changes on Linux as well as macOS.

## Deploy and operate

See [deployment and operations](docs/deployment.md) for the container stack, Vercel frontend configuration, HTTPS, limits, metrics and rollback. The game server is a long-running Node process; it cannot be deployed as a short-lived request handler.

Colyseus core remains on 0.16.24. A checked-in Bun patch updates its two runtime imports to the named Nano ID 3 API, while the root override pins `nanoid` to 3.3.18. Both module formats retain Colyseus's ID length/alphabet contract. The game bundle uses the pure-JavaScript WebSocket/MessagePack implementations, without optional native accelerators.

## Source and original art

- `packages/shared/src/Battle.ts`: authoritative lifecycle, actions and combat, shared by server and local play.
- `packages/shared/src/worlds.ts`, `terrainGrid.ts`, `worldMotion.ts`, `projectiles.ts`, `arsenal.ts`: maps, occupancy, movement, weapons and character definitions.
- `apps/game-server/src/BattleRoom.ts`, `server.ts`, `limits.ts`: network boundaries, room lifecycle and resource controls.
- `apps/web/src/game/`: input, camera, maps, effects, synthesized audio and original character rigs.
- `apps/web/src/components/`: lobby, setup and HUD.

Regenerate character art with `bun apps/web/scripts/character-art.ts` and maps with `bun apps/web/scripts/map-art.ts`. Original SVG cutouts, palettes, joint transforms and layered backgrounds are authored in the repository. Four 2688 × 1536 arenas share occupancy collision with previews and terrain destruction. Flat terrain remains an internal regression baseline.
