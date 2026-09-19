import { expect, type Page, test } from "@playwright/test";
import { aimAtOpponent, power } from "./gameplay";

async function createRoom(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: /Create Game/ }).click();
  await page.getByRole("button", { name: "Start match" }).click();
  await expect(page).toHaveURL(/\/game\/[a-zA-Z0-9_-]+$/);
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-phase",
    "waiting",
  );
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  return page.url();
}

test("invite flow and a complete mouse-controlled 1v1 reach the same winner", async ({
  browser,
  page,
}) => {
  test.setTimeout(210_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const roomUrl = await createRoom(page);
  await page.getByRole("button", { name: "Copy Invite Link" }).click();
  await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible();
  // The invite carries the host's critter and map so the join screen can name them.
  const invite = await page.evaluate(() => navigator.clipboard.readText());
  expect(invite).toBe(`${roomUrl}?host=cuy&coat=caramel&map=andes`);
  const rivalContext = await browser.newContext({ ...test.info().project.use });
  const rival = await rivalContext.newPage();
  rival.on("pageerror", (error) => errors.push(error.message));
  try {
    await rival.goto(invite);
    await expect(rival.locator(".host-card")).toContainText(
      "Guinea Pig is waiting in Cloudbreak Valley",
    );
    await rival.getByRole("button", { name: "Join Game", exact: true }).click();
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
    // Each client marks its own seat, whatever the turn indicator says.
    for (const [client, seat] of [
      [page, 1],
      [rival, 2],
    ] as const) {
      const own = client.getByTestId(`player-${seat}`);
      const other = client.getByTestId(`player-${3 - seat}`);
      await expect(own).toHaveAttribute("data-role", "you");
      await expect(own.locator(".hud-card-role")).toHaveText("YOU");
      await expect(other).toHaveAttribute("data-role", "opponent");
      await expect(other.locator(".hud-card-role")).toHaveText("OPPONENT");
    }
    for (let shot = 0; shot < 12; shot++) {
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
      const terrainRevision = Number(
        await page.getByTestId("battle").getAttribute("data-terrain-revision"),
      );
      await active.bringToFront();
      await aimAtOpponent(active, number);
      for (const client of [page, rival]) {
        await expect(client.getByTestId("battle")).toHaveAttribute(
          "data-phase",
          "flying",
        );
      }
      await expect
        .poll(async () => {
          const nextHp = Number(
            await page.getByTestId(target).getAttribute("data-hp"),
          );
          const nextRevision = Number(
            await page
              .getByTestId("battle")
              .getAttribute("data-terrain-revision"),
          );
          return nextHp < hp || nextRevision > terrainRevision;
        })
        .toBe(true);
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
          await expect
            .poll(async () => {
              const [left, right] = await Promise.all([
                page.getByTestId(`player-${player}`).getAttribute(field),
                rival.getByTestId(`player-${player}`).getAttribute(field),
              ]);
              return left !== null && left === right;
            })
            .toBe(true);
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
    const third = await browser.newPage({ ...test.info().project.use });
    await third.goto(invite);
    await third.getByRole("button", { name: "Join Game", exact: true }).click();
    await expect(third.locator('main [role="alert"]')).toContainText(
      "This room is full",
    );
    await third.close();
    const finalTurn = Number(
      await page.getByTestId("battle").getAttribute("data-turn"),
    );
    await page.getByRole("button", { name: "Play again", exact: true }).click();
    for (const client of [page, rival]) {
      await expect(client.locator(".hud-clock small")).toContainText("ROUND 1");
      await expect(client.getByTestId("battle")).toHaveAttribute(
        "data-phase",
        "aiming",
      );
      await expect(client.getByTestId("battle")).toHaveAttribute(
        "data-turn",
        String(finalTurn + 1),
      );
      await expect(client.getByTestId("player-1")).toHaveAttribute(
        "data-hp",
        "100",
      );
      await expect(client.getByTestId("player-2")).toHaveAttribute(
        "data-hp",
        "100",
      );
    }
    await aimAtOpponent(page, 1);
    await expect(rival.getByTestId("battle")).toHaveAttribute(
      "data-phase",
      "flying",
    );
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
  const context = await browser.newContext({ ...test.info().project.use });
  const rival = await context.newPage();
  try {
    await rival.goto(invite);
    await rival.getByRole("button", { name: "Join Game", exact: true }).click();
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
    await expect(page.getByText("Your rival disconnected.")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("mobile touch charges and fires without scrolling the arena", async ({
  browser,
}) => {
  const context = await browser.newContext({
    ...test.info().project.use,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const rivalContext = await browser.newContext({ ...test.info().project.use });
  const rival = await rivalContext.newPage();
  try {
    const invite = await createRoom(page);
    await rival.goto(invite);
    await rival.getByRole("button", { name: "Join Game", exact: true }).click();
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
    await expect.poll(async () => await power(page)).toBeGreaterThan(10);
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
  await page.getByRole("button", { name: "Join Game", exact: true }).click();
  await expect(page.locator('main [role="alert"]')).toContainText(
    "no longer exists",
  );
  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(page.getByRole("link", { name: /Local/ })).toBeVisible();
});
