import { expect, test } from "@playwright/test";
import { aimAtOpponent } from "./gameplay";

for (const clockShift of [60_000, -60_000]) {
  test(`aiming reaches full charge when the worker clock shifts by ${clockShift}ms`, async ({
    page,
  }) => {
    await page.goto("/playground");
    const canvas = page.locator("canvas");
    await expect(canvas).toBeFocused();
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(120);
    await page.keyboard.up("KeyD");
    await page.keyboard.press("KeyW");
    const wallNow = Date.now;
    const mouseDown = page.mouse.down;
    const mouseMove = page.mouse.move;
    let charging = false;
    let shift = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    Date.now = () => wallNow() + shift;
    page.mouse.down = async (options) => {
      await mouseDown.call(page.mouse, options);
      charging = true;
      timer = setTimeout(() => {
        shift = clockShift;
      }, 50);
    };
    page.mouse.move = async (x, y, options) => {
      if (charging)
        expect(
          Number(await page.locator("#power").getAttribute("data-value")),
        ).toBe(100);
      await mouseMove.call(page.mouse, x, y, options);
    };
    try {
      await aimAtOpponent(page, 1, true);
    } finally {
      clearTimeout(timer);
      Date.now = wallNow;
      page.mouse.down = mouseDown;
      page.mouse.move = mouseMove;
    }
    await expect(canvas).toHaveAttribute("data-fire-power", "1");
  });
}
