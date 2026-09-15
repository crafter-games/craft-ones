import { expect, type Locator, type Page } from "@playwright/test";

const GRAVITY = 420;
const ROCKET_MAX_SPEED = 1000;

type Arena = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  box: { x: number; y: number; width: number; height: number };
  zoom: number;
  cx: number;
  cy: number;
  /** The camera viewport in game units, which now follows the window. */
  vw: number;
  vh: number;
};

/** The seat cycles with arrows now, so tests walk the roster the same way. */
export async function pickCritter(seat: Locator, name: string) {
  const shown = seat.locator(".critter-name");
  for (let step = 0; step < 16; step++) {
    if ((await shown.textContent())?.trim() === name) return;
    await seat.getByRole("button", { name: "Next character" }).click();
  }
  throw new Error(`The roster never reached ${name}`);
}

/** The HUD keeps settings, restart and the setup drawer behind MENU. */
export async function openMenu(page: Page) {
  await page.getByRole("button", { name: "Menu", exact: true }).click();
}
export async function closeMenu(page: Page) {
  await page.getByRole("button", { name: "Resume", exact: true }).click();
}
export async function restartMatch(page: Page) {
  await openMenu(page);
  await page.getByRole("button", { name: "Restart match" }).click();
}
export async function openSetup(page: Page) {
  await openMenu(page);
  await page.getByRole("button", { name: "Match setup" }).click();
}
export async function closeSetup(page: Page) {
  await page.getByRole("button", { name: "Back to the match" }).click();
}
/** The charge the power gauge is showing right now. */
export async function power(page: Page) {
  return Number(await page.locator("#power").getAttribute("data-value"));
}

/** One round trip for everything aiming needs; the turn clock is only 15s. */
function readArena(page: Page, number: number): Promise<Arena> {
  return page.evaluate((seat) => {
    const player = (n: number) => {
      const element = document.querySelector(`[data-testid="player-${n}"]`);
      return {
        x: Number(element?.getAttribute("data-x")),
        y: Number(element?.getAttribute("data-y")),
      };
    };
    const canvas = document.querySelector("canvas") as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const zoom = Number(canvas.dataset.cameraZoom);
    const vw = Number(canvas.dataset.cameraWidth);
    const vh = Number(canvas.dataset.cameraHeight);
    const rawCenterX = Number(canvas.dataset.cameraCenterX);
    const rawCenterY = Number(canvas.dataset.cameraCenterY);
    return {
      from: player(seat),
      to: player(seat === 1 ? 2 : 1),
      box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      zoom,
      // ArenaScene exposes scroll + half the unzoomed viewport. Normalize it
      // to the actual world-space camera midpoint before projecting a shot.
      cx: rawCenterX - vw / 2 + vw / (2 * zoom),
      cy: rawCenterY - vh / 2 + vh / (2 * zoom),
      vw,
      vh,
    };
  }, number);
}

function toScreen(arena: Arena, x: number, y: number) {
  const { box, zoom, cx, cy, vw, vh } = arena;
  return {
    x: box.x + (((x - cx) * zoom + vw / 2) * box.width) / vw,
    y: box.y + (((y - cy) * zoom + vh / 2) * box.height) / vh,
  };
}

/** A practiced shot corrected for the authoritative round wind. */
function practicedShot(
  from: { x: number; y: number },
  to: { x: number; y: number },
  wind: number,
  elevation: number,
) {
  const angle = to.x > from.x ? -elevation : elevation - Math.PI;
  const dx = to.x - from.x - Math.cos(angle) * 22;
  const dy = to.y - from.y - Math.sin(angle) * 22;
  const timeSquared =
    (2 * (dy - dx * Math.tan(angle))) / (GRAVITY - wind * Math.tan(angle));
  const time = Math.sqrt(timeSquared);
  const speed = (dx - 0.5 * wind * timeSquared) / (Math.cos(angle) * time);
  if (!Number.isFinite(speed)) return;
  const power = (speed - 240) / (ROCKET_MAX_SPEED - 240);
  if (power < 0 || power > 1) return;
  return {
    angle,
    power,
  };
}

/**
 * A point along the aim ray, as far out as the camera still shows: the further
 * the pointer sits from the critter, the finer the angle a pixel can express.
 */
function ray(
  arena: Arena,
  from: { x: number; y: number },
  angle: number,
): [number, number] {
  const halfWidth = 480 / arena.zoom - 16;
  const halfHeight = 270 / arena.zoom - 16;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let reach = 480;
  if (dx)
    reach = Math.min(
      reach,
      (arena.cx + Math.sign(dx) * halfWidth - from.x) / dx,
    );
  if (dy)
    reach = Math.min(
      reach,
      (arena.cy + Math.sign(dy) * halfHeight - from.y) / dy,
    );
  reach = Math.max(48, reach);
  return [from.x + dx * reach, from.y + dy * reach];
}

