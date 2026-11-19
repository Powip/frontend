import {
  calcularMontosNota,
  formatMotivoNota,
  getCodigoMotivoNc,
  MOTIVOS_NC,
} from "@/app/facturacion/lib/motivos-nota-credito";

describe("motivos de nota de crédito (catálogo SUNAT 09)", () => {
  it("asigna el código oficial a cada motivo del modal", () => {
    expect(getCodigoMotivoNc("Anulación de la operación")).toBe("01");
    expect(getCodigoMotivoNc("Anulación por error en el RUC")).toBe("02");
    expect(getCodigoMotivoNc("Corrección por error en la descripción")).toBe("03");
    expect(getCodigoMotivoNc("Descuento global")).toBe("04");
    expect(getCodigoMotivoNc("Descuento por ítem")).toBe("05");
    expect(getCodigoMotivoNc("Devolución total")).toBe("06");
    expect(getCodigoMotivoNc("Devolución por ítem")).toBe("07");
    expect(getCodigoMotivoNc("Bonificación")).toBe("08");
  });

  it("no inventa código para un motivo desconocido", () => {
    expect(getCodigoMotivoNc("Otro motivo")).toBeUndefined();
  });

  it("los motivos del modal tienen código único", () => {
    const codes = MOTIVOS_NC.map((motivo) => motivo.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("formatea código y descripción", () => {
    expect(formatMotivoNota({ motivo: "Devolución total" })).toBe("06 · Devolución total");
    expect(formatMotivoNota({ motivo: "Devolución total", motivoCodigo: "06" })).toBe(
      "06 · Devolución total",
    );
    expect(formatMotivoNota({ motivo: "Otro motivo" })).toBe("Otro motivo");
  });
});

describe("calcularMontosNota", () => {
  it("separa IGV 18% de un monto con IGV incluido", () => {
    expect(calcularMontosNota(2730)).toEqual({ subtotal: 2313.56, igv: 416.44, total: 2730 });
  });

  it("usa la proporción de IGV del comprobante original si existe", () => {
    // Original exonerado: sin IGV.
    expect(calcularMontosNota(100, { taxTotal: 0, grandTotal: 500 })).toEqual({
      subtotal: 100,
      igv: 0,
      total: 100,
    });
  });
});
