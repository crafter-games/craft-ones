import { expect, test } from "@playwright/test";
import { aimWorld, overview, power, restartMatch } from "./gameplay";

for (const [species, name, skill, projectile] of [
  ["freddy", "Freddy", "Dimensional rift", "rift"],
  ["michi", "Michi", "Cosmic meow", "meow"],
  ["railly", "Railly Hugo", "Triangle barrage", "shuriken"],
]) {
  test(`${name}'s retained implementation has a charged, cancellable aimed power`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.url().includes("/art/") && response.status() >= 400)
        errors.push(response.url());
    });
    await page.goto(`/playground?species=${species}&coat=cream`);
    await expect(page.locator("canvas")).toBeFocused();
    const battle = page.getByTestId("battle");
    await expect(page.getByTestId("player-1")).toHaveAttribute(
      "data-species",
      species,
    );
    const ability = page.getByTestId("character-ability");
    await expect(ability).toHaveAccessibleName(`${skill} · 1 turn`);
    await ability.click();
    await expect(ability).toHaveAttribute("aria-pressed", "true");
    await expect(battle).toHaveAttribute("data-turn", "1");
    await expect(battle).toHaveAttribute("data-phase", "aiming");
    await page.keyboard.press("7");
    await expect(ability).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("7");
    await page.getByRole("button", { name: "Rocket", exact: true }).click();
    await expect(ability).toHaveAttribute("aria-pressed", "false");
    await ability.click();
    await overview(page);
    const player = page.getByTestId("player-1");
    const x = Number(await player.getAttribute("data-x"));
    const y = Number(await player.getAttribute("data-y"));
    await aimWorld(page, x + 200, y - 160);
    await page.mouse.down();
    await expect.poll(() => power(page)).toBeGreaterThan(20);
    await page.mouse.up();
    await expect(battle).toHaveAttribute("data-phase", "flying");
    await expect(battle).toHaveAttribute("data-projectile-kind", projectile);
    await expect(battle).toHaveAttribute("data-turn", "2", { timeout: 18000 });
    await expect(battle).toHaveAttribute(
      "data-explosion",
      species === "railly" ? "3" : "1",
    );
    await restartMatch(page);
    await expect(battle).toHaveAttribute("data-explosion", "0");
    await expect(ability).toBeEnabled();
    await expect(ability).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test("Freddy and Michi are absent from the public character selector", async ({
  page,
}) => {
  await page.goto("/setup?mode=local");
  const seat = page.getByRole("group", { name: "Player 1", exact: true });
  await expect(seat.locator('img[src*="/art/freddy/"]')).toHaveCount(0);
  await expect(seat.locator('img[src*="/art/michi/"]')).toHaveCount(0);
  await expect(seat).toContainText("01 / 07");
});

test("Railly can aim and release his exclusive skill on a touch screen", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto("/playground?species=railly&coat=cream");
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    await page.bringToFront();
    await canvas.tap({ trial: true });
    const ability = page.getByTestId("character-ability");
    await ability.tap();
    await expect(ability).toHaveAttribute("aria-pressed", "true");
    await overview(page);
    await canvas.tap({ trial: true });
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Missing canvas");
    const cdp = await context.newCDPSession(page);
    const point = { x: box.x + box.width * 0.4, y: box.y + box.height * 0.4 };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point],
    });
    await expect.poll(() => power(page)).toBeGreaterThan(20);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(page.getByTestId("battle")).toHaveAttribute(
      "data-projectile-kind",
      "shuriken",
    );
    await expect(page.getByTestId("battle")).toHaveAttribute(
      "data-phase",
      "flying",
    );
    await page.screenshot({
      path: test.info().outputPath("railly-touch-skill.png"),
    });
  } finally {
    await context.close();
  }
});
