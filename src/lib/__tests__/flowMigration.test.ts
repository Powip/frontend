import { addDays, firstChargePreview, formatLimaDate, isScheduledMigration, limaToday } from "../flowMigration";

describe("limaToday", () => {
  it("a las 23:30 de Lima (04:30 UTC del día siguiente) sigue siendo hoy", () => {
    expect(limaToday(new Date("2026-10-20T04:30:00Z"))).toBe("2026-10-19");
  });

  it("a las 00:10 de Lima ya es el día siguiente", () => {
    expect(limaToday(new Date("2026-10-20T05:10:00Z"))).toBe("2026-10-20");
  });
});

describe("addDays", () => {
  it.each([
    ["2026-10-28", 1, "2026-10-29"],
    ["2026-10-31", 1, "2026-11-01"],
    ["2026-12-31", 1, "2027-01-01"],
  ])("%s + %d = %s", (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });
});

describe("firstChargePreview", () => {
  it("con días pagados, el primer cobro es el día siguiente al vencimiento", () => {
    expect(firstChargePreview("2026-10-28", "2026-10-20")).toBe("2026-10-29");
  });

  it("si vence hoy, el primer cobro es mañana", () => {
    expect(firstChargePreview("2026-10-19", "2026-10-19")).toBe("2026-10-20");
  });

  it("si ya venció, se cobra hoy (sin fecha)", () => {
    expect(firstChargePreview("2026-10-18", "2026-10-19")).toBeNull();
  });

  it("sin vencimiento, se cobra hoy", () => {
    expect(firstChargePreview(null, "2026-10-19")).toBeNull();
    expect(firstChargePreview(undefined, "2026-10-19")).toBeNull();
  });
});

describe("formatLimaDate", () => {
  it.each([
    ["2026-10-23", "viernes 23/10"],
    ["2026-11-01", "domingo 01/11"],
    ["2026-10-29", "jueves 29/10"],
  ])("%s → %s", (date, expected) => {
    expect(formatLimaDate(date)).toBe(expected);
  });
});

describe("isScheduledMigration", () => {
  it("solo una FLOW pendiente de pago con fecha de inicio está programada", () => {
    expect(isScheduledMigration({ gateway: "FLOW", status: "PENDING_PAYMENT", startDate: "2026-10-29" })).toBe(true);
    expect(isScheduledMigration({ gateway: "FLOW", status: "PENDING_PAYMENT", startDate: null })).toBe(false);
    expect(isScheduledMigration({ gateway: "FLOW", status: "ACTIVE", startDate: "2026-10-29" })).toBe(false);
    expect(isScheduledMigration({ gateway: "MANUAL", status: "PENDING_PAYMENT", startDate: "2026-10-29" })).toBe(false);
  });
});
