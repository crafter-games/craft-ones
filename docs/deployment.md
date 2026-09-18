# Deployment and operations

## Release contract

Deploy one game-server instance and one frontend. Rooms live in the game process and cannot migrate between replicas. A disconnect is a forfeit; a restart discards rooms. Anonymous invite play and optional authenticated Discord Activities are supported. See [Discord setup](discord.md) for its private applications, credentials and live verification gates.

Automatic releases require types, lint, a production build and a clean dependency audit. Unit/network tests, bundled-server tests, Playwright and the Docker/HTTPS capacity rehearsal are available through the manual `Full verification` workflow and do not block ordinary releases. Record the exact commit, image tag and completed checks; a fast release does not establish full gameplay regression coverage.

## Container deployment

The included stack runs the frontend and game server behind Caddy. Only the proxy publishes ports. Both application images run as the Node user, with health checks and memory/CPU bounds. The game image is a standalone JavaScript bundle and has a read-only filesystem.

Set these deployment variables in the host's environment or an untracked `.env` file:

| Variable | Value |
| --- | --- |
| `SITE_DOMAIN` | Your public hostname, without scheme or path |
| `PUBLIC_ORIGIN` | The matching `https://` origin, including a nonstandard external port if used |
| `METRICS_TOKEN` | A private random token, generated with `openssl rand -hex 32` |
| `RELEASE_TAG` | The verified commit or immutable release tag |

Point DNS to the host, permit inbound TCP 80/443, then run:

```sh
docker compose build
docker compose up -d --wait
docker compose ps
```

Caddy obtains and renews TLS certificates. Keep its named data/config volumes across releases. The web image is built with `NEXT_PUBLIC_GAME_SERVER_URL=/battle`; Caddy forwards `/battle/*` to the game process and strips the prefix. HTTP matchmaking and WebSocket upgrades use the same public origin. Do not expose the game container directly to the internet.

For a local HTTPS rehearsal use `SITE_DOMAIN=localhost`, `PUBLIC_ORIGIN=https://localhost:3443`, `HTTP_PORT=3080`, `HTTPS_PORT=3443` and a local-only metrics token. Caddy uses its local issuer for localhost. Trust that test root only in the test client or inspect with `curl --cacert`; do not disable certificate verification in production.

## Vercel frontend with a separate game host

Use `apps/web` as the frontend project root and the repository's Bun lockfile. Set `NEXT_PUBLIC_GAME_SERVER_URL` to the game host's `wss://` endpoint **before building**. Set the game process's `WEB_ORIGIN` to the exact Vercel custom-domain origin. The game host must support persistent WebSocket connections, TLS termination and a single long-running Node 22+ process.

Build the server using `bun run build:server`; deploy `dist/game-server.mjs` and run `NODE_ENV=production node dist/game-server.mjs`. The bundled-server test suite exercises this artifact, including its serializer and network limits. `PORT` defaults to 2567. A game server in production refuses to start without `WEB_ORIGIN`.

Do not set a localhost endpoint in a public web build, and do not route game WebSockets to Vercel request functions. Add every allowed browser origin explicitly; wildcards are not supported. Development localhost origins are not implicitly allowed in production.

## Dokploy production profile

`compose.dokploy.yaml` runs the game and an operational monitor behind Dokploy's Traefik proxy. Configure the private `METRICS_TOKEN` in Dokploy, connect this repository and select that compose path. Attach `craft-ones-game.crafter.run` to service `game`, port 2567, with HTTPS enabled. The frontend is `https://craft-ones.crafter.run` on Vercel. No game port is published on the host.

The measured production profile is **2 CPU, 512 MiB, 10 rooms and 20 players**. A separate container on the production VPS, using the same game image, passed a 60-second test with movement and explosions in all ten rooms, zero transport rejections, 86.6 MB peak RSS and 57.9 ms whole-run event-loop p99. The one-CPU trial reached 114.2 ms and failed the 100 ms gate. These measurements establish an initial capacity limit, not long-duration or arbitrary-host guarantees.

Disable automatic deployment while rooms are in memory. Before a manual release, confirm zero active rooms via private metrics, preserve the previous verified image and configuration, and inspect the new containers' health and resource limits after rollout.

## Limits

| Setting | Default | Meaning |
| --- | --- | --- |
| `MAX_ROOMS` | 10 | Concurrent allocated rooms |
| `MAX_CONNECTIONS` | 20 | Open game WebSocket connections |
| `MAX_CONNECTIONS_PER_IP` | 16 | Open connections from one resolved client address |
| `CREATE_PER_MINUTE` | 10 | Per-address creation token bucket, including join-or-create |
| `MATCHMAKE_PER_MINUTE` | 120 | Per-address matchmaking token bucket |
| `WAITING_ROOM_MS` | 300000 | Maximum waiting-room age |
| `FINISHED_ROOM_MS` | 120000 | Time to retain a finished connected room for rematch |
| `ROOM_LIFETIME_MS` | 1800000 | Hard room age limit |
| `TRUST_PROXY_HOPS` | 0 | Trusted rightmost proxy hops when resolving client addresses |

Messages have a per-client burst budget of 40 and replenish at 20/second. Legitimate movement sends about 10/second. Excess messages close the sender with code 4008; gameplay still validates ownership, turn, sequence and movement timing. Each message/HTTP body is bounded to 4096 bytes. A global matchmaking bucket allows a burst of 200 and replenishes at 100/second. The address registry is capped at 4096 entries and evicts inactive expired entries.

