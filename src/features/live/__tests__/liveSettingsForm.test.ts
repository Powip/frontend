import {
  liveConfigChanges,
  liveConfigDraft,
  liveConfigErrors,
  liveYapeDraft,
  liveYapeErrors,
  liveYapeInput,
} from "../liveSettingsForm";
import type { LiveConfig } from "../types";

const saved: LiveConfig = {
  enabled: true,
  allowBuyNow: true,
  allowReservations: true,
  reservationMinutes: 15,
  maxReservedUnits: 5,
  allowAccumulation: false,
  combineShipping: false,
  homeShipping: null,
  agencyShipping: null,
  reminderEnabled: false,
  showBackLink: false,
  allowSellerLive: false,
  closePolicy: "END_OF_DAY",
  liveUrl: "",
  hideSoldOut: true,
  slug: "kunca",
  advisors: [{ id: "a", name: "Ana", code: "ana" }],
};

describe("live config form (FEAT-33 A1/B4)", () => {
  test("an untouched draft has no changes to send", () => {
    expect(liveConfigChanges(saved, liveConfigDraft(saved))).toEqual({});
  });

  test("sends only the fields that changed, with numbers as numbers", () => {
    const draft = {
      ...liveConfigDraft(saved),
      reservationMinutes: "20",
      allowAccumulation: true,
    };
    expect(liveConfigChanges(saved, draft)).toEqual({
      reservationMinutes: 20,
      allowAccumulation: true,
    });
  });

  test("trims the live link before comparing and sending it", () => {
    const draft = {
      ...liveConfigDraft(saved),
      liveUrl: "  https://www.tiktok.com/@kunca/live ",
    };
    expect(liveConfigChanges(saved, draft)).toEqual({
      liveUrl: "https://www.tiktok.com/@kunca/live",
    });
  });

  test.each([
    ["reservationMinutes", "4", "Entre 5 y 120 minutos."],
    ["reservationMinutes", "121", "Entre 5 y 120 minutos."],
    ["reservationMinutes", "7.5", "Entre 5 y 120 minutos."],
    ["reservationMinutes", "", "Entre 5 y 120 minutos."],
    ["maxReservedUnits", "0", "Entre 1 y 50 unidades."],
    ["maxReservedUnits", "51", "Entre 1 y 50 unidades."],
    ["liveUrl", "tiktok.com/@kunca", "Pega un enlace que empiece con https://"],
    [
      "liveUrl",
      "http://tiktok.com/@kunca",
      "Pega un enlace que empiece con https://",
    ],
    ["slug", "K", "Usa de 3 a 50 letras minúsculas, números o guiones."],
  ] as const)("rejects %s = %p", (field, value, message) => {
    const draft = { ...liveConfigDraft(saved), [field]: value };
    expect(liveConfigErrors(saved, draft)).toEqual({ [field]: message });
  });

  test("asks for the live link before showing «Volver al live»", () => {
    const draft = { ...liveConfigDraft(saved), showBackLink: true };
    expect(liveConfigErrors(saved, draft)).toEqual({
      liveUrl: "Pega el link de tu live para mostrar «Volver al live».",
    });
  });

  test("an old value outside the new range does not block saving another field", () => {
    const legacy = { ...saved, maxReservedUnits: 100 };
    const draft = { ...liveConfigDraft(legacy), hideSoldOut: false };
    expect(liveConfigErrors(legacy, draft)).toEqual({});
    expect(liveConfigChanges(legacy, draft)).toEqual({ hideSoldOut: false });
  });
});

describe("live Yape form (FEAT-33 A1)", () => {
  const yape = {
    enabled: true,
    phone: "912345678",
    holder: "Kunca SAC",
    qrUrl: null,
    reviewHours: 24,
  };

  test.each(["912 345 678", "+51 912 345 678", "51912345678", "912-345-678"])(
    "accepts %s as the 9-digit number",
    (phone) => {
      const draft = { ...liveYapeDraft(yape), phone };
      expect(liveYapeErrors(draft)).toEqual({});
      expect(liveYapeInput(draft).phone).toBe("912345678");
    },
  );

  test.each([
    ["phone", "812345678", "Número de 9 dígitos que empiece con 9."],
    ["phone", "91234567", "Número de 9 dígitos que empiece con 9."],
    [
      "holder",
      " Al ",
      "Escribe el titular tal como sale en Yape (al menos 3 letras).",
    ],
    ["reviewHours", "0", "Entre 1 y 72 horas."],
    ["reviewHours", "73", "Entre 1 y 72 horas."],
  ] as const)("rejects %s = %p", (field, value, message) => {
    expect(liveYapeErrors({ ...liveYapeDraft(yape), [field]: value })).toEqual({
      [field]: message,
    });
  });

  test("builds the request with trimmed holder and numeric hours, without the QR url", () => {
    const draft = {
      ...liveYapeDraft(yape),
      holder: "  Kunca SAC ",
      reviewHours: "12",
    };
    expect(liveYapeInput(draft)).toEqual({
      enabled: true,
      phone: "912345678",
      holder: "Kunca SAC",
      reviewHours: 12,
    });
  });
});
