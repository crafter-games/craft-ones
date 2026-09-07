import { expect, test } from "@playwright/test";
import { aimAtOpponent, aimWorld, overview } from "./gameplay";

test("radial roster explains each ability and keeps new characters and coats in local play", async ({
  page,
}) => {
  await page.goto("/");
  const picker = page.getByRole("group", { name: "Your critter", exact: true });
  for (const [name, ability] of [
    ["Cuy", "Second wind"],
    ["Llama", "Andean leap"],
    ["Zorro", "Quickstep"],
    ["Ronsoco", "Iron hide"],
  ]) {
    const button = picker.getByRole("button", { name, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(
      picker.getByRole("heading", { name: ability, exact: true }),
    ).toBeVisible();
    await expect(picker.getByText("UNIQUE ABILITY · 1 TURN")).toBeVisible();
  }
  await picker
    .getByRole("button", { name: "Your critter: Slate", exact: true })
    .click();
  await page.getByRole("link", { name: "Playground" }).click();
  await expect(page.getByTestId("player-1")).toHaveAttribute(
    "data-species",
    "ronsoco",
  );
  await expect(page.getByTestId("player-1")).toHaveAttribute(
    "data-coat",
    "slate",
  );
  await page
    .getByRole("button", { name: "Iron hide · 1 turn", exact: true })
    .click();
  await expect(page.getByTestId("player-1")).toContainText("+30 shield");
  await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "2");
});

for (const mapId of ["andes", "coast"]) {
  test(`offline playground: ${mapId} completes a real pointer-controlled match and restarts`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/matchmake/**", (route) => route.abort());
    await page.goto("/");
    await page.getByRole("link", { name: "Playground" }).click();
    await page.getByText("Match setup", { exact: false }).click();
    await page
      .getByRole("button", {
        name: mapId === "andes" ? "Cloudbreak Valley" : "Amber Hollows",
      })
      .click();
    await page.getByText("Match setup", { exact: false }).click();
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

test("free movement, lab options, high-shot camera and restarting during flight", async ({
  page,
}) => {
  await page.goto("/playground");
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("canvas").focus();
  await page.keyboard.down("KeyD");
  await expect
    .poll(async () =>
      Number(await page.getByTestId("player-1").getAttribute("data-x")),
    )
    .toBeGreaterThan(384);
  await page.keyboard.up("KeyD");
  await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "1");
  await page.getByText("Lab tools", { exact: false }).click();
  await page.getByLabel("Infinite HP", { exact: true }).check();
  await page.getByLabel("Show collisions", { exact: true }).check();
  await page.getByLabel("Destructible ground", { exact: true }).check();
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  const canvas = page.locator("canvas");
  await overview(page);
  await aimWorld(page, 288, 100);
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
    .toBeGreaterThan(0.9);
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
    await expect(page.getByTestId("player-1")).toHaveAttribute("data-x", "296");
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

test("character colors, every weapon, turn camera and crater feedback are playable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/playground");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByText("Match setup", { exact: false }).click();
  await page
    .getByRole("group", { name: "Player 1", exact: true })
    .getByRole("button", { name: "Llama", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Player 1: Rose", exact: true })
    .click();
  await expect(page.getByTestId("player-1")).toHaveAttribute(
    "data-species",
    "llama",
  );
  await expect(page.getByTestId("player-1")).toHaveAttribute(
    "data-coat",
    "rose",
  );
  await page.screenshot({
    path: "test-results/match-setup.png",
    fullPage: true,
  });
  await page.getByText("Match setup", { exact: false }).click();
  await page
    .getByRole("button", { name: "Focus character", exact: true })
    .click();
  await expect
    .poll(async () =>
      Number(await page.locator("canvas").getAttribute("data-camera-zoom")),
    )
    .toBeGreaterThan(1.1);
  await page.screenshot({
    path: "test-results/character-focus.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "View whole map", exact: true })
    .click();
  await overview(page);
  for (const name of ["Rocket", "Mortar", "Dynamite", "Grapple", "Grenade"]) {
    const weapon = page.getByRole("button", { name, exact: true });
    await weapon.click();
    await expect(weapon).toHaveAttribute("aria-pressed", "true");
  }
  await aimWorld(page, 450, 570);
  await page.mouse.down();
  await page.waitForFunction(
    () => Number(document.querySelector("#power")?.getAttribute("value")) >= 10,
  );
  await page.mouse.up();
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-phase",
    "flying",
  );
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-terrain-revision",
    "1",
  );
  await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "2");
  await overview(page);
  await page.screenshot({
    path: "test-results/layered-arena-crater.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Andean leap · 1 turn", exact: true })
    .click();
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-phase",
    "resolving",
  );
  await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "3");
  expect(errors).toEqual([]);
});

test("home selections carry into local play and basic jump preserves the shot", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Amber Hollows" }).click();
  await page.getByRole("button", { name: "Llama", exact: true }).click();
  await page
    .getByRole("button", { name: "Your critter: Sage", exact: true })
    .click();
  await page.getByRole("link", { name: "Playground" }).click();
  await expect(page.getByTestId("battle")).toHaveAttribute("data-map", "coast");
  await expect(page.getByTestId("player-1")).toHaveAttribute(
    "data-species",
    "llama",
  );
  await expect(page.getByTestId("player-1")).toHaveAttribute(
    "data-coat",
    "sage",
  );
  const y = Number(await page.getByTestId("player-1").getAttribute("data-y"));
  await page.getByRole("button", { name: "Jump", exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId("player-1").getAttribute("data-y")),
    )
    .toBeLessThan(y - 15);
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-phase",
    "aiming",
  );
  await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "1");
  await expect
    .poll(async () =>
      Math.abs(
        Number(await page.getByTestId("player-1").getAttribute("data-y")) - y,
      ),
    )
    .toBeLessThan(1);
  await aimAtOpponent(page, 1);
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-phase",
    "flying",
  );
});
