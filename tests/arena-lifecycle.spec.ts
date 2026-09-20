import { expect, test } from "@playwright/test";

test("leaving the arena releases its window keyboard listeners", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const listeners = new Map<
      string,
      Set<EventListenerOrEventListenerObject>
    >();
    const count = () => {
      document.documentElement.dataset.windowKeyListeners = String(
        [...listeners.values()].reduce(
          (total, entries) => total + entries.size,
          0,
        ),
      );
    };
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    window.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (type === "keydown" || type === "keyup") {
        const entries =
          listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
        entries.add(listener);
        listeners.set(type, entries);
        count();
      }
      add(type, listener, options);
    }) as typeof window.addEventListener;
    window.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) => {
      listeners.get(type)?.delete(listener);
      count();
      remove(type, listener, options);
    }) as typeof window.removeEventListener;
  });
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Create Game/ })).toBeVisible();
  const count = async () =>
    Number(
      (await page.locator("html").getAttribute("data-window-key-listeners")) ??
        0,
    );
  const before = await count();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("link", { name: /Local/ }).click();
    await page
      .getByRole("button", { name: "Start match", exact: true })
      .click();
    await expect(page.locator("canvas")).toBeFocused();
    await expect.poll(count).toBeGreaterThan(before);
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("button", { name: "Leave", exact: true }).click();
    await page.getByRole("link", { name: "Leave match", exact: true }).click();
    await expect(page.getByRole("link", { name: /Create Game/ })).toBeVisible();
    await expect.poll(count).toBe(before);
  }
});
