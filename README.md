# Craft Ones

An original 1v1 artillery game with customizable Cuy and Llama characters and five default weapons/tools. Two large original cartoon arenas, 100 HP, 15-second turns and local pass-and-play.

## Play locally

```sh
bun install --frozen-lockfile
bun dev
```

Open [Craft Ones](http://localhost:3000). **Playground** immediately starts a local match; you control both characters in alternating turns. It also works with only `bun dev:web` running. **Create Game** creates a server-authoritative room; choose its map/character on home, then copy its invite to a second browser. Guests choose their character and select **Join Game**. After a completed duel, Player 1 can choose **Play again** while both players are connected.

- Mouse or touch: point/drag to aim, hold to charge, release to fire. Full charge takes 2.8 seconds. The idle dotted arc previews 50% power; while charging, it follows your actual power.
- A / D or the two arrow buttons: move, while your 15-second turn clock is running. Walking and basic jumping do not spend your attack.
- Focus the arena to use keyboard aiming (left/right arrows) and charging (hold/release Space).
- W or **Jump** jumps vertically. Hold A/D while pressing W (or hold a movement button while tapping Jump on touch) for a directional hop. Landing is required before another jump; there is no jump-point cost.
- Use the arsenal buttons to choose a rocket, bouncing grenade (3 s), mortar, dynamite (2 s) or grappling hook. Every shot/tool uses the turn; ammunition is unlimited. Hooks have an 880-unit range and pull toward the first terrain anchor, stopping at obstacles.
- **Second wind** restores 25 HP to the Cuy. **Andean leap** launches the Llama toward its aim. Each ability spends the turn; it is available again on the character’s second subsequent turn. Full-health healing is disabled.
- The camera focuses the active critter briefly, then pulls back. **Focus character** keeps a close view; **View whole map** restores overview. Camera motion pauses during charging.
- Open **Match setup** in the playground to pick a map, either species for either seat, and five coat colors. The home selectors are visible and carry into both local play and room creation. Changes start a fresh match; **Restart** also works mid-flight.
- Both 1792 × 1024 maps have floating platforms, caves, cliffs and open voids. Rocket/grenade/mortar/dynamite explosions excavate terrain; falling beyond the bottom eliminates a player. Expand **Lab tools** for infinite HP, trajectory, collision circles and the destruction toggle. Terrain resets on rematch.

On a phone on the same network, open `http://<computer-LAN-IP>:3000/playground`. For multiplayer, start the server with `WEB_ORIGIN=http://<computer-LAN-IP>:3000 bun dev:server`; the browser derives the WebSocket host from the page hostname. No authentication, bots or reconnect/persistence are included.

## Code and original art

- `packages/shared/src/Battle.ts`: lifecycle, authoritative actions and combat resolution, shared by server and local play.
- `packages/shared/src/worlds.ts`, `terrainGrid.ts`, `worldMotion.ts`, `projectiles.ts`, `arsenal.ts`: original layouts, occupancy collision, body gravity, weapon simulation and character palettes/abilities. The earlier flat-world modules remain regression baselines.
- `apps/game-server/src/BattleRoom.ts`: network message boundary; lab settings are not accepted remotely.
- `apps/web/src/game/`: independent input, camera, map, VFX and character-rig modules.
- `apps/web/src/components/`: shared React HUD, controls and network session.
- `apps/web/src/game/characters/design.ts`: original editable SVG shapes and neck/shoulder/wrist/hip/ankle pivots. Rear limbs sit behind the body; front hands sit over the weapon. The procedural rig animates idle, walk, aim, fire, hit and death.

Run `bun apps/web/scripts/character-art.ts` to regenerate the transparent cutouts, [character reference](http://localhost:3000/art/character-reference.svg) and home illustration. Run `bun apps/web/scripts/map-art.ts` to regenerate original backgrounds and map previews. Scenery uses simple outlined silhouettes, flat colors and layered shadow planes; no realistic textures. Terrain strata and rim details are drawn through the live collision mask, including holes. All art is authored vector/canvas work with no third-party sprites, copied IP or clothing. Each part uses the same 80 × 100 local viewbox with a pivot at (40, 50), rasterized at double resolution by Phaser.

## Verify

```sh
bun test
bun run typecheck
bun run lint
bun run build
bunx playwright install chromium
bun run test:e2e
```

Unit tests cover malformed/stale actions, fixed-step physics, both maps, complete matches, movement limits, preview/impact parity for all explosive weapons, cavities, wall collision, craters, fuse timing, grappling, jump rejection, ability cooldowns, void falls and gravity. Real Colyseus clients cover map/palette selection, terrain-patch and ability synchronization, and remote action rejection. Browser tests play full local and multiplayer matches using real input, replay, camera movement, mobile touch and viewport changes.

### Verification status for the expanded arena

109 unit and real-server tests, typecheck and lint pass. Production compilation was validated with `bun run --cwd apps/web build --webpack`; the default Turbopack build encounters an environment port-binding restriction. Browser acceptance cases have been updated for map/character selection, the larger camera transform, arsenal controls and crater feedback, but have not yet been rerun: automatic approval review blocked the previous browser interaction/E2E attempt. Visual inspection of the final browser build and final E2E results remain pending authorization. This is not a browser-verified release.

Movement reference: [Gamezebo’s Wild Ones walkthrough](https://www.gamezebo.com/walkthroughs/wild-ones-walkthrough/) describes walking, jumping and shooting in the same timed turn, and W/Space as jump. Craft Ones uses W for jump and retains Space for charging. Basic movement follows the timer; character abilities and the current grappling tool remain turn-consuming actions. Post-shot retreat is not implemented.
