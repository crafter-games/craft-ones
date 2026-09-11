import { expect, type Page, test } from "@playwright/test";
import { closeSetup, openSetup, pickCritter } from "./gameplay";

function characterRequests(page: Page) {
  const paths = new Set<string>();
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (
      /^\/art\/[^/]+\/[^/]+\/[^/]+\.svg$/.test(path) &&
      !path.endsWith("/portrait.svg")
    )
      paths.add(path);
  });
  return paths;
}

for (const [query, keys, count] of [
  [
    "species=cuy&coat=caramel&species2=llama&coat2=cream",
    "cuy-caramel,llama-cream",
    24,
  ],
  [
    "species=freddy&coat=cream&species2=freddy&coat2=cream",
    "freddy-cream,freddy-cream",
    12,
  ],
] as const) {
  test(`only selected character parts load for ${keys}`, async ({ page }) => {
    const paths = characterRequests(page);
    await page.goto(`/playground?${query}`);
    await expect(page.locator("canvas")).toBeFocused();
    expect(paths.size).toBe(count);
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-character-keys",
      keys,
    );
    await page.keyboard.down("KeyD");
    try {
      await expect
        .poll(async () =>
          Number(
            await page
              .getByRole("meter", { name: "Range remaining" })
              .getAttribute("aria-valuenow"),
          ),
        )
        .toBeLessThan(240);
    } finally {
      await page.keyboard.up("KeyD");
    }
  });
}

test("late rival art loads without replacing the host arena", async ({
  page,
  browser,
}) => {
  const paths = characterRequests(page);
  await page.goto("/setup?mode=create");
  await page.getByRole("button", { name: "Start match" }).click();
  await expect(page.locator("canvas")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-character-keys",
    "cuy-caramel",
  );
  expect(paths.size).toBe(12);
  const canvas = await page.locator("canvas").elementHandle();
  const rival = await browser.newContext();
  try {
    const guest = await rival.newPage();
    await guest.goto(page.url());
    await guest.getByRole("button", { name: "Join Game", exact: true }).click();
    await page.bringToFront();
    await expect(page.locator("canvas")).toHaveAttribute(
      "data-character-keys",
      "cuy-caramel,llama-cream",
    );
    expect(await canvas?.evaluate((element) => element.isConnected)).toBe(true);
    expect(paths.size).toBe(24);
    await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "1");
    await expect(page.locator("canvas")).toHaveCount(1);
  } finally {
    await rival.close();
  }
});

test("changing a coat loads its parts without stealing setup focus", async ({
  page,
}) => {
  const paths = characterRequests(page);
  await page.goto("/playground");
  await expect(page.locator("canvas")).toBeFocused();
  const canvas = await page.locator("canvas").elementHandle();
  await openSetup(page);
  await pickCritter(
    page.getByRole("group", { name: "Player 1", exact: true }),
    "Llama",
  );
  const rose = page.getByRole("button", {
    name: "Player 1: Rose",
    exact: true,
  });
  await rose.click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-character-keys",
    "llama-rose,llama-cream",
  );
  await expect(rose).toBeFocused();
  expect(await canvas?.evaluate((element) => element.isConnected)).toBe(true);
  expect(
    [...paths].filter((path) => path.startsWith("/art/llama/rose/")),
  ).toHaveLength(12);
  await closeSetup(page);
  await expect(page.getByTestId("battle")).toHaveAttribute("data-turn", "1");
});

test("failed character art can be reloaded", async ({ page }) => {
  await page.route("**/art/cuy/caramel/*.svg", (route) => route.abort());
  await page.goto("/playground");
  await expect(
    page.getByRole("alertdialog", { name: "Arena load error" }),
  ).toContainText("Some game art could not load");
  await expect(
    page.getByRole("button", { name: "Reload arena" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("alertdialog", { name: "Arena load error" }),
  ).toBeVisible();
  await page.unroute("**/art/cuy/caramel/*.svg");
  await page.getByRole("button", { name: "Reload arena" }).click();
  await expect(page.locator("canvas")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-character-keys",
    "cuy-caramel,llama-cream",
  );
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(
    page.getByRole("alertdialog", { name: "Arena load error" }),
  ).toHaveCount(0);
  await page.keyboard.down("KeyD");
  try {
    await expect
      .poll(async () =>
        Number(
          await page
            .getByRole("meter", { name: "Range remaining" })
            .getAttribute("aria-valuenow"),
        ),
      )
      .toBeLessThan(240);
  } finally {
    await page.keyboard.up("KeyD");
  }
});

test("a pending coat blocks movement until its art loads", async ({ page }) => {
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/art/cuy/rose/*.svg", async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto("/playground");
  await expect(page.locator("canvas")).toBeFocused();
  await openSetup(page);
  await page
    .getByRole("button", { name: "Player 1: Rose", exact: true })
    .click();
  await closeSetup(page);
  try {
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(500);
    await expect(
      page.getByRole("meter", { name: "Range remaining" }),
    ).toHaveAttribute("aria-valuenow", "240");
    await expect(page.locator("canvas")).toHaveAttribute("data-ready", "false");
  } finally {
    await page.keyboard.up("KeyD");
    release();
  }
  await expect(page.locator("canvas")).toHaveAttribute("data-ready", "true");
  await page.keyboard.down("KeyD");
  try {
    await expect
      .poll(async () =>
        Number(
          await page
            .getByRole("meter", { name: "Range remaining" })
            .getAttribute("aria-valuenow"),
        ),
      )
      .toBeLessThan(240);
  } finally {
    await page.keyboard.up("KeyD");
  }
});

test("retrying a failed coat restores setup focus", async ({ page }) => {
  await page.goto("/playground");
  await expect(page.locator("canvas")).toBeFocused();
  await openSetup(page);
  await page.route("**/art/cuy/sage/*.svg", (route) => route.abort());
  const sage = page.getByRole("button", {
    name: "Player 1: Sage",
    exact: true,
  });
  await sage.click();
  const retry = page.getByRole("button", { name: "Reload arena" });
  await expect(retry).toBeFocused();
  await page.unroute("**/art/cuy/sage/*.svg");
  await retry.click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-character-keys",
    "cuy-sage,llama-cream",
  );
  await expect(sage).toBeFocused();
  await expect(page.getByRole("dialog", { name: "Match setup" })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
});
