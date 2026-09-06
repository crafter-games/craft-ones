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
- Server restart discards rooms. No persistence or reconnection is part of this milestone.
