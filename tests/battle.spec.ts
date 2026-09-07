import { expect, type Page, test } from "@playwright/test";

async function createRoom(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Game", exact: true }).click();
  await expect(page).toHaveURL(/\/game\/[a-zA-Z0-9_-]+$/);
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-phase",
    "waiting",
  );
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  return page.url();
}

async function aimAtOpponent(page: Page, number: number) {
  const from = page.getByTestId(`player-${number}`);
  const to = page.getByTestId(`player-${number === 1 ? 2 : 1}`);
  const x = Number(await from.getAttribute("data-x"));
  const target = Number(await to.getAttribute("data-x"));
  const angle = number === 1 ? -Math.PI / 4 : (-3 * Math.PI) / 4;
  const dx = target - x - Math.cos(angle) * 20;
  const dy = -Math.sin(angle) * 20;
  const speed = Math.sqrt(
    (420 * dx ** 2) / (2 * Math.cos(angle) ** 2 * (dy - dx * Math.tan(angle))),
  );
  const power = Math.max(0, Math.min(1, (speed - 240) / 460));
  const canvas = await page.locator("canvas").boundingBox();
  if (!canvas) throw new Error("Arena canvas not visible");
  await page.mouse.move(
    canvas.x + ((x + Math.cos(angle) * 130) * canvas.width) / 960,
    canvas.y + ((422 + Math.sin(angle) * 130) * canvas.height) / 540,
  );
  await page.mouse.down();
  await page.waitForFunction(
    (targetPower) => {
      const meter = document.getElementById("power") as HTMLMeterElement | null;
      return (meter?.value ?? 0) >= targetPower;
    },
    Math.round(power * 100) - 1,
    { polling: "raf" },
  );
  await page.mouse.up();
}

test("invite flow and a complete mouse-controlled 1v1 reach the same winner", async ({
  browser,
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const invite = await createRoom(page);
  await page.getByRole("button", { name: "Copy Invite Link" }).click();
  await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    invite,
  );
  const rivalContext = await browser.newContext();
  const rival = await rivalContext.newPage();
  rival.on("pageerror", (error) => errors.push(error.message));
  try {
    await rival.goto(invite);
    for (const client of [page, rival]) {
      await expect(client.getByTestId("battle")).toHaveAttribute(
        "data-phase",
        "aiming",
      );
      await expect(client.getByTestId("battle")).toHaveAttribute(
        "data-current-player",
        "1",
      );
      await expect(client.getByTestId("player-1")).toHaveAttribute(
        "data-hp",
        "100",
      );
      await expect(client.getByTestId("player-2")).toHaveAttribute(
        "data-hp",
        "100",
      );
      await expect(client.locator("canvas")).toHaveCount(1);
    }
    const third = await browser.newPage();
    await third.goto(invite);
    await expect(third.locator('main [role="alert"]')).toContainText(
      "This room is full",
    );
    await third.close();
    for (let shot = 0; shot < 9; shot++) {
      if (
        (await page.getByTestId("battle").getAttribute("data-phase")) ===
        "finished"
      )
        break;
      const number = Number(
        await page.getByTestId("battle").getAttribute("data-current-player"),
      );
      const active = number === 1 ? page : rival;
      const target = `player-${number === 1 ? 2 : 1}`;
      const hp = Number(await page.getByTestId(target).getAttribute("data-hp"));
      await active.bringToFront();
      await aimAtOpponent(active, number);
      for (const client of [page, rival]) {
        await expect(client.getByTestId("battle")).toHaveAttribute(
          "data-phase",
          "flying",
        );
      }
      await expect
        .poll(async () =>
          Number(await page.getByTestId(target).getAttribute("data-hp")),
        )
        .toBeLessThan(hp);
      await expect(page.getByTestId("battle")).toHaveAttribute(
        "data-phase",
        /aiming|finished/,
      );
      const phase = await page.getByTestId("battle").getAttribute("data-phase");
      await expect(rival.getByTestId("battle")).toHaveAttribute(
        "data-phase",
        phase ?? "",
      );
      for (const player of [1, 2]) {
        for (const field of ["data-hp", "data-x"]) {
          await expect(rival.getByTestId(`player-${player}`)).toHaveAttribute(
            field,
            (await page.getByTestId(`player-${player}`).getAttribute(field)) ??
              "",
          );
        }
      }
      if (phase !== "finished") {
        await expect(page.getByTestId("battle")).toHaveAttribute(
          "data-current-player",
          number === 1 ? "2" : "1",
        );
      }
    }
    await expect(page.getByTestId("battle")).toHaveAttribute(
      "data-phase",
      "finished",
    );
    const winner = await page.getByTestId("match-status").textContent();
    expect(winner).toMatch(/Player [12] wins!/);
    await expect(rival.getByTestId("match-status")).toHaveText(winner ?? "");
    const hpValues = await page
      .locator("[data-hp]")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-hp")),
      );
    expect(hpValues).toContain("0");
    expect(errors).toEqual([]);
  } finally {
    await rivalContext.close();
  }
});

test("idle timeout passes the turn and disconnect awards the remaining player", async ({
  browser,
  page,
}) => {
  const invite = await createRoom(page);
  const context = await browser.newContext();
  const rival = await context.newPage();
  try {
    await rival.goto(invite);
    await expect(page.getByTestId("battle")).toHaveAttribute(
      "data-current-player",
      "1",
    );
    await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "2", {
      timeout: 18_000,
    });
    await expect(rival.getByTestId("battle")).toHaveAttribute(
      "data-current-player",
      "2",
    );
    await rival.close();
    await expect(page.getByTestId("match-status")).toHaveText("Player 1 wins!");
    await expect(page.getByText("Your opponent disconnected.")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("mobile touch charges and fires without scrolling the arena", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const rivalContext = await browser.newContext();
  const rival = await rivalContext.newPage();
  try {
    const invite = await createRoom(page);
    await rival.goto(invite);
    await expect(page.getByTestId("battle")).toHaveAttribute(
      "data-phase",
      "aiming",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.bringToFront();
    await page.locator("canvas").tap({ trial: true });
    const canvas = await page.locator("canvas").boundingBox();
    if (!canvas) throw new Error("Missing touch arena");
    const cdp = await context.newCDPSession(page);
    const point = {
      x: canvas.x + canvas.width * 0.36,
      y: canvas.y + canvas.height * 0.55,
    };
    const scroll = await page.evaluate(() => window.scrollY);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point],
    });
    await expect
      .poll(async () =>
        Number(await page.locator("#power").getAttribute("value")),
      )
      .toBeGreaterThan(10);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: point.x + 8, y: point.y - 8 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(page.getByTestId("battle")).toHaveAttribute(
      "data-phase",
      "flying",
    );
    await expect(rival.getByTestId("battle")).toHaveAttribute(
      "data-phase",
      "flying",
    );
    expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
    await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "2");
  } finally {
    await context.close();
    await rivalContext.close();
  }
});

test("missing rooms show a recoverable error", async ({ page }) => {
  await page.goto("/game/missing-room");
  await expect(page.locator('main [role="alert"]')).toContainText(
    "no longer exists",
  );
  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(
    page.getByRole("button", { name: "Create Game", exact: true }),
  ).toBeVisible();
});
