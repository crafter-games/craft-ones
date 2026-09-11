import { expect, test } from "@playwright/test";
import {
  aimAtOpponent,
  aimWorld,
  closeMenu,
  closeSetup,
  openMenu,
  openSetup,
  overview,
  pickCritter,
  power,
  restartMatch,
  settled,
} from "./gameplay";

test("lineup selector wraps between characters, explains the default critter and carries coats into play", async ({
  page,
}) => {
  await page.goto("/setup?mode=local");
  const picker = page.getByRole("group", { name: "Player 1", exact: true });
  await picker.getByRole("button", { name: "Previous character" }).click();
  await expect(picker.locator(".critter-name")).toHaveText("Railly Hugo");
  await picker.getByRole("button", { name: "Next character" }).click();
  await expect(picker.locator(".critter-name")).toHaveText("Guinea Pig");
  for (const [name, ability] of [
    ["Guinea Pig", "No special ability"],
    ["Llama", "Andean leap"],
    ["Fox", "Quickstep"],
    ["Capybara", "Iron hide"],
    ["Puma", "Pounce"],
    ["Alpaca", "Second wind"],
  ]) {
    await pickCritter(picker, name);
    await expect(picker.getByText(ability, { exact: true })).toBeVisible();
    await expect(
      picker.getByText(
        name === "Guinea Pig" ? "STANDARD LOADOUT" : "UNIQUE ABILITY · 1 TURN",
      ),
    ).toBeVisible();
  }
  await pickCritter(picker, "Capybara");
  await picker
    .getByRole("button", { name: "Player 1: Slate", exact: true })
    .click();
  await page.getByRole("button", { name: "Start match" }).click();
  await expect(page.getByTestId("player-1")).toHaveAttribute(
    "data-species",
    "ronsoco",
  );
  await expect(page.getByTestId("player-1")).toHaveAttribute(
    "data-coat",
    "slate",
  );
  const arsenal = page.getByRole("toolbar", { name: "Arsenal", exact: true });
  await expect(arsenal.getByRole("button")).toHaveCount(7);
  await arsenal
    .getByRole("button", { name: "Iron hide · 1 turn", exact: true })
    .click();
  await expect(page.getByTestId("player-1")).toContainText("SHIELD +30");
  await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "2");
  await expect(
    arsenal.getByRole("button", { name: "Andean leap · 1 turn", exact: true }),
  ).toBeEnabled();
  await expect(arsenal.getByRole("button", { name: /Iron hide/ })).toHaveCount(
    0,
  );
  await overview(page);
  await arsenal
    .getByRole("button", { name: "Andean leap · 1 turn", exact: true })
    .click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-ability-direction",
    "left",
  );
  await aimWorld(page, 2600, 500);
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-ability-direction",
    "right",
  );
  await aimWorld(page, 500, 500);
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-ability-direction",
    "left",
  );
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "3");
  await expect(page.getByTestId("character-ability")).toBeDisabled();
});

for (const mapId of [
  "canopy",
  "caldera",
  "totora",
  "saltglass",
  "huaca",
  "frost",
  "loom",
  "harbor",
]) {
  test(`${mapId} can be selected in setup, excavated offline and restarted`, async ({
    page,
  }) => {
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    page.on("response", (response) => {
      if (response.url().includes("/art/") && response.status() >= 400)
        failures.push(response.url());
    });
    await page.route("**/matchmake/**", (route) => route.abort());
    await page.goto("/setup?mode=local");
    await page.locator(`[data-map-id="${mapId}"]`).click();
    await page.getByRole("button", { name: "Start match" }).click();
    await expect(page.getByTestId("battle")).toHaveAttribute("data-map", mapId);
    await expect(page.getByTestId("battle")).toHaveAttribute(
      "data-phase",
      "aiming",
    );
    await expect(
      page
        .getByRole("toolbar", { name: "Arsenal", exact: true })
        .getByRole("button"),
    ).toHaveCount(6);
    await expect(page.getByTestId("character-ability")).toHaveCount(0);
    const player = page.getByTestId("player-1");
    const x = Number(await player.getAttribute("data-x"));
    const y = Number(await player.getAttribute("data-y"));
    await overview(page);
    // Aim above the spawn so the pointer stays clear of the bottom HUD on
    // tall, camera-framed arenas.
    await aimWorld(page, x + 180, y - 180);
    await page.mouse.down();
    await expect.poll(() => power(page)).toBeGreaterThan(5);
    await page.mouse.up();
    await expect(page.getByTestId("battle")).toHaveAttribute(
      "data-terrain-revision",
      "1",
    );
    await restartMatch(page);
    await expect(page.getByTestId("battle")).toHaveAttribute(
      "data-terrain-revision",
      "0",
    );
    await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "1");
    await expect(player).toHaveAttribute("data-hp", "100");
    await expect(player).toHaveAttribute("data-x", String(x));
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(failures).toEqual([]);
  });
}

