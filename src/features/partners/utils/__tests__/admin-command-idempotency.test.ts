import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { POLICY_COMMAND, WRITE_USER_A, WRITE_USER_B } from "../../test-utils/admin-writes.fixture";
import { resolveAdminCommandIdempotencyKey } from "../admin-command-idempotency";
import { createIdempotencyKey } from "../create-idempotency-key";

jest.mock("../create-idempotency-key", () => ({ createIdempotencyKey: jest.fn() }));
beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  Object.defineProperty(globalThis, "TextEncoder", { value: TextEncoder, configurable: true });
});
beforeEach(() => {
  sessionStorage.clear();
  let counter = 0;
  jest
    .mocked(createIdempotencyKey)
    .mockReset()
    .mockImplementation(() => `opaque-retry-${++counter}`);
});
afterEach(() => jest.restoreAllMocks());
const operation = "commission-policy.create-draft";
const storageKey = `powip:partners:admin-command:${operation}:${WRITE_USER_A}`;

it("conserves a key through retries/reloads and simultaneous digest completion", async () => {
  const keys = await Promise.all([
    resolveAdminCommandIdempotencyKey(WRITE_USER_A, operation, POLICY_COMMAND),
    resolveAdminCommandIdempotencyKey(WRITE_USER_A, operation, { ...POLICY_COMMAND }),
  ]);
  expect(keys[0]).toBe(keys[1]);
  expect(await resolveAdminCommandIdempotencyKey(WRITE_USER_A, operation, POLICY_COMMAND)).toBe(
    keys[0],
  );
  expect(createIdempotencyKey).toHaveBeenCalledTimes(1);
});
it("reuses the same key when a later invocation completes its digest first", async () => {
  const digest = await webcrypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(POLICY_COMMAND)),
  );
  let completeFirst!: (value: ArrayBuffer) => void;
  let completeSecond!: (value: ArrayBuffer) => void;
  jest
    .spyOn(webcrypto.subtle, "digest")
    .mockImplementationOnce(
      () =>
        new Promise<ArrayBuffer>((resolve) => {
          completeFirst = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise<ArrayBuffer>((resolve) => {
          completeSecond = resolve;
        }),
    );
  const clock = jest.spyOn(Date, "now").mockReturnValue(1000);
  const first = resolveAdminCommandIdempotencyKey(WRITE_USER_A, operation, POLICY_COMMAND);
  clock.mockReturnValue(1001);
  const second = resolveAdminCommandIdempotencyKey(WRITE_USER_A, operation, { ...POLICY_COMMAND });
  completeSecond(digest);
  const savedKey = await second;
  clock.mockReturnValue(1002);
  completeFirst(digest);
  await expect(first).resolves.toBe(savedKey);
  expect(JSON.parse(sessionStorage.getItem(storageKey) ?? "{}").entries[0].createdAt).toBe(1001);
  expect(createIdempotencyKey).toHaveBeenCalledTimes(1);
});
it("stores only hashes and opaque retry keys, not command reasons, rates or tokens", async () => {
  await resolveAdminCommandIdempotencyKey(WRITE_USER_A, operation, POLICY_COMMAND);
  const raw = sessionStorage.getItem(storageKey) ?? "";
  expect(JSON.parse(raw).entries).toHaveLength(1);
  for (const value of [
    POLICY_COMMAND.reason,
    POLICY_COMMAND.code,
    POLICY_COMMAND.firstPaymentRate,
    "accessToken",
    "Bearer",
  ])
    expect(raw).not.toContain(value);
});
it("isolates actor, operation/target and changed commands while preserving the original retry", async () => {
  const original = await resolveAdminCommandIdempotencyKey(WRITE_USER_A, operation, POLICY_COMMAND);
  expect(await resolveAdminCommandIdempotencyKey(WRITE_USER_B, operation, POLICY_COMMAND)).not.toBe(
    original,
  );
  expect(
    await resolveAdminCommandIdempotencyKey(
      WRITE_USER_A,
      "resource.publish:other-id",
      POLICY_COMMAND,
    ),
  ).not.toBe(original);
  expect(
    await resolveAdminCommandIdempotencyKey(WRITE_USER_A, operation, {
      ...POLICY_COMMAND,
      code: "OTHER_DRAFT",
    }),
  ).not.toBe(original);
  expect(await resolveAdminCommandIdempotencyKey(WRITE_USER_A, operation, POLICY_COMMAND)).toBe(
    original,
  );
});
it("does not replace an expired unknown-result key", async () => {
  const now = Date.now();
  const key = await resolveAdminCommandIdempotencyKey(WRITE_USER_A, operation, POLICY_COMMAND, now);
  await expect(
    resolveAdminCommandIdempotencyKey(WRITE_USER_A, operation, POLICY_COMMAND, now + 86_400_000),
  ).rejects.toThrow(/venció/);
  expect(JSON.parse(sessionStorage.getItem(storageKey) ?? "{}").entries[0].key).toBe(key);
  expect(createIdempotencyKey).toHaveBeenCalledTimes(1);
});
it.each([
  "{",
  JSON.stringify({ version: 2 }),
  JSON.stringify({ version: 1, userId: WRITE_USER_B, operation, entries: [] }),
])("fails closed on malformed or cross-actor retry storage %#", async (raw) => {
  sessionStorage.setItem(storageKey, raw);
  await expect(
    resolveAdminCommandIdempotencyKey(WRITE_USER_A, operation, POLICY_COMMAND),
  ).rejects.toThrow(/clave de reintento/);
  expect(createIdempotencyKey).not.toHaveBeenCalled();
});
it("does not send with unverifiable retry persistence", async () => {
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
  await expect(
    resolveAdminCommandIdempotencyKey(WRITE_USER_A, operation, POLICY_COMMAND),
  ).rejects.toThrow(/almacenamiento/);
});
