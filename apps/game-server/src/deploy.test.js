import { expect, test } from "bun:test";
import { deploy } from "../../../scripts/deploy-production.mjs";

const sha = "a".repeat(40);
const env = {
  GITHUB_SHA: sha,
  GITHUB_TOKEN: "github-fixture",
  VPS_API_KEY: "vps-fixture",
  GAME_METRICS_TOKEN: "metrics-fixture",
};
function fixture({
  failed = false,
  stale = false,
  invalidMetrics = false,
} = {}) {
  const writes = [];
  let metricsReads = 0;
  let deploymentReads = 0;
  let versionReads = 0;
  const fetcher = async (url, options = {}) => {
    const path = new URL(url).pathname;
    const body = options.body ? JSON.parse(options.body) : undefined;
    if (body) writes.push({ path, body });
    let value = {};
    if (path.endsWith("/git/ref/heads/main"))
      value = { object: { sha: stale ? "b".repeat(40) : sha } };
    else if (path.includes("matching-refs")) value = [];
    else if (path.endsWith("/metrics")) {
      metricsReads++;
      value = invalidMetrics
        ? {}
        : {
            rooms: metricsReads < 3 ? 1 : 0,
            connections: metricsReads < 3 ? 2 : 0,
          };
    } else if (path.endsWith("/compose.one")) {
      deploymentReads++;
      value = {
        branch: `release-${sha}`,
        deployments:
          deploymentReads === 1
            ? []
            : [
                {
                  deploymentId: "new",
                  title: `GitHub CI ${sha}`,
                  status: failed ? "error" : "done",
                },
              ],
      };
    } else if (path.endsWith("/api/version")) {
      versionReads++;
      value = { commit: versionReads === 1 ? "old" : sha };
    }
    if (path.endsWith("/compose.deploy")) expect(metricsReads).toBe(3);
    return Response.json(value);
  };
  return { fetcher, writes, versions: () => versionReads };
}

test("automatic release waits for empty rooms, pins backend, then publishes matching frontend", async () => {
  const f = fixture();
  await deploy(env, f.fetcher, async () => {});
  expect(f.writes.map((entry) => entry.path.split("/").at(-1))).toEqual([
    "refs",
    "compose.update",
    "compose.deploy",
    "production",
  ]);
  expect(f.writes[1].body.branch).toBe(`release-${sha}`);
  expect(f.writes[3].body).toEqual({ sha, force: false });
  expect(f.versions()).toBe(2);
});

test("failed backend prevents frontend promotion", async () => {
  const f = fixture({ failed: true });
  await expect(deploy(env, f.fetcher, async () => {})).rejects.toThrow(
    "Dokploy deployment failed",
  );
  expect(f.writes.some((entry) => entry.path.endsWith("/production"))).toBe(
    false,
  );
});

test("stale CI and invalid capacity metrics cannot replace production", async () => {
  const stale = fixture({ stale: true });
  await deploy(env, stale.fetcher, async () => {});
  expect(stale.writes).toEqual([]);
  const invalid = fixture({ invalidMetrics: true });
  await expect(deploy(env, invalid.fetcher, async () => {})).rejects.toThrow(
    "Invalid capacity metrics",
  );
  expect(
    invalid.writes.some((entry) => entry.path.endsWith("/compose.update")),
  ).toBe(false);
});
