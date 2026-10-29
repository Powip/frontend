import {
  clearOnboardingState,
  getStoredOnboardingState,
  ONBOARDING_STORAGE_TTL_MS,
  saveOnboardingState,
  validateStoredOnboardingState,
} from "../onboardingStorage";

const KEY = "powip_onboarding";
const checkout = {
  planId: "p1",
  planName: "Basic",
  price: 99,
  userId: "user-a",
  addOnIds: ["addon-a"],
  cardToken: "synthetic-checkout-token",
};
beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-13T12:00:00Z"));
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("persiste solo metadata de checkout, nunca credenciales o datos de tarjeta", () => {
  saveOnboardingState({
    ...checkout,
    password: "secret",
    accessToken: "bearer",
    cardNumber: "fixture",
  } as typeof checkout);
  const raw = localStorage.getItem(KEY);
  expect(raw).not.toContain("secret");
  expect(raw).not.toContain("bearer");
  expect(raw).not.toContain("cardNumber");
  expect(getStoredOnboardingState("user-a")).toEqual(checkout);
  expect(getStoredOnboardingState("user-b")).toBeNull();
});

it("migra metadata legacy únicamente al recuperar al mismo usuario", () => {
  localStorage.setItem(KEY, JSON.stringify(checkout));
  expect(getStoredOnboardingState()).toBeNull();
  expect(getStoredOnboardingState("user-b")).toBeNull();
  expect(getStoredOnboardingState("user-a")).toEqual(checkout);
  expect(JSON.parse(localStorage.getItem(KEY) ?? "{}")).toMatchObject({
    version: 1,
    state: checkout,
  });
});

it("descarta checkout expirado sin restaurar un token viejo", () => {
  saveOnboardingState(checkout);
  jest.advanceTimersByTime(ONBOARDING_STORAGE_TTL_MS + 1);
  expect(getStoredOnboardingState("user-a")).toBeNull();
  expect(localStorage.getItem(KEY)).toBeNull();
});

it.each(["{", "null", "[]", '{"cardToken":"token"}', '{"version":1,"savedAt":0,"state":{}}'])(
  "rechaza datos malformados %s sin fallar",
  (raw) => {
    localStorage.setItem(KEY, raw);
    expect(getStoredOnboardingState("user-a")).toBeNull();
  },
);

it("ignora precios inválidos y arrays que no son IDs", () => {
  saveOnboardingState({ ...checkout, price: Number.NaN });
  expect(localStorage.getItem(KEY)).toBeNull();
  localStorage.setItem(KEY, JSON.stringify({ ...checkout, addOnIds: [{}] }));
  expect(getStoredOnboardingState("user-a")).toBeNull();
});

it("tolera storage bloqueado durante lectura, escritura y limpieza", () => {
  for (const method of ["getItem", "setItem", "removeItem"] as const) {
    jest.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new Error("Storage blocked");
    });
  }
  expect(() => saveOnboardingState(checkout)).not.toThrow();
  expect(getStoredOnboardingState("user-a")).toBeNull();
  expect(() => clearOnboardingState()).not.toThrow();
});

it("la limpieza tardía de un usuario no elimina el checkout de otro", () => {
  saveOnboardingState(checkout);
  clearOnboardingState("user-b");
  expect(getStoredOnboardingState("user-a")).toEqual(checkout);
  clearOnboardingState("user-a");
  expect(getStoredOnboardingState()).toBeNull();
});

it("preserva el ID de suscripción cuando existe y permite metadata legacy sin ID", () => {
  saveOnboardingState({ ...checkout, subscriptionId: "subscription-a" });
  expect(getStoredOnboardingState("user-a")?.subscriptionId).toBe("subscription-a");
  saveOnboardingState(checkout);
  expect(getStoredOnboardingState("user-a")).toEqual(checkout);
});

it.each(["", " ", 12, null])("rechaza un ID de suscripción inválido %s", (subscriptionId) => {
  localStorage.setItem(KEY, JSON.stringify({ ...checkout, subscriptionId }));
  expect(getStoredOnboardingState("user-a")).toBeNull();
});

describe("marca de migración a Flow (FEAT-25)", () => {
  const valid = { planId: "p1", planName: "Basic", price: 99, addOnIds: [], userId: "u1", cardToken: "tk" };

  it("conserva migrate: true", () => {
    expect(validateStoredOnboardingState({ ...valid, migrate: true })).toEqual({ ...valid, migrate: true });
  });

  it("descarta un migrate que no es true sin invalidar el resto", () => {
    expect(validateStoredOnboardingState({ ...valid, migrate: "si" })).toEqual(valid);
    expect(validateStoredOnboardingState({ ...valid, migrate: false })).toEqual(valid);
  });
});
