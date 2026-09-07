# Craft Ones

An original 1v1 artillery game with a Cuy, a Llama and one rocket. Two small Peruvian landscape-inspired arenas, 100 HP, 15-second turns and local pass-and-play.

## Play locally

```sh
bun install --frozen-lockfile
bun dev
```

Open [Craft Ones](http://localhost:3000). **Playground** immediately starts a local match; you control both characters in alternating turns. It also works with only `bun dev:web` running. **Create Game** creates a server-authoritative room; copy its invite to a second browser. After a completed duel, Player 1 can choose **Play again** while both players are connected.

- Mouse or touch: point/drag to aim, hold to charge, release to fire. Full charge takes 2.8 seconds. The idle dotted arc previews 50% power; while charging, it follows your actual power.
- A / D or the two arrow buttons: move, up to 96 world units each turn.
- Focus the arena to use keyboard aiming (left/right arrows) and charging (hold/release Space).
- Restart the playground at any point. Changing its map starts a fresh match.
- Expand **Lab tools** for infinite HP, trajectory, collision circles and experimental destructible ground. Craters remove solid ground downward; they do not create caves or overhangs. There is no jump or terrain persistence.

On a phone on the same network, open `http://<computer-LAN-IP>:3000/playground`. For multiplayer, start the server with `WEB_ORIGIN=http://<computer-LAN-IP>:3000 bun dev:server`; the browser derives the WebSocket host from the page hostname. No authentication, bots or reconnect/persistence are included.

## Code and original art

- `packages/shared/src/Battle.ts`: lifecycle, authoritative actions and combat resolution, shared by server and local play.
- `packages/shared/src/ballistics.ts`, `playerMotion.ts`, `terrain.ts`: ballistics, body gravity and terrain geometry.
- `apps/game-server/src/BattleRoom.ts`: network message boundary; lab settings are not accepted remotely.
- `apps/web/src/game/`: independent input, camera, map, VFX and character-rig modules.
- `apps/web/src/components/`: shared React HUD, controls and network session.
- `apps/web/src/game/characters/design.ts`: original editable SVG shapes and neck/shoulder/wrist/hip/ankle pivots. Rear limbs sit behind the body; front hands sit over the weapon. The procedural rig animates idle, walk, aim, fire, hit and death.

Run `bun apps/web/scripts/character-art.ts` to regenerate the transparent cutouts, [character reference](http://localhost:3000/art/character-reference.svg) and home illustration. These are authored vector assets, with no third-party sprites or copied IP. Each part uses the same 80 × 100 local viewbox with a pivot at (40, 50), rasterized at double resolution by Phaser.

## Verify

```sh
bun test
bun run typecheck
bun run lint
bun run build
bunx playwright install chromium
bun run test:e2e
```

Unit tests cover malformed/stale actions, fixed-step physics, both maps, complete matches, movement limits, preview/impact parity, craters and gravity. Real Colyseus clients cover state synchronization and remote action rejection. Browser tests play full local and multiplayer matches using real input, replay, camera movement, mobile touch and viewport changes.
