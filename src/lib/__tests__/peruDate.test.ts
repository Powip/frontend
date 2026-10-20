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

  it("isInPeruWindow respeta los bordes y toDate vacío como sin tope", () => {
    expect(isInPeruWindow("2026-09-21T04:30:00.000Z", { fromDate: "2026-09-21", toDate: "" })).toBe(false);
    expect(isInPeruWindow("2026-09-21T05:00:00.000Z", { fromDate: "2026-09-21", toDate: "2026-09-21" })).toBe(true);
    expect(isInPeruWindow("2026-12-01T15:00:00.000Z", { fromDate: "2026-09-21", toDate: "" })).toBe(true);
  });
});
