import { isInPeruWindow, peruDateOf, shiftPeruDate, todayInPeru } from "../peruDate";

describe("peruDate", () => {
  it("todayInPeru usa la fecha de Lima, no la UTC", () => {
    expect(todayInPeru(new Date("2026-10-21T03:30:00Z"))).toBe("2026-10-20");
    expect(todayInPeru(new Date("2026-10-21T05:00:00Z"))).toBe("2026-10-21");
  });

  it("shiftPeruDate suma días de calendario", () => {
    expect(shiftPeruDate("2026-10-20", -29)).toBe("2026-09-21");
    expect(shiftPeruDate("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("peruDateOf convierte un timestamp a su día en Lima", () => {
    expect(peruDateOf("2026-09-21T04:30:00.000Z")).toBe("2026-09-20");
  });

  it("no depende de cómo el locale formatea la fecha completa", () => {
    // Algunos motores formatean en-CA como MM/DD/YYYY: el día se arma con las partes.
    // En el motor `format` es un getter; los tipos del DOM lo declaran como método.
    const proto = Intl.DateTimeFormat.prototype as unknown as { format: unknown };
    const format = jest.spyOn(proto, "format", "get").mockReturnValue(() => "10/20/2026");
    try {
      expect(todayInPeru(new Date("2026-10-21T03:30:00Z"))).toBe("2026-10-20");
      expect(peruDateOf("2026-09-21T04:30:00.000Z")).toBe("2026-09-20");
    } finally {
      format.mockRestore();
    }
  });

  it("isInPeruWindow respeta los bordes y toDate vacío como sin tope", () => {
    expect(isInPeruWindow("2026-09-21T04:30:00.000Z", { fromDate: "2026-09-21", toDate: "" })).toBe(false);
    expect(isInPeruWindow("2026-09-21T05:00:00.000Z", { fromDate: "2026-09-21", toDate: "2026-09-21" })).toBe(true);
    expect(isInPeruWindow("2026-12-01T15:00:00.000Z", { fromDate: "2026-09-21", toDate: "" })).toBe(true);
  });
});
