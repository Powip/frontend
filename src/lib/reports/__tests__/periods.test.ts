import { AxiosError, AxiosHeaders } from "axios";
import { isPeriodLocked, lastDayOf, periodLabel, periodLockedMessage, purchasesRange, shiftPeriod } from "../periods";

const httpError = (status: number, data: unknown) =>
  new AxiosError(String(status), "ERR", undefined, undefined, { status, statusText: "", headers: {}, config: { headers: new AxiosHeaders() }, data });

describe("periodos (FEAT-24 H10)", () => {
  it("nombra, corre y cierra meses", () => {
    expect(periodLabel("2026-10")).toBe("Octubre 2026");
    expect(periodLabel("raro")).toBe("raro");
    expect(shiftPeriod("2026-01", -1)).toBe("2025-12");
    expect(shiftPeriod("2026-11", 2)).toBe("2027-01");
    expect(lastDayOf("2028-02")).toBe("2028-02-29");
  });

  it("arma los rangos rápidos del reporte de compras en días de Lima", () => {
    // 18/11/2026 02:00 UTC = 17/11/2026 21:00 en Lima.
    const now = new Date("2026-11-18T02:00:00Z");
    expect(purchasesRange("mes", {}, now)).toEqual({ from: "2026-11-01", to: "2026-11-17", label: "Noviembre 2026" });
    expect(purchasesRange("mesant", {}, now)).toEqual({ from: "2026-10-01", to: "2026-10-31", label: "Octubre 2026" });
    expect(purchasesRange("trim", {}, now)).toEqual({ from: "2026-07-01", to: "2026-09-30", label: "jul–set 2026" });
    expect(purchasesRange("trim", {}, new Date("2026-02-10T15:00:00Z"))).toMatchObject({ from: "2025-10-01", to: "2025-12-31" });
    expect(purchasesRange("anio", {}, now)).toEqual({ from: "2026-01-01", to: "2026-11-17", label: "Año 2026" });
  });

  it("valida el rango elegido a mano", () => {
    expect(purchasesRange("rango", { from: "2026-01-01", to: "2026-03-31" })).toEqual({ from: "2026-01-01", to: "2026-03-31", label: "01/01/2026 al 31/03/2026" });
    expect(purchasesRange("rango", { from: "2026-03-01", to: "2026-01-01" }).error).toMatch(/anterior/);
    expect(purchasesRange("rango", { from: "2023-01-01", to: "2026-01-01" }).error).toMatch(/dos años/);
    expect(purchasesRange("rango", { from: "", to: "2026-01-01" }).error).toBe("Elige las dos fechas.");
  });
});

describe("423 de un mes cerrado (H10-D6)", () => {
  it("explica qué mes está cerrado y qué hacer", () => {
    const error = httpError(423, { statusCode: 423, error: "Locked", code: "PERIODO_CERRADO", period: "2026-10", message: "El periodo 2026-10 está cerrado." });
    expect(isPeriodLocked(error)).toBe(true);
    expect(periodLockedMessage(error)).toBe(
      "Octubre 2026 está cerrado. El periodo 2026-10 está cerrado. Para corregirlo, registra un ajuste en el mes abierto o pide al Administrador que reabra el mes en Inventario › Cierre mensual.",
    );
  });

  it("sin periodo usa un texto genérico; otros errores no son de cierre", () => {
    expect(periodLockedMessage(httpError(423, {}))).toMatch(/^El mes de esta operación está cerrado\./);
    expect(isPeriodLocked(httpError(409, { message: "Falta stock" }))).toBe(false);
    expect(periodLockedMessage(httpError(409, { message: "Falta stock" }))).toBeNull();
    expect(periodLockedMessage(new Error("red"))).toBeNull();
  });
});
