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
  const angle = tx > x ? -Math.PI / 4 : (-3 * Math.PI) / 4;
  const dx = tx - x - Math.cos(angle) * 20;
  const dy = ty - y - Math.sin(angle) * 20;
  const speed = Math.sqrt(
    (420 * dx ** 2) / (2 * Math.cos(angle) ** 2 * (dy - dx * Math.tan(angle))),
  );
  const power = Math.max(0, Math.min(1, (speed - 240) / 460));
  // Wait for the return from a high shot before measuring pointer coordinates.
  await expect
    .poll(async () =>
      Math.abs(
        1 -
          Number(await page.locator("canvas").getAttribute("data-camera-zoom")),
      ),
    )
    .toBeLessThan(0.001);
  const canvas = await page.locator("canvas").boundingBox();
  if (!canvas) throw new Error("Missing arena");
  await page.mouse.move(
    canvas.x + ((x + Math.cos(angle) * 130) * canvas.width) / 960,
    canvas.y + ((y + Math.sin(angle) * 130) * canvas.height) / 540,
  );
  await page.mouse.down();
  await page.waitForFunction(
    (target) =>
      (document.getElementById("power") as HTMLMeterElement)?.value >= target,
    Math.round(power * 100) - 1,
    { polling: "raf" },
  );
  await page.mouse.up();
}
