import { expect, test } from "@playwright/test";

test("hidden playground runs two real players and resets to a fresh room", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator('a[href="/playground"]')).toHaveCount(0);
  await page.goto("/playground");
  await expect(
    page.getByRole("heading", { name: "Craft Ones playground", exact: true }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  await page
    .getByRole("button", { name: "Start Playground", exact: true })
    .click();
  const first = page.getByTestId("playground-player-1");
  const second = page.frameLocator('iframe[title="Player 2 game"]');
  for (const view of [first, second]) {
    await expect(view.getByTestId("battle")).toHaveAttribute(
      "data-phase",
      "aiming",
    );
    await expect(view.getByTestId("battle")).toHaveAttribute(
      "data-current-player",
      "1",
    );
    await expect(view.locator("canvas")).toHaveCount(1);
  }
  await expect(first.getByTestId("player-1")).toContainText("(you)");
  await expect(second.getByTestId("player-2")).toContainText("(you)");
  const oldRoom = await page.locator("iframe").getAttribute("src");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await first.getByRole("button", { name: "Copy Invite Link" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    new URL(oldRoom ?? "", page.url()).href,
  );
  for (const [index, view] of [first, second].entries()) {
    const canvas = view.locator("canvas");
    await canvas.focus();
    await page.keyboard.down("Space");
    await expect
      .poll(async () =>
        Number(await view.locator("#power").getAttribute("value")),
      )
      .toBeGreaterThan(10);
    await page.keyboard.up("Space");
    await Promise.all(
      [first, second].map((observer) =>
        expect(observer.getByTestId("battle")).toHaveAttribute(
          "data-phase",
          "flying",
        ),
      ),
    );
    await Promise.all(
      [first, second].map((observer) =>
        expect(observer.getByTestId("battle")).toHaveAttribute(
          "data-turn",
          String(index + 2),
        ),
      ),
    );
  }
  await page
    .getByRole("button", { name: "Reset Playground", exact: true })
    .click();
  await expect(page.locator("iframe")).not.toHaveAttribute(
    "src",
    oldRoom ?? "",
  );
  for (const view of [first, second]) {
    await expect(view.getByTestId("battle")).toHaveAttribute(
      "data-phase",
      "aiming",
    );
    await expect(view.getByTestId("battle")).toHaveAttribute("data-turn", "1");
    await expect(view.getByTestId("player-1")).toHaveAttribute(
      "data-hp",
      "100",
    );
    await expect(view.getByTestId("player-2")).toHaveAttribute(
      "data-hp",
      "100",
    );
    await expect(view.locator("canvas")).toHaveCount(1);
  }
  if (!oldRoom) throw new Error("Missing previous room URL");
  const retired = await page.context().newPage();
  try {
    await retired.goto(new URL(oldRoom, page.url()).href);
    await expect(retired.locator('main [role="alert"]')).toContainText(
      "no longer exists",
    );
  } finally {
    await retired.close();
  }
  expect(errors).toEqual([]);
});

test("playground creation errors allow a retry without duplicate players", async ({
  page,
}) => {
  await page.goto("/playground");
  await page.route("**/matchmake/create/battle", (route) => route.abort());
  await page
    .getByRole("button", { name: "Start Playground", exact: true })
    .click();
  await expect(page.getByTestId("playground-error")).toContainText(
    "game server",
  );
  await expect(
    page.getByRole("button", { name: "Start Playground", exact: true }),
  ).toBeEnabled();
  await page.unroute("**/matchmake/create/battle");
  await page
    .getByRole("button", { name: "Start Playground", exact: true })
    .dblclick();
  await expect(
    page.getByTestId("playground-player-1").getByTestId("battle"),
  ).toHaveAttribute("data-phase", "aiming");
  await expect(
    page.frameLocator('iframe[title="Player 2 game"]').getByTestId("battle"),
  ).toHaveAttribute("data-phase", "aiming");
  await expect(page.getByTestId("playground-error")).toHaveCount(0);
  await expect(page.locator("iframe")).toHaveCount(1);
});
