import { expect, test } from "bun:test";
import type { IncomingMessage } from "node:http";
import { Admission, TokenBucket } from "./limits";

test("message budget rejects bursts and restores only elapsed tokens", () => {
  let now = 0;
  const bucket = new TokenBucket(2, 1, () => now);
  expect(bucket.take()).toBe(true);
  expect(bucket.take()).toBe(true);
  expect(bucket.take()).toBe(false);
  now = 999;
  expect(bucket.take()).toBe(false);
  now = 1000;
  expect(bucket.take()).toBe(true);
  expect(bucket.take()).toBe(false);
  now = 100_000;
  expect(bucket.take()).toBe(true);
  expect(bucket.take()).toBe(true);
  expect(bucket.take()).toBe(false);
});

test("locally rejected requests preserve capacity for another address", () => {
  const admission = new Admission();
  const request = (address: string) =>
    ({ headers: {}, socket: { remoteAddress: address } }) as IncomingMessage;
  const attacker = request("203.0.113.1");
  for (let i = 0; i < 1000; i++) admission.allowRequest(attacker, true);
  expect(admission.allowRequest(request("203.0.113.2"), true)).toBe(true);
});
