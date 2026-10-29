import { createHash, webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { createIdempotencyKey } from "../create-idempotency-key";
import {
  confirmManualReferralRetryKey,
  MANUAL_REFERRAL_RETRY_TTL_MS,
  manualReferralStorageKey,
  resolveManualReferralRetryKey,
} from "../manual-referral-idempotency";

jest.mock("../create-idempotency-key", () => ({ createIdempotencyKey: jest.fn() }));
const mockCreateKey = jest.mocked(createIdempotencyKey);
const USER = "partner-user";
const DTO = { businessName: "Zapatería Andes", email: "andes@example.com", phone: "+51987654321" };

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  Object.defineProperty(globalThis, "TextEncoder", { value: TextEncoder, configurable: true });
});
beforeEach(() => {
  sessionStorage.clear();
  let counter = 0;
  mockCreateKey.mockReset();
  mockCreateKey.mockImplementation(() => `referral-key-${++counter}`);
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe("journal de reintentos manuales sin PII", () => {
  it("persiste solo usuario, operación, versión, SHA-256, clave opaca y fecha", async () => {
    const key = await resolveManualReferralRetryKey(USER, DTO);
    expect(key.fingerprint).toBe(createHash("sha256").update(JSON.stringify(DTO)).digest("hex"));
    const stored = sessionStorage.getItem(manualReferralStorageKey(USER))!;
    expect(JSON.parse(stored)).toEqual({
      version: 1,
      userId: USER,
      operation: "partner.referral.register",
      entries: [key],
    });
    for (const privateValue of [
      DTO.businessName,
      DTO.email,
      DTO.phone,
      "businessName",
      "email",
      "phone",
      "JWT",
    ]) {
      expect(stored).not.toContain(privateValue);
    }
  });

  it("recupera desde sessionStorage y conserva A→B→A sin depender del estado de un hook", async () => {
    const first = await resolveManualReferralRetryKey(USER, DTO);
    const second = await resolveManualReferralRetryKey(USER, { ...DTO, phone: "+51987654322" });
    expect(second.key).not.toBe(first.key);
    expect((await resolveManualReferralRetryKey(USER, { ...DTO })).key).toBe(first.key);
  });

  it("retira únicamente el payload confirmado y conserva otros pendientes", async () => {
    const pending = await resolveManualReferralRetryKey(USER, DTO);
    const otherDto = { ...DTO, phone: "+51987654322" };
    const confirmed = await resolveManualReferralRetryKey(USER, otherDto);
    confirmManualReferralRetryKey(USER, confirmed);
    expect((await resolveManualReferralRetryKey(USER, DTO)).key).toBe(pending.key);
    expect((await resolveManualReferralRetryKey(USER, otherDto)).key).not.toBe(confirmed.key);
  });

  it("aísla claves de dos usuarios", async () => {
    const first = await resolveManualReferralRetryKey(USER, DTO);
    const second = await resolveManualReferralRetryKey("another-user", DTO);
    expect(second.key).not.toBe(first.key);
  });

  it("bloquea un pendiente vencido sin sustituir su clave", async () => {
    const key = await resolveManualReferralRetryKey(USER, DTO);
    mockCreateKey.mockClear();
    await expect(
      resolveManualReferralRetryKey(USER, DTO, key.createdAt + MANUAL_REFERRAL_RETRY_TTL_MS),
    ).rejects.toThrow(/venció/);
    expect(mockCreateKey).not.toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem(manualReferralStorageKey(USER))!).entries).toEqual([
      key,
    ]);
  });

  it.each([
    "{",
    JSON.stringify({ version: 2 }),
    JSON.stringify({
      version: 1,
      userId: "wrong",
      operation: "partner.referral.register",
      entries: [],
    }),
  ])("bloquea un journal corrupto sin generar nueva clave", async (raw) => {
    sessionStorage.setItem(manualReferralStorageKey(USER), raw);
    await expect(resolveManualReferralRetryKey(USER, DTO)).rejects.toThrow(/no es válido/);
    expect(mockCreateKey).not.toHaveBeenCalled();
  });

  it("bloquea si sessionStorage no acepta escrituras", async () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    await expect(resolveManualReferralRetryKey(USER, DTO)).rejects.toThrow(/registro seguro/);
  });

  it("bloquea si la escritura no puede verificarse", async () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
    await expect(resolveManualReferralRetryKey(USER, DTO)).rejects.toThrow(/registro seguro/);
  });
});
