import { expect, test } from "@playwright/test";
import { openMenu, restartMatch } from "./gameplay";

test("online rejections expire, clear after accepted actions and leave connection errors persistent", async ({
  page,
  browser,
}) => {
  await page.addInitScript(() => {
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      (window as unknown as { gameSocket: WebSocket }).gameSocket = this;
      return send.call(this, data);
    };
  });
  await page.goto("/setup?mode=create");
  await page.getByRole("button", { name: "Start match" }).click();
  await expect(page).toHaveURL(/\/game\/[\w-]+$/);
  const rival = await browser.newPage();
  try {
    await rival.goto(page.url());
    await rival.getByRole("button", { name: "Join Game", exact: true }).click();
    await page.bringToFront();
    await expect(page.getByTestId("battle")).toHaveAttribute(
      "data-phase",
      "aiming",
    );
    await expect(page.locator("canvas")).toHaveAttribute("data-ready", "true");
    const jump = page.getByRole("button", { name: "Jump", exact: true });
    const notice = page.getByTestId("action-notice");
    await jump.click();
    await jump.click();
    await expect(notice).toHaveText("Jump unavailable");
    await expect(notice).toHaveCount(0, { timeout: 4_000 });
    await jump.click();
    await jump.click();
    await expect(notice).toHaveText("Jump unavailable");
    await page.getByRole("button", { name: "Move right", exact: true }).click();
    await expect(notice).toHaveCount(0);
    await jump.click();
    await expect(notice).toHaveText("Jump unavailable");
    await page.evaluate(() => {
      (window as unknown as { gameSocket: WebSocket }).gameSocket.close();
    });
    await expect(page.locator("main [role=alert]")).toContainText(
      "Disconnected",
    );
    await expect(notice).toHaveCount(0, { timeout: 4_000 });
    await expect(page.locator("main [role=alert]")).toContainText(
      "Disconnected",
    );
  } finally {
    await rival.close();
  }
});

test("a turn change clears a recent local rejection", async ({ page }) => {
  await page.goto("/local");
  await expect(page.locator("canvas")).toBeFocused();
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-remaining",
    "2",
    { timeout: 16_000 },
  );
  const jump = page.getByRole("button", { name: "Jump", exact: true });
  await jump.click();
  await jump.click();
  await expect(page.getByTestId("action-notice")).toHaveText(
    "Jump unavailable",
  );
  await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "2");
  await expect(page.getByTestId("action-notice")).toHaveCount(0);
});

test("local action rejections expire while paused and clear on a valid action or restart", async ({
  page,
}) => {
  await page.goto("/playground");
  await expect(page.locator("canvas")).toBeFocused();
  const jump = page.getByRole("button", { name: "Jump", exact: true });
  const notice = page.getByTestId("action-notice");
  await jump.click();
  await jump.click();
  await expect(page.getByRole("status")).toHaveText("Jump unavailable");
  await openMenu(page);
  await expect(notice).toHaveCount(0, { timeout: 4_000 });
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Move left", exact: true }).click();
  await jump.click();
  await expect(notice).toHaveText("Jump unavailable");
  await page.getByRole("button", { name: "Move right", exact: true }).click();
  await expect(notice).toHaveCount(0);
  await jump.click();
  await jump.click();
  await expect(notice).toHaveText("Jump unavailable");
  await restartMatch(page);
  await expect(notice).toHaveCount(0);
});
