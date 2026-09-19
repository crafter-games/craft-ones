import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { ActionNotice } from "../../web/src/lib/actionNotice";

const callbacks: (() => void)[] = [];
beforeEach(() => {
  spyOn(globalThis, "setTimeout").mockImplementation(((
    callback: () => void,
    delay: number,
  ) => {
    expect(delay).toBe(3000);
    callbacks.push(callback);
    return callbacks.length;
  }) as unknown as typeof setTimeout);
  spyOn(globalThis, "clearTimeout").mockImplementation(() => {});
});

afterEach(() => {
  callbacks.length = 0;
  spyOn(globalThis, "setTimeout").mockRestore();
  spyOn(globalThis, "clearTimeout").mockRestore();
});

test("a repeated rejection does not reset its three-second deadline", () => {
  const messages: string[] = [];
  const notice = new ActionNotice((message) => messages.push(message));
  notice.report("Jump unavailable");
  notice.report("Jump unavailable");
  expect(callbacks).toHaveLength(1);
  callbacks[0]?.();
  notice.report("Jump unavailable");
  expect(callbacks).toHaveLength(1);
  expect(messages).toEqual(["Jump unavailable", ""]);
});

test("an old timeout cannot clear a newer rejection", () => {
  const messages: string[] = [];
  const notice = new ActionNotice((message) => messages.push(message));
  notice.report("Jump unavailable");
  notice.report("Movement unavailable");
  callbacks[0]?.();
  expect(messages).toEqual(["Jump unavailable", "Movement unavailable"]);
  callbacks[1]?.();
  expect(messages.at(-1)).toBe("");
});

test("success, a new turn, and disposal cancel pending callbacks", () => {
  const messages: string[] = [];
  const notice = new ActionNotice((message) => messages.push(message));
  notice.report("Jump unavailable");
  notice.report(null);
  expect(messages.at(-1)).toBe("");
  notice.report("Movement unavailable");
  notice.clear();
  notice.report("Jump unavailable");
  notice.dispose();
  const before = [...messages];
  for (const callback of callbacks) callback();
  expect(messages).toEqual(before);
  expect(globalThis.clearTimeout).toHaveBeenCalled();
});
