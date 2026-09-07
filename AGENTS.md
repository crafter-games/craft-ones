# Craft Ones

## Principles
- Original, tiny 1v1 turn-based artillery prototype for Crafter Station. No copied code or assets.
- Scope: two players, 100 HP, flat ground, one rocket, gravity, splash damage, small knockback, 15-second turns, invite links and winner.
- No auth, database, economy, bots, matchmaking, inventories, destructible terrain or future-feature frameworks.
- Server alone decides physics, damage, positions, turns and winner. Browser sends fire intentions and renders synchronized state.
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
- Both browsers render the same authoritative rocket, HP, positions, turn and winner.
- Both players can aim, hold to charge, release to fire, and alternate turns; idle turns expire after 15 seconds.
- Splash damage can remove all 100 HP through normal fire intentions, after which both browsers display the same winner.
- Invalid inputs, stale or duplicate shots and out-of-turn actions never change gameplay outcomes.
