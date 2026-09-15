import { expect, test } from "@playwright/test";
import { aimWorld, power } from "./gameplay";

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
    let shift = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const player = page.getByTestId("player-1");
    const x = Number(await player.getAttribute("data-x"));
    const y = Number(await player.getAttribute("data-y"));
    await aimWorld(page, x + 200, y - 160);
    Date.now = () => wallNow() + shift;
    page.mouse.down = async (options) => {
      await mouseDown.call(page.mouse, options);
      timer = setTimeout(() => {
        shift = clockShift;
      }, 50);
    };
    try {
      await page.mouse.down();
      await expect.poll(() => power(page)).toBe(100);
      await page.mouse.up();
    } finally {
      clearTimeout(timer);
      Date.now = wallNow;
      page.mouse.down = mouseDown;
    }
    await expect(canvas).toHaveAttribute("data-fire-power", "1");
  });
}