/**
 * Aim the way a practiced player does: try high and low arcs, compensate for
 * visible wind and release at the required charge. The non-visual impact data
 * lets acceptance tests prefer a clear lane without exposing it in public play.
 */
export async function aimAtOpponent(
  page: Page,
  number: number,
  focused = false,
) {
  const canvas = page.locator("canvas");
  if (!focused) await canvas.click({ trial: true });
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-phase",
    "aiming",
  );
  await settled(page);
  const initial = await readArena(page, number);
  const { from, to } = initial;
  const wind = Number(
    await page.getByTestId("wind-indicator").getAttribute("data-wind"),
  );
  const candidates = [40, 50, 30]
    .map((degrees) => practicedShot(from, to, wind, (degrees * Math.PI) / 180))
    .filter((shot) => shot !== undefined);
  if (!candidates.length) throw new Error("No reachable ballistic shot");

  const tryShot = async (shot: (typeof candidates)[number]) => {
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Missing arena");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const arena = await readArena(page, number);
    const at = toScreen(arena, ...ray(arena, arena.from, shot.angle));
    await page.mouse.move(at.x, at.y);
    await expect.poll(() => power(page)).toBeGreaterThan(1);
    let miss = Number.POSITIVE_INFINITY;
    const deadline = performance.now() + 3000;
    while (performance.now() < deadline && (await power(page)) < 99) {
      const impact = await page.evaluate(() => {
        const element = document.querySelector("canvas") as HTMLCanvasElement;
        return {
          x: Number(element.dataset.aimImpactX),
          y: Number(element.dataset.aimImpactY),
        };
      });
      miss = Math.min(miss, Math.hypot(impact.x - to.x, impact.y - to.y));
      if (miss < 55) return true;
      await page.waitForTimeout(16);
    }
    return false;
  };

  for (const [index, shot] of candidates.entries()) {
    if ((await tryShot(shot)) || index === candidates.length - 1) {
      await page.mouse.up();
      return;
    }
    await canvas.dispatchEvent("pointercancel");
    await page.mouse.up();
  }
}

/**
 * Wait until both critters stop moving. The camera does not matter here:
 * charging freezes it, and the aim is read from the frozen transform.
 */
export async function settled(page: Page) {
  let previous: number[] | null = null;
  await expect
    .poll(
      async () => {
        const current = await page.evaluate(() => {
          const player = (n: number) => {
            const element = document.querySelector(
              `[data-testid="player-${n}"]`,
            );
            return [
              Number(element?.getAttribute("data-x")),
              Number(element?.getAttribute("data-y")),
            ];
          };
          return [...player(1), ...player(2)];
        });
        const before = previous;
        previous = current;
        return before
          ? Math.max(...current.map((value, i) => Math.abs(value - before[i])))
          : Number.POSITIVE_INFINITY;
      },
      { intervals: [80, 80, 80, 120, 200, 400] },
    )
    .toBeLessThan(0.5);
}

/** Wait until the camera frames the whole map. */
export async function overview(page: Page) {
  const canvas = page.locator("canvas");
  await expect
    .poll(async () =>
      Math.abs(
        Number(await canvas.getAttribute("data-camera-zoom")) -
          // The framing excludes the HUD, so read the free area from the scene.
          Math.min(
            Number(await canvas.getAttribute("data-camera-frame-width")) / 2688,
            Number(await canvas.getAttribute("data-camera-frame-height")) /
              1536,
          ),
      ),
    )
    // The camera eases in asymptotically and never lands exactly. The turn
    // introduction sits far outside this margin, so it still reads as framed.
    .toBeLessThan(0.006);
  await settled(page);
}

/** Move the pointer to a world position, and report where that landed. */
export async function aimWorld(page: Page, x: number, y: number) {
  const canvas = page.locator("canvas");
  await canvas.click({ trial: true });
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Missing arena");
  const zoom = Number(await canvas.getAttribute("data-camera-zoom"));
  const cx = Number(await canvas.getAttribute("data-camera-center-x")),
    cy = Number(await canvas.getAttribute("data-camera-center-y"));
  const vw = Number(await canvas.getAttribute("data-camera-width")),
    vh = Number(await canvas.getAttribute("data-camera-height"));
  const at = toScreen({ box, zoom, cx, cy, vw, vh } as Arena, x, y);
  await page.mouse.move(at.x, at.y);
  return at;
}
