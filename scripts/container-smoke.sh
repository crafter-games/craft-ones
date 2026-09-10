#!/usr/bin/env bash
set -euo pipefail
export PUBLIC_ORIGIN=https://localhost:3443 SITE_DOMAIN=localhost
export HTTP_PORT=3080 HTTPS_PORT=3443
export METRICS_TOKEN=container-test-token
export RELEASE_TAG=container-test
project=craft-ones-ci
cert_dir=$(mktemp -d)
cleanup() {
  docker rm -f "$project-load" >/dev/null 2>&1 || true
  docker compose -p "$project" down >/dev/null 2>&1 || true
  rm -rf "$cert_dir"
}
trap cleanup EXIT
docker compose -p "$project" up -d --build --wait
docker compose -p "$project" cp proxy:/data/caddy/pki/authorities/local/root.crt "$cert_dir/root.crt"
curl --cacert "$cert_dir/root.crt" --fail --silent --show-error https://localhost:3443/battle/health
bunx playwright test --config playwright.container.config.ts
docker run -d --name "$project-load" --cpus=1 --memory=512m --read-only \
  -p 127.0.0.1:2569:2567 -e WEB_ORIGIN=http://localhost:3000 \
  -e METRICS_TOKEN -e MAX_CONNECTIONS_PER_IP=20 -e CREATE_PER_MINUTE=120 \
  "craft-ones-game:$RELEASE_TAG"
for attempt in {1..30}; do
  if curl --fail --silent http://127.0.0.1:2569/health >/dev/null; then break; fi
  sleep 1
done
curl --fail --silent --show-error http://127.0.0.1:2569/health >/dev/null
LOAD_URL=http://127.0.0.1:2569 bun run test:load
