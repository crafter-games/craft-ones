# Discord Activity

Craft Ones runs the existing Next.js/Phaser game inside Discord. The same authoritative Colyseus rules, worlds, characters and abilities power browser and Activity matches. Browser invite play remains anonymous.

## Application configuration

Create separate Discord applications for development and production. Configure each in the Developer Portal:

| Setting | Value |
| --- | --- |
| Activities > URL Mappings, root `/` | `craft-ones.crafter.run` |
| Activities > URL Mappings, prefix `/game` | `craft-ones-game.crafter.run` |
| Activities > Maximum Participants | `2` |
| Activities > Supported Platforms | Web initially |
| OAuth2 > Redirects | `https://craft-ones.crafter.run/discord` |
| OAuth2 > Public Client | Off |

Targets omit the scheme. For a development tunnel or a separate deployment, replace both targets and the redirect with its hosts. The root URL detects Discord's `frame_id` and `instance_id` parameters without navigation; `/discord` is also an entry point. Assets use the root mapping. HTTP authorization uses `/game/discord/*`; WebSockets explicitly use `/.proxy/game/*` because Colyseus 0.16 automatically rewrites other Discord URLs to its default `/colyseus` mapping. Discord supports both proxy path formats.

Enable Activities after the configured deployment is healthy. Discord creates the default Launch entry point. Add collaborators through App Testers for private testing. Do not enable iOS/Android until gameplay and safe areas are verified on physical Discord clients.

## Server credentials

Set `DISCORD_APPLICATIONS` only on the game server, as a JSON array:

```json
[{"clientId":"DISCORD_APPLICATION_ID","clientSecret":"OAUTH_CLIENT_SECRET","botToken":"BOT_TOKEN"}]
```

The IDs must be real Discord snowflakes. Up to four distinct applications are supported. Empty/unset configuration disables Discord authentication while preserving ordinary browser play. Both Compose profiles pass this environment variable to the game process. Keep credentials out of source control, client bundles, URL mappings and frontend environment variables. The client ID is derived from Discord's proxy hostname; `NEXT_PUBLIC_DISCORD_CLIENT_ID` is only a local override.

The bot credential is used to verify Activity instance membership through Discord's API. No Gateway connection, message-reading intent, admin permission or database is needed. OAuth requests only `identify`; tokens remain in browser memory and are not placed in URLs or persistent storage. The exchange returns no refresh token.

Preserve the existing Dokploy environment, including `METRICS_TOKEN`, when adding credentials. Restarting replaces in-memory rooms, so use the existing empty-room release process. A single game process owns the Activity-to-room mapping; do not add replicas without shared coordination.

## Session boundaries

The server verifies the OAuth token's application, identifies its user, and checks that user against Discord's Activity instance membership. A serialized reservation operation assigns concurrent participants to one private room per application and instance. Each user gets at most one active or pending seat; reservations expire after 15 seconds. Anonymous Colyseus create/join endpoints cannot enter Discord rooms.

The first player selects the map. Both players select a character independently. Full rooms reject a third participant. Disconnects forfeit the match, and a finished room cannot admit replacements. Both connected players can use the existing rematch flow. Closing the Activity for everyone and starting a fresh instance creates a new match.

Authentication requests have a 4096-byte body bound, request-rate limits, a 32-request concurrency limit and eight-second upstream timeouts. Existing room, socket, message and lifetime limits also apply to Discord. Discord hides client IPs behind its proxy, so many users can share an address budget. Measure that behavior before increasing limits; do not blindly trust extra forwarded-header hops.

## Verification

- `bun test apps/game-server/src/discord.test.ts`: real Node/Colyseus server with an injected Discord API fixture, including simultaneous joins, membership/audience checks, seat theft prevention, full rooms, disconnect and malformed requests.
- `bunx playwright test discord.spec.ts`: built frontend, real Embedded App SDK messages, three browser contexts and real Node/Colyseus sockets. The test simulates Discord's RPC/API and proxy boundary; it does not prove Discord's actual proxy or credentials.
- `E2E_DEV=1 bunx playwright test discord.spec.ts`: development lifecycle of the same integration.
- Run the full repository convergence and container checks before shipping.

For the final live check, launch the enabled private Activity from Discord in a test server with two authorized testers. Confirm OAuth, all assets, both seats, synchronized movement/shot/terrain/HP, invite, rematch and disconnect handling. Confirm the app cannot launch as a playable session from a forged external URL. Keep browser play working independently.

## Public distribution

A configured private Activity is not a verified or publicly discoverable game. Public distribution still requires Discord's application verification and Discovery approval, owner-approved privacy/terms URLs, support/community details and required art/metadata. Identity verification and legal acceptance belong to the account owner. Keep these statuses explicit when announcing availability.

References: [Activity setup](https://docs.discord.com/developers/activities/building-an-activity), [networking](https://docs.discord.com/developers/activities/development-guides/networking), [multiplayer security](https://docs.discord.com/developers/activities/development-guides/multiplayer-experience), [Discovery](https://docs.discord.com/developers/discovery/enabling-discovery).
