# Craft Ones

## Principles
- Original, tiny 1v1 turn-based artillery prototype for Crafter Station. No copied code or assets.
- Scope: two players, 100 HP, two 2688 × 1536 maps with platforms/caves, six default weapons/tools, turn-cost character abilities, gravity, splash damage, knockback, basic movement bounded by a shared turn budget and timer, 15-second turns, invite links, winner and rematch.
- No auth, database, economy, bots, matchmaking, inventories or future-feature frameworks. Terrain destruction is enabled in both local and multiplayer matches; local lab controls can disable it.
- Server alone decides physics, damage, positions, turns and winner. Multiplayer browsers send move/jump/fire/ability/restart intentions and render synchronized state. `/playground` runs the identical shared engine locally with alternating seats and no network dependency.
- Keep Phaser client-only and lazy-loaded. React owns the lobby and HUD; Phaser owns the canvas and pointer input.
- Use Spec Kit's specify → plan → tasks → implement → converge flow, with acceptance criteria verified in tests.
- Keep agent configuration in `.devin/`. Never commit secrets.

## Workspace
- Bun workspaces: `apps/web`, `apps/game-server`, `packages/shared`.
- Frontend: Next.js App Router, React, Tailwind CSS, Phaser 3. Server: Colyseus 0.16 and schema 3.
- `@colyseus/core` is pinned to 0.16.24: 0.16.25 publishes an unresolved `workspace:^` dependency.
- Install with `bun install --frozen-lockfile`.
- `bun dev` runs frontend (3000) and multiplayer server (2567). Use `bun dev:web` / `bun dev:server` separately if needed.
- Verification commands: `bun test`, `bun run typecheck`, `bun run lint`, `bun run build`, `bun run test:e2e`.
- Install browser test runtime with `bunx playwright install chromium` before the first E2E run.
- Bun tests are scoped to the server by `bunfig.toml`; Playwright owns browser tests. The typecheck command also checks browser tests and Playwright configuration.
- Touch E2E tests must activate the page and await canvas actionability before measuring CDP coordinates; focus/Phaser resizing can otherwise move the touch target.
- Server restart discards rooms. No persistence or reconnection is part of this milestone.
- Node 22+ runs Colyseus via `tsx`; Bun 1.3.5's built-in `ws` compatibility layer ignores `maxPayload`. Network tests spawn the real Node server rather than an in-process Bun server.
- Schema classes use `declare` fields and constructor assignments: emitted native class fields overwrite Colyseus change-tracking accessors.
- Server `PORT` defaults to 2567 (0 allocates an ephemeral test port); `WEB_ORIGIN` accepts comma-separated additional browser origins. Localhost:3000 and 127.0.0.1:3000 are allowed by default.
- Frontend derives the WebSocket host from the page hostname. Override with `NEXT_PUBLIC_GAME_SERVER_URL` in `apps/web/.env.local` when needed.

## Spec Kit
- Upstream v1.0.0 is installed in `.devin/.specify`, with commands in `.devin/commands` and a local adapter in `.devin/skills/speckit/SKILL.md`.
- The CLI is pinned: `uvx --from git+https://github.com/github/spec-kit.git@v1.0.0 specify`. Run it in `.devin`; `SPECIFY_INIT_DIR` can explicitly point there.
- This is a lightweight workflow adaptation: this file is the project's governing specification, session tasks replace generated plan/task documents, and test evidence establishes convergence. Installed templates are not completed feature artifacts.

## Milestone acceptance
- Creating a room from home retains Player 1's connection through navigation to `/game/[roomId]`.
- Copying the invitation and opening it in another browser joins Player 2; a lone player waits and a third player is rejected.
- Both browsers render the same authoritative projectiles, terrain, HP, positions, turn and winner.
- Both players can aim, hold to charge, release to fire, and alternate turns; idle turns expire after 15 seconds.
- Splash damage can remove all 100 HP through normal fire intentions, after which both browsers display the same winner.
- Invalid inputs, stale or duplicate shots and out-of-turn actions never change gameplay outcomes.


## First playable acceptance
- Home exposes Playground and Create Game. Playground starts one canvas immediately, even with the game server unavailable.
- Cuy and Llama are original SVG cutouts with independent joints; render code is split into rig, input, map, effects and camera modules.
- Both maps support complete matches through normal pointer input, victory and restart. Restart clears projectiles, restores HP and positions, and does not leak canvases or timers.
- Move is constrained by turn, sequence, rate, time, map walls and player separation. Rematch is host-only after a finished game, with both players connected; old fire intents stay stale.
- Trajectory preview and authoritative rockets share the same launch and swept-collision code. Player gravity continues during flight.
- Touch aim/charge/release and movement work at portrait and landscape sizes. Pointer cancellation and blur cancel charging.
- Lab tools: restart, infinite HP, trajectory, collision circles and ground destruction toggle. Local options are never registered as multiplayer messages.
- Regenerate original character assets with `bun apps/web/scripts/character-art.ts`. Joint coordinates and source shapes live in `apps/web/src/game/characters/design.ts`.

## Expanded arena acceptance
- Original cartoon art uses flat colored shapes, contours and inset shadow planes. No realistic scenery, photographs, clothing or borrowed game assets.
- Both species can occupy either seat with one of five validated coat palettes. Home visibly offers map/character selectors that carry into local play and room creation; invite guests choose their character before joining.
- Maps have suspended islands, obstacles, enclosed caves and open voids. Explosions remove occupancy cells; bodies fall onto new surfaces or lose when falling out of the world.
- Rocket, grenade, sticky bomb, mortar, dynamite and grappling hook are available by default. Each shot/tool spends a turn; grenade/dynamite fuse and bounce are authoritative. Sticky bombs attach to terrain or characters and explode after a 3-second fuse. Hooks pull along a collision-checked line.
- Basic walk/jump share 240 movement points per turn and preserve the shot; walking and airborne steering spend horizontal distance, jumping costs 48 plus travel, and the HUD displays the synchronized remaining budget; jumping rejects repeated airborne jumps. W jumps vertically, A/D+W jumps directionally; the touch Jump control is adjacent to movement. Cuy heals 25 HP; Llama leaps toward aim. Abilities spend a turn and become available four global turn numbers later.
- Turn camera briefly focuses the active character, pulls back to the map, and includes high projectiles. Manual focus is available; charging freezes camera movement.
- Shared occupancy collision drives previews, damage craters and physical movement. Flat terrain remains an internal baseline for regression tests, not a player-facing map.
- Regenerate original layered backgrounds/previews with `bun apps/web/scripts/map-art.ts`; character generation also creates all coat variants and portraits.
