import {
  getNumeroComprobanteEmitido,
  SIN_NUMERO_COMPROBANTE,
} from "@/app/facturacion/lib/numero-comprobante";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";

function row(taxDocument?: Record<string, unknown>): TaxDocumentRow {
  return { sale: {}, taxDocument } as unknown as TaxDocumentRow;
}

describe("getNumeroComprobanteEmitido", () => {
  it("muestra serie-correlativo de un comprobante aceptado", () => {
    expect(
      getNumeroComprobanteEmitido(
        row({ series: "B002", correlative: "00000015", cdrStatus: "ACCEPTED" }),
      ),
    ).toBe("B002-00000015");
  });

  it("también para aceptado con observaciones", () => {
    expect(
      getNumeroComprobanteEmitido(
        row({ series: "F001", correlative: "00000099", cdrStatus: "ACCEPTED_WITH_OBSERVATION" }),
      ),
    ).toBe("F001-00000099");
  });

  it.each(["PENDING", "REJECTED", "ERROR", "IN_PROCESS"])(
    "muestra — si el estado es %s (no emitido)",
    (cdrStatus) => {
      expect(
        getNumeroComprobanteEmitido(row({ series: "B002", correlative: "00000016", cdrStatus })),
      ).toBe(SIN_NUMERO_COMPROBANTE);
    },
  );

  it("muestra — si la venta no tiene comprobante", () => {
    expect(getNumeroComprobanteEmitido(row())).toBe("—");
  });
});
