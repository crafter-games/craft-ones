import { pathToFileURL } from "node:url";

export async function waitFor(check, timeoutMs, pause = Bun.sleep) {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() >= deadline) throw new Error("Deployment wait timed out");
    await pause(15000);
  }
}

export function isEmpty(metrics) {
  if (
    !Number.isInteger(metrics.rooms) ||
    !Number.isInteger(metrics.connections) ||
    metrics.rooms < 0 ||
    metrics.connections < 0
  )
    throw new Error("Invalid capacity metrics");
  return metrics.rooms === 0 && metrics.connections === 0;
}

export async function deploy(
  env = process.env,
  fetcher = fetch,
  pause = Bun.sleep,
) {
  const sha = env.GITHUB_SHA;
  const githubToken = env.GITHUB_TOKEN;
  const vpsToken = env.VPS_API_KEY;
  const metricsToken = env.GAME_METRICS_TOKEN;
  if (
    !/^[a-f0-9]{40}$/.test(sha ?? "") ||
    !githubToken ||
    !vpsToken ||
    !metricsToken
  )
    throw new Error("Production deployment credentials or commit are missing");
  const composeId = "aMQA1KD2w1sxwIce7-r6L";
  async function request(url, tokenHeader, token, body) {
    const response = await fetcher(url, {
      method: body ? "POST" : "GET",
      headers: { [tokenHeader]: token, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    });
    if (!response.ok)
      throw new Error(`API request failed: HTTP ${response.status}`);
    return response.json();
  }
  const github = (path, body) =>
    request(
      `https://api.github.com/repos/crafter-station/craft-ones/${path}`,
      "Authorization",
      `Bearer ${githubToken}`,
      body,
    );
  const vps = (path, body) =>
    request(`https://vps.crafter.run/api/${path}`, "x-api-key", vpsToken, body);
  const metrics = () =>
    request(
      "https://craft-ones-game.crafter.run/metrics",
      "Authorization",
      `Bearer ${metricsToken}`,
    );
  const current = await github("git/ref/heads/main");
  if (current.object.sha !== sha) {
    console.log("A newer main commit exists; its CI will deploy instead.");
    return;
  }
  const release = `release-${sha}`;
  const refs = await github(`git/matching-refs/tags/${release}`);
  if (refs.length) {
    if (refs.length !== 1 || refs[0].object.sha !== sha)
      throw new Error("Release tag does not match the verified commit");
  } else await github("git/refs", { ref: `refs/tags/${release}`, sha });
  console.log(`Waiting for empty rooms before deploying ${sha}`);
  await waitFor(async () => isEmpty(await metrics()), 30 * 60 * 1000, pause);
  const before = await vps(`compose.one?composeId=${composeId}`);
  if (before.deployments.some((entry) => entry.status === "running"))
    throw new Error("Another Dokploy deployment is running");
  const known = new Set(before.deployments.map((entry) => entry.deploymentId));
  await vps("compose.update", {
    composeId,
    branch: release,
    autoDeploy: false,
  });
  await vps("compose.deploy", {
    composeId,
    title: `GitHub CI ${sha}`,
    description: "Verified main release",
  });
  await waitFor(
    async () => {
      const current = await vps(`compose.one?composeId=${composeId}`);
      if (current.branch !== release)
        throw new Error("Deployment source changed");
      const candidates = current.deployments.filter(
        (entry) => !known.has(entry.deploymentId),
      );
      if (candidates.length > 1)
        throw new Error("Concurrent deployment detected");
      const deployment = candidates[0];
      if (!deployment) return false;
      if (deployment.status === "error")
        throw new Error("Dokploy deployment failed");
      return deployment.status === "done";
    },
    10 * 60 * 1000,
    pause,
  );
  const health = await fetcher("https://craft-ones-game.crafter.run/health", {
    signal: AbortSignal.timeout(10000),
  });
  if (!health.ok) throw new Error("Deployed game server is not healthy");
  await health.body?.cancel();
  const response = await fetcher(
    "https://api.github.com/repos/crafter-station/craft-ones/git/refs/heads/production",
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sha, force: false }),
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    },
  );
  if (!response.ok)
    throw new Error(`Production branch update failed: ${response.status}`);
  await response.body?.cancel();
  console.log(
    "Backend healthy; waiting for Vercel to publish the same commit.",
  );
  await waitFor(
    async () => {
      try {
        const response = await fetcher(
          "https://craft-ones.crafter.run/api/version",
          {
            cache: "no-store",
            signal: AbortSignal.timeout(10000),
          },
        );
        return response.ok && (await response.json()).commit === sha;
      } catch {
        return false;
      }
    },
    10 * 60 * 1000,
    pause,
  );
  console.log(`Production verified: ${sha}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await deploy();
