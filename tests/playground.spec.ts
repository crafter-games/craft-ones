import { expect, test } from "@playwright/test";
import { aimAtOpponent } from "./gameplay";

for (const mapId of ["andes", "coast"]) {
  test(`offline playground: ${mapId} completes a real pointer-controlled match and restarts`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/matchmake/**", (route) => route.abort());
    await page.goto("/");
    await page.getByRole("link", { name: "Playground" }).click();
    await page.getByLabel("Map", { exact: true }).selectOption(mapId);
    await expect(page.getByTestId("battle")).toHaveAttribute(
      "data-phase",
      "aiming",
    );
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(1);
    for (let shot = 0; shot < 9; shot++) {
      if (
        (await page.getByTestId("battle").getAttribute("data-phase")) ===
        "finished"
      )
        break;
      const number = Number(
        await page.getByTestId("battle").getAttribute("data-current-player"),
      );
      const target = page.getByTestId(`player-${number === 1 ? 2 : 1}`);
      const hp = Number(await target.getAttribute("data-hp"));
      const x = await target.getAttribute("data-x");
      await aimAtOpponent(page, number);
      await expect(page.getByTestId("battle")).toHaveAttribute(
        "data-phase",
        "flying",
      );
      await expect
        .poll(async () => Number(await target.getAttribute("data-hp")))
        .toBeLessThan(hp);
      await expect(target).not.toHaveAttribute("data-x", x ?? "");
      await expect(page.getByTestId("battle")).toHaveAttribute(
        "data-phase",
        /aiming|finished/,
      );
    }
    await expect(page.getByTestId("match-status")).toHaveText(
      /Player [12] wins!/,
    );
    await expect(page.locator('[data-hp="0"]')).toHaveCount(1);
    await page.getByRole("button", { name: "Play again", exact: true }).click();
    await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "1");
    await expect(page.getByTestId("player-1")).toHaveAttribute(
      "data-hp",
      "100",
    );
    await expect(page.getByTestId("player-2")).toHaveAttribute(
      "data-hp",
      "100",
    );
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test("movement budget, lab options, high-shot camera and restarting during flight", async ({
  page,
}) => {
  await page.goto("/playground");
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").focus();
  await page.keyboard.down("KeyD");
  await expect(page.getByTestId("player-1")).toHaveAttribute(
    "data-movement",
    "0",
  );
  await page.keyboard.up("KeyD");
  await expect(page.getByTestId("player-1")).toHaveAttribute("data-x", "336");
  await page.getByText("Lab tools", { exact: false }).click();
  await page.getByLabel("Infinite HP", { exact: true }).check();
  await page.getByLabel("Show collisions", { exact: true }).check();
  await page.getByLabel("Destructible ground", { exact: true }).check();
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  const canvas = page.locator("canvas");
  await canvas.click({ trial: true });
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Missing canvas");
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.15);
  await page.mouse.down();
  await expect
    .poll(async () =>
      Number(await page.locator("#power").getAttribute("value")),
    )
    .toBe(100);
  await page.mouse.up();
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-camera-zoom")))
    .toBeLessThan(0.8);
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-phase",
    "aiming",
  );
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-explosion",
    "0",
  );
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-camera-zoom")))
    .toBeGreaterThan(0.998);
});

test("mobile local movement and touch aim survive portrait-to-landscape resize", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  try {
    await page.goto("/playground");
    await expect(page.locator("canvas")).toBeVisible();
    await page.getByRole("button", { name: "Move right", exact: true }).tap();
    await expect(page.getByTestId("player-1")).toHaveAttribute("data-x", "248");
    const canvas = page.locator("canvas");
    await page.bringToFront();
    await canvas.tap({ trial: true });
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Missing canvas");
    const cdp = await context.newCDPSession(page);
    const point = { x: box.x + box.width * 0.39, y: box.y + box.height * 0.54 };
    const scroll = await page.evaluate(() => window.scrollY);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point],
    });
    await expect
      .poll(async () =>
        Number(await page.locator("#power").getAttribute("value")),
      )
      .toBeGreaterThan(20);
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
    expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "2");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(canvas).toBeVisible();
    await page.screenshot({
      path: "test-results/playground-mobile-landscape.png",
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});
