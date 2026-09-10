import { expect, test } from "@playwright/test";

test.use({ launchOptions: { args: ["--use-angle=swiftshader"] } });

test("software WebGL uses a playable Canvas renderer", async ({ page }) => {
  await page.goto("/playground");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeFocused();
  expect(
    await canvas.evaluate(
      (element) =>
        element instanceof HTMLCanvasElement && !!element.getContext("2d"),
    ),
  ).toBe(true);
  await page.keyboard.down("KeyD");
  await expect(
    page.getByRole("meter", { name: "Range remaining" }),
  ).toHaveAttribute("aria-valuenow", "0");
  await page.keyboard.up("KeyD");
  await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "1");
});