The container stack sets `TRUST_PROXY_HOPS=1` because Caddy is the only entry point and overwrites untrusted forwarding information. On a different platform, set the exact trusted chain length and firewall direct access to the backend. Never trust forwarding headers on an internet-exposed origin. Shared NATs may need a higher per-IP connection allowance; increase it deliberately after measuring capacity.

HTTP throttling returns 429 and `Retry-After: 60`, including CORS headers for allowed browser origins. Capacity exhaustion returns an arena-busy error. Expired rooms disconnect with code 4000. Limits must remain enabled during the real deployment smoke test.

## Capacity verification

The default cap is ten rooms and twenty sockets on the included one-CPU/512-MiB game container. The Dokploy production profile uses two CPUs based on the measured host result above. Run `bun run test:container` on the intended host before increasing it. The load gate requires real replicated movement and explosions in every room, no transport throttling, peak RSS below 400 MiB, and whole-run event-loop p99 below 100 ms. Early cumulative p99 peaks are also printed separately; those samples cover shorter startup windows, not the complete load duration. It prints gameplay rejections separately because unavailable movement can be a valid game outcome.

Run capacity checks without competing builds or browser tests. `bun run test:load` starts a fresh bundled Node process for a quick local check; `LOAD_ROOMS` and `LOAD_SECONDS` control size and duration. `LOAD_URL` plus `METRICS_TOKEN` can target a dedicated freshly started test server. The harness rejects a non-empty server or one older than five seconds before allocating any rooms. Limits on that server must accommodate the requested clients, including clients sharing a test address. Do not load-test a live public game with active users.

## Monitoring

`GET /health` returns 200 with `{"ok":true}` while serving and 503 when draining. Probe it through `/battle/health` at the public proxy. Caddy and the containers also have local health checks.

`GET /metrics` requires `Authorization: Bearer $METRICS_TOKEN`. Missing/wrong credentials return 404. Keep the token out of browser bundles and access logs. Metrics include room/connection counts, rejected requests/connections/messages, RSS, uptime and event-loop p99 latency. The proxy path is `/battle/metrics`.

Collect metrics every 30 seconds and alert on repeated health failures, restarts, increasing rejection counts, RSS above 400 MiB, event-loop p99 above 100 ms, or sustained room occupancy above 80% of its cap. These are initial operational thresholds, not promises of capacity on every host. Caddy writes JSON access logs; Node writes startup/errors. Use the host's log retention and monitoring system.

The Dokploy monitor checks both public HTTPS endpoints and private game metrics every 30 seconds. Three consecutive unhealthy samples trigger an alert; restarts and increased rejection counters trigger immediately. Recovery emits a resolution. Configure `ALERT_WEBHOOK_URL` with a private HTTP endpoint accepting a JSON `text` field. Failed deliveries retry in order; its in-memory backlog holds 100 transitions and logs when the oldest is dropped. Logs are capped at five 10 MB files. Without a webhook, health samples and alert transitions are logged, but **no external notification is delivered**.

This monitor shares the VPS failure domain. An independent external uptime check is still needed to report complete host or network loss. Container health checks detect an unhealthy process; Docker's restart policy restarts an exited process, not a running unhealthy one.

For investigation:

```sh
docker compose ps
docker compose logs --since 10m game web proxy
docker stats --no-stream
```

## Release smoke and rollback

After deploying the exact verified images, open the public HTTPS page on two independent browsers/devices. Create a room from Home, copy the invite, join, fire from both seats, confirm shared damage/turns, finish a match and rematch. Check third-player rejection, disconnect forfeit, mobile orientation changes, sound mute and missing-room recovery. Verify health through the proxy and check metrics for unexpected rejects.

Retain the prior `RELEASE_TAG` images. Announce maintenance for game-process replacement and allow existing rooms to finish before restarting; this implementation does not migrate them. If a release fails its smoke, switch image tags to the previous verified release and run `docker compose up -d --no-build --wait`. Do not run `docker compose down -v`: that would delete the proxy certificate state. A rollback still ends any rooms on the replaced process.

Review the current readiness evidence before treating a release as approved. Live DNS, certificate issuance, two-device behavior and host monitoring must be checked in the actual deployment environment.

## Automatic releases

A successful `CI` push run on `main` starts `Deploy production`. Pull requests never receive deployment secrets. GitHub stores `VPS_API_KEY` and `GAME_METRICS_TOKEN`; the deploy job alone receives write access to repository refs.

The job skips superseded commits, creates an immutable `release-<commit>` tag, waits up to thirty minutes for rooms and sockets to become empty, then deploys that exact tag through Dokploy. Direct Dokploy Git webhook deployment stays disabled because GitHub CI is the release gate. Superseded verification jobs are cancelled, while deployments remain serialized and are never cancelled by newer pushes. Playwright browser installation and full game/container tests run only when `Full verification` is started manually.

After the backend succeeds and public health passes, the job advances the `production` branch without force. Vercel is connected to that branch; other branches do not automatically deploy. The job waits for the public `/api/version` endpoint to report the same commit. A backend failure stops frontend promotion. Timeouts fail the workflow visibly; inspect the failed step before rerunning. This is a sequential rollout, not an atomic two-service switch. A new room created between the empty-room check and process replacement can still be disconnected.

For rollback, retain the previous release tag and Vercel deployment. Restore the prior tag through Dokploy and promote the matching prior Vercel deployment manually. Do not force-push the `production` branch or remove certificate volumes. Future successful main releases advance it normally.
