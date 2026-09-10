import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 844, height: 390 },
  { width: 1280, height: 577 },
  { width: 390, height: 844 },
]) {
  test(`movement controls own their touch targets at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/playground");
    await expect(page.locator("canvas")).toBeFocused();
    for (const name of ["Move left", "Move right", "Jump"]) {
      const button = page.getByRole("button", { name, exact: true });
      const hit = await button.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return document
          .elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
          ?.closest("button")
          ?.getAttribute("aria-label");
      });
      expect(hit).toBe(name);
    }
  });
}

test("local menu freezes time and keyboard input until resumed", async ({
  page,
}) => {
  await page.goto("/playground");
  await expect(page.locator("canvas")).toBeFocused();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const battle = page.getByTestId("battle");
  const turn = await battle.getAttribute("data-turn");
  const remaining = await battle.getAttribute("data-remaining");
  const x = await page.getByTestId("player-1").getAttribute("data-x");
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(2100);
  await page.keyboard.up("KeyD");
  await expect(battle).toHaveAttribute("data-turn", turn ?? "");
  await expect(battle).toHaveAttribute("data-remaining", remaining ?? "");
  await expect(page.getByTestId("player-1")).toHaveAttribute("data-x", x ?? "");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect
    .poll(async () => Number(await battle.getAttribute("data-remaining")))
    .toBeLessThan(Number(remaining));
});

test("navigation and restart retain one live arena", async ({ page }) => {
  await page.goto("/");
  for (let i = 0; i < 3; i++) {
    await page.getByRole("link", { name: /Playground/ }).click();
    await page
      .getByRole("button", { name: "Start match", exact: true })
      .click();
    await expect(page.locator("canvas")).toBeFocused();
    await expect(page.locator("canvas")).toHaveCount(1);
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("button", { name: "Restart match" }).click();
    await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "1");
    await expect(page.locator("canvas")).toHaveCount(1);
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("link", { name: "Leave", exact: true }).click();
    await expect(page.getByRole("link", { name: /Create Game/ })).toBeVisible();
  }
});
