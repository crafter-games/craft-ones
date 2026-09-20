import { expect, test } from "@playwright/test";
import { openMenu, settled } from "./gameplay";
import { expectCameraToRespectHud, expectHudToFit, hudViewports } from "./hud";

test("HUD fits changing Activity dimensions with all seven tools and no canvas remount", async ({
  page,
}) => {
  await page.goto("/local?species=railly&coat=cream");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  const original = await canvas.elementHandle();
  await expect(
    page.getByRole("toolbar", { name: "Arsenal" }).getByRole("button"),
  ).toHaveCount(7);
  for (const viewport of hudViewports) {
    await page.setViewportSize(viewport);
    await expectHudToFit(page);
    await expectCameraToRespectHud(page);
    expect(
      await original?.evaluate(
        (element) => element === document.querySelector("canvas"),
      ),
    ).toBe(true);
    await page.screenshot({
      path: test
        .info()
        .outputPath(`hud-${viewport.width}x${viewport.height}.png`),
    });
  }
});

test("HUD uses the arena container and safe areas, and keeps compact menus reachable", async ({
  page,
}) => {
  await page.goto("/playground?species=railly&coat=cream");
  await expect(page.locator("canvas")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("battle").evaluate((arena) => {
    arena.style.width = "640px";
    arena.style.height = "360px";
    document.documentElement.style.setProperty(
      "--discord-safe-area-inset-left",
      "12px",
    );
    document.documentElement.style.setProperty(
      "--discord-safe-area-inset-right",
      "12px",
    );
  });
  await expectHudToFit(page);
  await expectCameraToRespectHud(page);
  await expect(page.locator(".hud")).toHaveCSS("padding-left", "22px");
  await openMenu(page);
  const panel = page.locator(".hud-modal.is-menu");
  await expect(panel).toBeVisible();
  expect(
    await panel.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return (
        bounds.top >= 0 &&
        bounds.bottom <= 360 &&
        element.scrollHeight > element.clientHeight
      );
    }),
  ).toBe(true);
  await expect(page.locator(".hud-key-help")).toContainText("1–7 tools");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expectHudToFit(page);
});

for (const viewport of [
  { width: 640, height: 360 },
  { width: 390, height: 700 },
]) {
  test(`touch movement, jump and a charged ability stay reachable at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    try {
      await page.goto("/local?species=railly&coat=cream");
      const canvas = page.locator("canvas");
      await expect(canvas).toHaveAttribute("data-ready", "true");
      await expectHudToFit(page);
      const player = page.getByTestId("player-1");
      const x = await player.getAttribute("data-x");
      await page.getByRole("button", { name: "Move right", exact: true }).tap();
      await expect(player).not.toHaveAttribute("data-x", x ?? "");
      await settled(page);
      const y = Number(await player.getAttribute("data-y"));
      await page.getByRole("button", { name: "Jump", exact: true }).tap();
      await expect
        .poll(async () => Number(await player.getAttribute("data-y")))
        .toBeLessThan(y);
      await page.getByTestId("character-ability").tap();
      await expectHudToFit(page);
      await page.bringToFront();
      await canvas.tap({ trial: true });
      const point = await page.evaluate(() => {
        const top = document.querySelector(".hud-top")?.getBoundingClientRect();
        const bottom = document
          .querySelector(".hud-bottom")
          ?.getBoundingClientRect();
        if (!top || !bottom) throw new Error("Missing HUD");
        return { x: innerWidth / 2, y: (top.bottom + bottom.top) / 2 };
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [point],
      });
      const meter = page.getByRole("meter", { name: "Shot power" });
      await expect
        .poll(async () => Number(await meter.getAttribute("aria-valuenow")))
        .toBeGreaterThan(10);
      await expectHudToFit(page);
      const camera = await canvas.getAttribute("data-camera-zoom");
      await expect
        .poll(async () => Number(await meter.getAttribute("aria-valuenow")))
        .toBeGreaterThan(25);
      await expect(canvas).toHaveAttribute("data-camera-zoom", camera ?? "");
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect(page.getByTestId("battle")).toHaveAttribute(
        "data-phase",
        "flying",
      );
      await expect(page.getByTestId("battle")).toHaveAttribute(
        "data-projectile-kind",
        "shuriken",
      );
    } finally {
      await context.close();
    }
  });
}
