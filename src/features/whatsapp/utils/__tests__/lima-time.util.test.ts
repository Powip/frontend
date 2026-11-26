import {
  formatLimaDate,
  formatLimaDateTime,
  formatLimaDayLabel,
  formatLimaShortDate,
  formatLimaTime,
  getLimaDateParts,
  isSameLimaDay,
} from "../lima-time.util";

describe("lima-time", () => {
  it("convierte UTC a hora de Lima (UTC-5)", () => {
    expect(formatLimaDateTime("2026-10-06T14:10:00.000Z")).toBe("06/10/2026 09:10");
  });

  it("cambia de día cuando en UTC ya es el día siguiente", () => {
    const date = new Date("2026-10-07T03:30:00.000Z");
    expect(formatLimaDate(date)).toBe("06/10/2026");
    expect(formatLimaTime(date)).toBe("22:30");
    expect(getLimaDateParts(date)).toEqual({ year: 2026, month: 10, day: 6, hour: 22, minute: 30 });
  });

  it("usa medianoche como 00", () => {
    expect(formatLimaTime("2026-10-08T05:00:00.000Z")).toBe("00:00");
  });

  it("formatea fecha corta con mes en español", () => {
    expect(formatLimaShortDate("2026-01-04T15:00:00.000Z")).toBe("04 ene");
  });

  it("calcula Hoy, Ayer y fechas anteriores según el día de Lima", () => {
    const now = new Date("2026-10-08T04:00:00.000Z");
    expect(formatLimaDayLabel("2026-10-07T06:00:00.000Z", now)).toBe("Hoy");
    expect(formatLimaDayLabel("2026-10-07T04:59:00.000Z", now)).toBe("Ayer");
    expect(formatLimaDayLabel("2026-10-05T15:00:00.000Z", now)).toBe("05 oct");
    expect(isSameLimaDay("2026-10-07T23:00:00.000Z", "2026-10-08T04:59:00.000Z")).toBe(true);
  });

  it("no depende de la zona horaria del proceso", () => {
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "2-digit" });
    expect(formatter.resolvedOptions().timeZone).toBe("Asia/Tokyo");
    expect(formatLimaDateTime(Date.UTC(2026, 11, 31, 23, 59))).toBe("31/12/2026 18:59");
  });

  it("rechaza fechas inválidas", () => {
    expect(() => formatLimaTime("no-es-fecha")).toThrow(RangeError);
  });
});