test("lineup and expanded arsenal fit mobile and reduced-motion preferences", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/setup?mode=local");
  const picker = page.getByRole("group", { name: "Player 1", exact: true });
  await picker.getByRole("button", { name: "Next character" }).focus();
  await page.keyboard.press("Enter");
  await expect(picker.locator(".critter-name")).toHaveText("Llama");
  await expect(picker.locator(".lineup-critter.is-selected img")).toHaveCSS(
    "animation-name",
    "none",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Start match" }).click();
  await expect(page.getByTestId("character-ability")).toBeVisible();
  await expect(
    page
      .getByRole("toolbar", { name: "Arsenal", exact: true })
      .getByRole("button"),
  ).toHaveCount(7);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

for (const mapId of ["andes", "coast"]) {
  test(`offline playground: ${mapId} completes a real pointer-controlled match and restarts`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/matchmake/**", (route) => route.abort());
    await page.goto("/setup?mode=local");
    await page
      .getByRole("button", {
        name: mapId === "andes" ? "Cloudbreak Valley" : "Amber Hollows",
      })
      .click();
    await page.getByRole("button", { name: "Start match" }).click();
    await expect(page.getByTestId("battle")).toHaveAttribute(
      "data-phase",
      "aiming",
    );
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(1);
    for (let shot = 0; shot < 9; shot++) {
      if (
        (await page.getByTestId("battle").getAttribute("data-phase")) ===
        "finished"
      )
        break;
      const number = Number(
        await page.getByTestId("battle").getAttribute("data-current-player"),
      );
      const target = page.getByTestId(`player-${number === 1 ? 2 : 1}`);
      const hp = Number(await target.getAttribute("data-hp"));
      const x = await target.getAttribute("data-x");
      await aimAtOpponent(page, number);
      await expect(page.getByTestId("battle")).toHaveAttribute(
        "data-phase",
        "flying",
      );
      await expect
        .poll(async () => Number(await target.getAttribute("data-hp")))
        .toBeLessThan(hp);
      await expect(target).not.toHaveAttribute("data-x", x ?? "");
      await expect(page.getByTestId("battle")).toHaveAttribute(
        "data-phase",
        /aiming|finished/,
      );
    }
    await expect(page.getByTestId("match-status")).toHaveText(
      /Player [12] wins!/,
    );
    await expect(page.locator('[data-hp="0"]')).toHaveCount(1);
    await page.getByRole("button", { name: "Play again", exact: true }).click();
    await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "1");
    await expect(page.getByTestId("player-1")).toHaveAttribute(
      "data-hp",
      "100",
    );
    await expect(page.getByTestId("player-2")).toHaveAttribute(
      "data-hp",
      "100",
    );
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test("metered movement, lab options, high-shot camera and restarting during flight", async ({
  page,
}) => {
  await page.goto("/playground");
  await expect(page.locator("canvas")).toBeVisible();
  // The arena claims keyboard focus while it boots; typing before that lands on
  // the document instead.
  await expect(page.locator("canvas")).toBeFocused();
  await page.keyboard.down("KeyD");
  await expect
    .poll(async () =>
      Number(await page.getByTestId("player-1").getAttribute("data-x")),
    )
    .toBeGreaterThan(384);
  await page.keyboard.up("KeyD");
  await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "1");
  await openMenu(page);
  await page.getByLabel("Infinite HP", { exact: true }).check();
  await page.getByLabel("Show collisions", { exact: true }).check();
  await page.getByLabel("Destructible ground", { exact: true }).check();
  await page.getByRole("button", { name: "Restart match" }).click();
  const canvas = page.locator("canvas");
  await overview(page);
  await aimWorld(page, 288, 100);
  await page.mouse.down();
  await expect.poll(async () => await power(page)).toBe(100);
  await page.mouse.up();
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-camera-zoom")))
    .toBeLessThan(0.8);
  await restartMatch(page);
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-phase",
    "aiming",
  );
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-explosion",
    "0",
  );
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-camera-zoom")))
    .toBeGreaterThan(0.9);
});

test("mobile local movement and touch aim survive portrait-to-landscape resize", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  try {
    await page.goto("/playground");
    await expect(page.locator("canvas")).toBeVisible();
    await page.getByRole("button", { name: "Move right", exact: true }).tap();
    await expect(page.getByTestId("player-1")).toHaveAttribute("data-x", "440");
    const canvas = page.locator("canvas");
    await page.bringToFront();
    await canvas.tap({ trial: true });
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Missing canvas");
    const cdp = await context.newCDPSession(page);
    const point = { x: box.x + box.width * 0.39, y: box.y + box.height * 0.54 };
    const scroll = await page.evaluate(() => window.scrollY);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point],
    });
    await expect.poll(async () => await power(page)).toBeGreaterThan(20);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: point.x + 8, y: point.y - 8 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(page.getByTestId("battle")).toHaveAttribute(
      "data-phase",
      "flying",
    );
    expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "2");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(canvas).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath("playground-mobile-landscape.png"),
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});

test("character colors, every weapon, turn camera and crater feedback are playable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/playground");
  await expect(page.locator("canvas")).toBeVisible();
  await openSetup(page);
  await pickCritter(
    page.getByRole("group", { name: "Player 1", exact: true }),
    "Llama",
  );
  await page
    .getByRole("button", { name: "Player 1: Rose", exact: true })
    .click();
  await expect(page.getByTestId("player-1")).toHaveAttribute(
    "data-species",
    "llama",
  );
  await expect(page.getByTestId("player-1")).toHaveAttribute(
    "data-coat",
    "rose",
  );
  await page.screenshot({
    path: test.info().outputPath("match-setup.png"),
    fullPage: true,
  });
  await closeSetup(page);
  await openMenu(page);
  await page
    .getByRole("button", { name: "Focus character", exact: true })
    .click();
  await closeMenu(page);
  await expect
    .poll(async () =>
      Number(await page.locator("canvas").getAttribute("data-camera-zoom")),
    )
    .toBeGreaterThan(1.1);
  await page.screenshot({
    path: test.info().outputPath("character-focus.png"),
    fullPage: true,
  });
  await openMenu(page);
  await page
    .getByRole("button", { name: "View whole map", exact: true })
    .click();
  await closeMenu(page);
  await overview(page);
  for (const name of [
    "Rocket",
    "Mortar",
    "Dynamite",
    "Grapple",
    "Sticky bomb",
    "Grenade",
  ]) {
    const weapon = page.getByRole("button", { name, exact: true });
    await weapon.click();
    await expect(weapon).toHaveAttribute("aria-pressed", "true");
  }
  await aimWorld(page, 675, 855);
  await page.mouse.down();
  await page.waitForFunction(
    () =>
      Number(document.querySelector("#power")?.getAttribute("data-value")) >=
      10,
  );
  await page.mouse.up();
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-phase",
    "flying",
  );
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-terrain-revision",
    "1",
  );
  await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "2");
  await overview(page);
  await page.screenshot({
    path: test.info().outputPath("layered-arena-crater.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Andean leap · 1 turn", exact: true })
    .click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-ability-direction",
    "left",
  );
  await aimWorld(page, 500, 500);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-phase",
    "resolving",
  );
  await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "3");
  expect(errors).toEqual([]);
});

test("setup selections carry into local play and basic jump preserves the shot", async ({
  page,
}) => {
  await page.goto("/setup?mode=local");
  const seat = page.getByRole("group", { name: "Player 1", exact: true });
  await page.getByRole("button", { name: "Amber Hollows" }).click();
  await pickCritter(seat, "Llama");
  await seat
    .getByRole("button", { name: "Player 1: Sage", exact: true })
    .click();
  await page.getByRole("button", { name: "Start match" }).click();
  await expect(page.getByTestId("battle")).toHaveAttribute("data-map", "coast");
  await expect(page.getByTestId("player-1")).toHaveAttribute(
    "data-species",
    "llama",
  );
  await expect(page.getByTestId("player-1")).toHaveAttribute(
    "data-coat",
    "sage",
  );
  const y = Number(await page.getByTestId("player-1").getAttribute("data-y"));
  await page.getByRole("button", { name: "Jump", exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId("player-1").getAttribute("data-y")),
    )
    .toBeLessThan(y - 15);
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-phase",
    "aiming",
  );
  await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "1");
  await expect
    .poll(async () =>
      Math.abs(
        Number(await page.getByTestId("player-1").getAttribute("data-y")) - y,
      ),
    )
    .toBeLessThan(1);
  await aimAtOpponent(page, 1);
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-phase",
    "flying",
  );
});

test("movement bar empties, blocks walk and jump, and keeps sticky bombs available for both seats", async ({
  page,
}) => {
  await page.goto("/playground");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeFocused();
  const meter = page.getByRole("meter", { name: "Range remaining" });
  await expect(meter).toHaveAttribute("aria-valuenow", "240");
  await page.keyboard.down("KeyD");
  await expect(meter).toHaveAttribute("aria-valuenow", "0");
  await page.keyboard.up("KeyD");
  const player = page.getByTestId("player-1");
  const x = Number(await player.getAttribute("data-x"));
  const y = Number(await player.getAttribute("data-y"));
  // At the edge only the way out is closed; the way home stays open.
  await expect(
    page.getByRole("button", { name: "Move right", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Move left", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Jump", exact: true }),
  ).toBeDisabled();
  const sticky = page.getByRole("button", { name: "Sticky bomb", exact: true });
  await sticky.click();
  await expect(sticky).toHaveAttribute("aria-pressed", "true");
  await overview(page);
  await aimWorld(page, x, y + 90);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-phase",
    "flying",
  );
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-terrain-revision",
    "1",
  );
  await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "2");
  await expect(meter).toHaveAttribute("aria-valuenow", "240");
  await expect(sticky).toBeEnabled();
  await page.getByRole("button", { name: "Jump", exact: true }).click();
  await expect(meter).toHaveAttribute("aria-valuenow", "192");
  await page.screenshot({
    path: test.info().outputPath("movement-sticky.png"),
    fullPage: true,
  });
});

// ARENA.moveBudget; these specs run without the workspace package resolved.
const BUDGET = 240;

test("walking range drains away from the origin and refills on the way back", async ({
  page,
}) => {
  await page.goto("/playground");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("canvas")).toBeFocused();
  const player = page.getByTestId("player-1");
  const left = async () => Number(await player.getAttribute("data-movement"));
  const at = async () => Number(await player.getAttribute("data-x"));
  const start = await at();
  await page.keyboard.down("KeyD");
  await expect.poll(left).toBe(0);
  await page.keyboard.up("KeyD");
  expect(await at()).toBeCloseTo(start + BUDGET, 0);
  await expect(page.getByTestId("movement-left")).toHaveText(`0 / ${BUDGET}`);
  // Every step home buys the range back, so the walk out is never a dead end.
  await page.keyboard.down("KeyA");
  await expect.poll(left).toBeGreaterThan(BUDGET / 2);
  expect(await at()).toBeLessThan(start + BUDGET);
  await expect.poll(left, { intervals: [20] }).toBeGreaterThan(BUDGET - 24);
  await page.keyboard.up("KeyA");
  expect(Math.abs((await at()) - start)).toBeLessThan(24);
  // Crossing the origin starts spending again on the other side.
  await page.keyboard.down("KeyA");
  await expect.poll(left).toBeLessThan(BUDGET - 24);
  await page.keyboard.up("KeyA");
  expect(await at()).toBeLessThan(start);
});

test("the arena makes noise, the toggle silences it, and the choice sticks", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/playground");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("canvas")).toBeFocused();
  // Count what the board schedules; a headless browser has no speaker to hear.
  await page.evaluate(() => {
    const counter = window as unknown as { __notes: number };
    counter.__notes = 0;
    const proto = AudioContext.prototype;
    const oscillator = proto.createOscillator;
    const buffer = proto.createBufferSource;
    proto.createOscillator = function () {
      counter.__notes++;
      return oscillator.call(this);
    };
    proto.createBufferSource = function () {
      counter.__notes++;
      return buffer.call(this);
    };
  });
  const notes = () =>
    page.evaluate(() => (window as unknown as { __notes: number }).__notes);
  const battle = page.getByTestId("battle");
  const toggle = page.getByTestId("sound-toggle");
  await expect(battle).toHaveAttribute("data-sound", "on");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  const player = page.getByTestId("player-1");
  const x = Number(await player.getAttribute("data-x"));
  const y = Number(await player.getAttribute("data-y"));
  await settled(page);
  await aimWorld(page, x, y + 90);
  await page.mouse.down();
  // Charging hums while it winds up, before anything is fired.
  await expect.poll(notes).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  await page.mouse.up();
  await expect(battle).toHaveAttribute("data-terrain-revision", "1");
  await expect.poll(notes).toBeGreaterThan(4);

  await toggle.click();
  await expect(battle).toHaveAttribute("data-sound", "off");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await restartMatch(page);
  const silent = await notes();
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(600);
  await page.keyboard.up("KeyD");
  expect(await notes()).toBe(silent);

  await page.reload();
  await expect(page.getByTestId("battle")).toHaveAttribute("data-sound", "off");
  expect(errors).toEqual([]);
});
