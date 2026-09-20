import { expect, type Page, test } from "@playwright/test";
import { WEAPONS, type WeaponId } from "../packages/shared/src/arsenal";
import {
  aimWorld,
  overview,
  pickCritter,
  power,
  restartMatch,
} from "./gameplay";

async function rendered(page: Page, seat: number, kind: string) {
  await expect(page.locator("canvas")).toHaveAttribute(
    `data-player${seat}-weapon`,
    kind === "none" ? "none" : `weapon-${kind}`,
  );
}

async function shootUp(page: Page, seat: number) {
  await page.bringToFront();
  await overview(page);
  const player = page.getByTestId(`player-${seat}`);
  await aimWorld(
    page,
    Number(await player.getAttribute("data-x")),
    Number(await player.getAttribute("data-y")) - 200,
  );
  await page.mouse.down();
  await expect.poll(() => power(page)).toBeGreaterThan(35);
  await page.mouse.up();
}

test("two clients see independent tools before firing, during the shot and on the next turn", async ({
  page,
  browser,
}) => {
  await page.goto("/setup?mode=create");
  await pickCritter(
    page.getByRole("group", { name: "Your critter", exact: true }),
    "Railly Hugo",
  );
  await page.getByRole("button", { name: "Start match" }).click();
  await expect(page).toHaveURL(/\/game\/[a-zA-Z0-9_-]+$/);
  const context = await browser.newContext({ ...test.info().project.use });
  const rival = await context.newPage();
  try {
    await rival.goto(page.url());
    await rival.getByRole("button", { name: "Join Game", exact: true }).click();
    for (const client of [page, rival]) {
      await expect(client.locator("canvas")).toHaveAttribute(
        "data-ready",
        "true",
      );
      await expect(client.getByTestId("battle")).toHaveAttribute(
        "data-current-player",
        "1",
      );
    }
    for (const [id, weapon] of Object.entries(WEAPONS)) {
      await page
        .getByRole("button", { name: weapon.name, exact: true })
        .click();
      for (const client of [page, rival]) {
        await rendered(client, 1, id);
        await rendered(client, 2, "rocket");
      }
      await expect(rival.getByTestId("opponent-selection")).toContainText(
        `Opponent: ${weapon.name}`,
      );
      await expect(
        rival.getByRole("button", { name: "Rocket", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
    }
    await page.getByRole("button", { name: "Grenade", exact: true }).click();
    await shootUp(page, 1);
    for (const client of [page, rival]) {
      await expect(client.getByTestId("battle")).toHaveAttribute(
        "data-projectile-kind",
        "grenade",
      );
      await rendered(client, 1, "grenade");
      await expect(client.getByTestId("battle")).toHaveAttribute(
        "data-current-player",
        "2",
        { timeout: 18000 },
      );
    }
    for (const id of Object.keys(WEAPONS) as WeaponId[]) {
      await rival
        .getByRole("button", { name: WEAPONS[id].name, exact: true })
        .click();
      for (const client of [page, rival]) {
        await rendered(client, 1, "grenade");
        await rendered(client, 2, id);
      }
      await expect(page.getByTestId("opponent-selection")).toContainText(
        `Opponent: ${WEAPONS[id].name}`,
      );
      await expect(
        page.getByRole("button", { name: "Grenade", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
    }
    await rival.getByRole("button", { name: "Mortar", exact: true }).click();
    await rival.getByTestId("character-ability").click();
    for (const client of [page, rival]) await rendered(client, 2, "none");
    await expect(page.getByTestId("opponent-selection")).toContainText(
      "Andean leap",
    );
    await rival.getByTestId("character-ability").click();
    await shootUp(rival, 2);
    for (const client of [page, rival]) {
      await expect(client.getByTestId("battle")).toHaveAttribute(
        "data-projectile-kind",
        "mortar",
      );
      await rendered(client, 2, "mortar");
      await expect(client.getByTestId("battle")).toHaveAttribute(
        "data-current-player",
        "1",
        { timeout: 18000 },
      );
      await rendered(client, 1, "grenade");
      await rendered(client, 2, "mortar");
    }
    await page.getByTestId("character-ability").click();
    for (const client of [page, rival]) await rendered(client, 1, "shuriken");
    await expect(rival.getByTestId("opponent-selection")).toContainText(
      "Triangle barrage",
    );
    await shootUp(page, 1);
    for (const client of [page, rival]) {
      await expect(client.getByTestId("battle")).toHaveAttribute(
        "data-projectile-kind",
        "shuriken",
      );
      await rendered(client, 1, "shuriken");
      await rendered(client, 2, "mortar");
    }
  } finally {
    await context.close();
  }
});

test("local seats retain separate tools, show the exclusive power and reset on restart", async ({
  page,
}) => {
  await page.goto("/playground?species=railly&coat=cream");
  await expect(page.locator("canvas")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Grenade", exact: true }).click();
  await page.getByTestId("character-ability").click();
  await rendered(page, 1, "shuriken");
  await rendered(page, 2, "rocket");
  await shootUp(page, 1);
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-projectile-kind",
    "shuriken",
  );
  await rendered(page, 1, "shuriken");
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-current-player",
    "2",
    { timeout: 18000 },
  );
  await rendered(page, 1, "grenade");
  await expect(
    page.getByRole("button", { name: "Rocket", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Mortar", exact: true }).click();
  await shootUp(page, 2);
  await expect(page.getByTestId("battle")).toHaveAttribute(
    "data-current-player",
    "1",
    { timeout: 18000 },
  );
  await rendered(page, 1, "grenade");
  await rendered(page, 2, "mortar");
  await expect(
    page.getByRole("button", { name: "Grenade", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await restartMatch(page);
  await rendered(page, 1, "rocket");
  await rendered(page, 2, "rocket");
  await expect(page.getByTestId("character-ability")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
