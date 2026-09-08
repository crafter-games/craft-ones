import { expect, type Page } from "@playwright/test";

const CHARGE_MS = 2800;
const GRAVITY = 420;
const ROCKET_MAX_SPEED = 1000;

type Arena = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  box: { x: number; y: number; width: number; height: number };
  zoom: number;
  cx: number;
  cy: number;
};

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
    return {
      from: player(seat),
      to: player(seat === 1 ? 2 : 1),
      box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      zoom: Number(canvas.dataset.cameraZoom),
      cx: Number(canvas.dataset.cameraCenterX),
      cy: Number(canvas.dataset.cameraCenterY),
    };
  }, number);
}

function toScreen(arena: Arena, x: number, y: number) {
  const { box, zoom, cx, cy } = arena;
  return {
    x: box.x + (((x - cx) * zoom + 480) * box.width) / 960,
    y: box.y + (((y - cy) * zoom + 270) * box.height) / 540,
  };
}

/**
 * The elevation that drops a full-power rocket on the target over open air,
 * taking the high arc. Terrain can still block it, so this only seeds the
 * search against the arc the client previews.
 */
function highArc(from: { x: number; y: number }, to: { x: number; y: number }) {
  let angle = to.x > from.x ? -Math.PI / 3 : (-2 * Math.PI) / 3;
  // The rocket leaves 22px along the aim, so solve again from where it starts.
  for (let pass = 0; pass < 2; pass++) {
    const dx = to.x - from.x - Math.cos(angle) * 22;
    const rise = from.y + Math.sin(angle) * 22 - to.y;
    const speed2 = ROCKET_MAX_SPEED ** 2;
    const root = Math.sqrt(
      Math.max(
        0,
        speed2 ** 2 - GRAVITY * (GRAVITY * dx ** 2 + 2 * rise * speed2),
      ),
    );
    const elevation = Math.atan((speed2 + root) / (GRAVITY * Math.abs(dx)));
    angle = dx > 0 ? -elevation : elevation - Math.PI;
  }
  return angle;
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
 * Aim the way a player does: hold the button down, watch the previewed arc,
 * nudge until it sits on the opponent, then let go. Charging saturates the
 * power and freezes the camera, so neither the release round trip nor the turn
 * introduction can skew the shot.
 */
export async function aimAtOpponent(
  page: Page,
  number: number,
  walked = false,
) {
  if (!walked) {
    await page.locator("canvas").click({ trial: true });
    await settled(page);
  }
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Missing arena");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // Full power: the client clamps the charge, so the release can take its time.
  await page.waitForTimeout(CHARGE_MS + 80);
  const arena = await readArena(page, number);
  const { from, to } = arena;
  const show = async (angle: number) => {
    const at = toScreen(arena, ...ray(arena, from, angle));
    await page.mouse.move(at.x, at.y);
    const impact = await page.evaluate(async () => {
      // Let the scene redraw the arc for the angle the pointer just set.
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      const element = document.querySelector("canvas") as HTMLCanvasElement;
      const x = Number(element.dataset.aimImpactX);
      const y = Number(element.dataset.aimImpactY);
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    });
    return {
      angle,
      miss: impact ? Math.hypot(impact.x - to.x, impact.y - to.y) : Infinity,
    };
  };
  const lift = to.x > from.x ? 1 : -1;
  const elevate = (degrees: number) =>
    lift > 0 ? (-degrees * Math.PI) / 180 : (degrees * Math.PI) / 180 - Math.PI;
  // Stop searching with enough of the turn left to release and, if the terrain
  // is in the way, to step clear and line the shot up again.
  const remaining = async () =>
    Number(await page.getByTestId("battle").getAttribute("data-remaining"));
  let left = await remaining();
  const seed = highArc(from, to);
  if (left <= 6) {
    // Not enough turn left to study the arc; take the open-air solution.
    const at = toScreen(arena, ...ray(arena, from, seed));
    await page.mouse.move(at.x, at.y);
    await page.mouse.up();
    return;
  }
  let best = await show(seed);
  // Craters and cliffs can block the open-air arc, so try the whole fan before
  // closing in on whichever one the terrain actually lets through.
  for (const degrees of [30, 45, 60, 72, 80, 20, 52, 66]) {
    if (best.miss < 30) break;
    left = await remaining();
    if (left <= 8) break;
    const shot = await show(elevate(degrees));
    if (shot.miss < best.miss) best = shot;
  }
  for (let step = 2; best.miss > 25 && step >= 0.5; step /= 2)
    for (const side of [-1, 1]) {
      left = await remaining();
      if (left <= 6) break;
      const shot = await show(
        best.angle + ((side * step * Math.PI) / 180) * lift,
      );
      if (shot.miss < best.miss) best = shot;
    }
  if (best.miss > 60 && !walked && (await remaining()) >= 8) {
    // Boxed in by our own crater. Drop the charge without spending the shot,
    // step clear and line it up again: moving keeps the shot.
    await page.evaluate(() => dispatchEvent(new Event("blur")));
    await page.mouse.up();
    const key = to.x > from.x ? "KeyA" : "KeyD";
    await page.keyboard.down(key);
    await page.waitForTimeout(400);
    await page.keyboard.up(key);
    return aimAtOpponent(page, number, true);
  }
  await show(best.angle);
  await page.mouse.up();
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
  await expect
    .poll(async () =>
      Math.abs(
        Number(await page.locator("canvas").getAttribute("data-camera-zoom")) -
          Math.min(960 / 2688, 540 / 1536), // ARENA viewport / expanded world
      ),
    )
    .toBeLessThan(0.001);
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
  const at = toScreen({ box, zoom, cx, cy } as Arena, x, y);
  await page.mouse.move(at.x, at.y);
  return at;
}
