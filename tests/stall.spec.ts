import { expect, test } from "@playwright/test";

test("local projectile simulation catches up after a foreground rendering stall", async ({
  page,
}) => {
  await page.goto("/playground");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeFocused();
  await page.keyboard.down("Space");
  await expect
    .poll(async () =>
      Number(await page.locator("#power").getAttribute("data-value")),
    )
    .toBe(100);
  await page.keyboard.up("Space");
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-phase",
    "flying",
  );
  const advanced = await page.evaluate(async () => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement;
    const before = Number(canvas.dataset.projectileElapsed);
    const end = performance.now() + 1200;
    while (performance.now() < end) {}
    await new Promise((resolve) => setTimeout(resolve, 60));
    return Number(canvas.dataset.projectileElapsed) - before;
  });
  expect(advanced).toBeGreaterThan(900);
});
