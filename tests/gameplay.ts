import { expect, type Page } from "@playwright/test";

/** Aim through actual pointer input, compensating for the live camera transform. */
export async function aimAtOpponent(page: Page, number: number) {
  await page.locator("canvas").click({ trial: true });
  const from = page.getByTestId(`player-${number}`);
  const to = page.getByTestId(`player-${number === 1 ? 2 : 1}`);
  const x = Number(await from.getAttribute("data-x"));
  const y = Number(await from.getAttribute("data-y"));
  const tx = Number(await to.getAttribute("data-x"));
  const ty = Number(await to.getAttribute("data-y"));
  const angle = tx > x ? -Math.PI / 3 : (-2 * Math.PI) / 3;
  const dx = tx - x - Math.cos(angle) * 22;
  const dy = ty - y - Math.sin(angle) * 22;
  const speed = Math.sqrt(
    (420 * dx ** 2) / (2 * Math.cos(angle) ** 2 * (dy - dx * Math.tan(angle))),
  );
  const power = Math.max(0, Math.min(1, (speed - 240) / 760));
  // Allow the turn introduction to pull back, then use the actual camera transform.
  await overview(page);
  await aimWorld(page, x + Math.cos(angle) * 170, y + Math.sin(angle) * 170);
  await page.mouse.down();
  await page.waitForFunction(
    (target) =>
      (document.getElementById("power") as HTMLMeterElement)?.value >= target,
    Math.round(power * 100) - 1,
    { polling: "raf" },
  );
  await page.mouse.up();
}

export async function overview(page: Page) {
  await expect
    .poll(async () =>
      Math.abs(
        Number(await page.locator("canvas").getAttribute("data-camera-zoom")) -
          540 / 1024,
      ),
    )
    .toBeLessThan(0.001);
}
export async function aimWorld(page: Page, x: number, y: number) {
  const canvas = page.locator("canvas");
  await canvas.click({ trial: true });
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Missing arena");
  const zoom = Number(await canvas.getAttribute("data-camera-zoom"));
  const cx = Number(await canvas.getAttribute("data-camera-center-x")),
    cy = Number(await canvas.getAttribute("data-camera-center-y"));
  await page.mouse.move(
    box.x + (((x - cx) * zoom + 480) * box.width) / 960,
    box.y + (((y - cy) * zoom + 270) * box.height) / 540,
  );
}
