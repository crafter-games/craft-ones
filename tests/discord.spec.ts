import { type ChildProcess, spawn } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";

const clientId = "111111111111111111";
const origin = `https://${clientId}.discordsays.com`;
let backend = "";
let child: ChildProcess;
test.beforeAll(async () => {
  child = spawn("node", ["--import", "tsx", "src/fixtures/discord-server.ts"], {
    cwd: `${process.cwd()}/apps/game-server`,
    env: {
      ...process.env,
      CREATE_PER_MINUTE: "200",
      MATCHMAKE_PER_MINUTE: "300",
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
  child.stdout?.on("data", (chunk) => {
    backend = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0] ?? backend;
  });
  await expect.poll(() => backend).not.toBe("");
});
test.afterAll(() => child?.kill());

async function activity(
  page: Page,
  userId: string,
  baseURL: string,
  instance: string,
) {
  await page.route(`${origin}/**`, async (route) => {
    const incoming = new URL(route.request().url());
    const isGame = incoming.pathname.startsWith("/game/");
    const path = isGame ? incoming.pathname.slice(5) : incoming.pathname;
    const response = await route.fetch({
      url: `${isGame ? backend : baseURL}${path}${incoming.search}`,
      headers: { ...route.request().headers(), origin },
    });
    await route.fulfill({ response });
  });
  await page.routeWebSocket(
    `${origin.replace("https:", "wss:")}/.proxy/game/**`,
    (route) => {
      const incoming = new URL(route.url());
      const socket = new WebSocket(
        `${backend.replace("http:", "ws:")}${incoming.pathname.slice(12)}${incoming.search}`,
      );
      socket.binaryType = "arraybuffer";
      const pending: (string | Buffer)[] = [];
      socket.addEventListener("open", () => {
        for (const message of pending) socket.send(message);
        pending.length = 0;
      });
      route.onMessage((message) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(message);
        else pending.push(message);
      });
      socket.addEventListener("message", (event) =>
        route.send(
          typeof event.data === "string" ? event.data : Buffer.from(event.data),
        ),
      );
      socket.addEventListener("close", () => route.close());
      route.onClose(() => socket.close());
      page.once("close", () => socket.close());
    },
  );
  await page.addInitScript(
    ({ userId, clientId }) => {
      const RoutedWebSocket = window.WebSocket;
      window.WebSocket = class extends RoutedWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          if (
            protocols &&
            typeof protocols !== "string" &&
            !Array.isArray(protocols)
          )
            throw new SyntaxError("Invalid WebSocket protocols");
          super(url, protocols);
        }
      };
      window.addEventListener("message", (event) => {
        if (event.origin === "https://discord.com") return;
        const message = event.data;
        if (!Array.isArray(message) || ![0, 1, 2].includes(message[0])) return;
        event.stopImmediatePropagation();
        const [opcode, payload] = message;
        const reply = (data: unknown) =>
          setTimeout(
            () =>
              window.dispatchEvent(
                new MessageEvent("message", {
                  origin: "https://discord.com",
                  data: [1, data],
                }),
              ),
            0,
          );
        if (opcode === 0)
          reply({
            cmd: "DISPATCH",
            evt: "READY",
            nonce: null,
            data: {
              v: 1,
              config: {
                api_endpoint: "//discord.com/api",
                environment: "production",
              },
            },
          });
        if (opcode === 2)
          document.documentElement.dataset.discordClosed = "true";
        if (opcode !== 1) return;
        let data: unknown = {};
        if (payload.cmd === "AUTHORIZE") data = { code: userId };
        if (payload.cmd === "AUTHENTICATE")
          data = {
            access_token: userId,
            user: {
              id: userId,
              username: `Player ${userId[0]}`,
              discriminator: "0",
              public_flags: 0,
            },
            scopes: ["identify"],
            expires: "2099-01-01T00:00:00Z",
            application: {
              id: clientId,
              description: "Test",
              name: "Craft Ones",
            },
          };
        if (payload.cmd === "OPEN_INVITE_DIALOG")
          document.documentElement.dataset.discordInvited = "true";
        reply({ cmd: payload.cmd, evt: null, nonce: payload.nonce, data });
      });
    },
    { userId, clientId },
  );
  await page.goto(
    `${origin}/?frame_id=fixture&instance_id=${instance}&platform=desktop`,
  );
  await expect(
    page.getByRole("button", { name: "Join arena", exact: true }),
  ).toBeVisible();
}

test("Discord SDK flow joins two players through the proxy, invites and rejects a third", async ({
  browser,
  baseURL,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  try {
    const pages = await Promise.all(
      contexts.map((context) => context.newPage()),
    );
    await Promise.all(
      pages.map((page, i) =>
        activity(
          page,
          `${i + 2}`.repeat(18),
          baseURL ?? "http://localhost:3000",
          `browser-${test.info().retry}`,
        ),
      ),
    );
    await pages[0]
      .getByRole("button", { name: "Join arena", exact: true })
      .click();
    await expect(pages[0].getByTestId("battle")).toHaveAttribute(
      "data-phase",
      "waiting",
    );
    await pages[0]
      .getByRole("button", { name: "Invite in Discord", exact: true })
      .click();
    await expect(pages[0].locator("html")).toHaveAttribute(
      "data-discord-invited",
      "true",
    );
    await pages[1]
      .getByRole("button", { name: "Join arena", exact: true })
      .click();
    for (const page of pages.slice(0, 2)) {
      await expect(page.getByTestId("battle")).toHaveAttribute(
        "data-phase",
        "aiming",
      );
      await expect(page.locator("canvas")).toHaveAttribute(
        "data-ready",
        "true",
      );
    }
    await pages[0].screenshot({
      path: test.info().outputPath("discord-match.png"),
    });
    await pages[2]
      .getByRole("button", { name: "Join arena", exact: true })
      .click();
    await expect(
      pages[2].getByTestId("discord-setup").getByRole("alert"),
    ).toContainText("Both seats are taken");
    await pages[1].close();
    await expect(pages[0].getByTestId("battle")).toHaveAttribute(
      "data-phase",
      "finished",
    );
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("embedding is restricted to Discord and the dedicated route explains external launches", async ({
  page,
  request,
}) => {
  const root = await request.get("/");
  expect(root.headers()["content-security-policy"]).toContain(
    "frame-ancestors https://discord.com",
  );
  const local = await request.get("/playground");
  expect(local.headers()["content-security-policy"]).toBe(
    "frame-ancestors 'none'",
  );
  await page.goto("/discord");
  await expect(page.getByText(/Open Craft Ones from Discord/)).toBeVisible();
});
