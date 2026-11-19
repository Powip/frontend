import type { SunatDocumentSequence } from "@/features/sunat/sunat-document-sequence/models/sunat-document-sequence";
import type { SunatDocument } from "../../models/sunat-document.model";
import {
  buildCreditNoteRequest,
  getCreditableBalance,
  resolveCreditNoteSeries,
} from "../build-credit-note-request";

function doc(overrides: Partial<SunatDocument> = {}): SunatDocument {
  return {
    id: "inv-1",
    orderId: "order-1",
    companyId: "c-1",
    rucIssuer: "20123456789",
    taxDocumentType: "01",
    series: "F001",
    correlative: "00000012",
    issueDate: "2026-11-19",
    cdrStatus: "ACCEPTED",
    sunatCode: "0",
    sunatDescription: null,
    observations: null,
    signedXmlStoragePath: null,
    cdrStoragePath: null,
    digestValue: null,
    referenceDocumentId: null,
    createdAt: "2026-11-19T10:00:00Z",
    updatedAt: "2026-11-19T10:00:00Z",
    taxDocumentPayload: {
      customer: {
        name: "DRASANVI PERU S.A.C.",
        identityDocumentType: "6",
        identityDocumentNumber: "20100070970",
      },
      totals: {
        currency: "PEN",
        subtotal: 200,
        discountTotal: 0,
        shippingTotal: 0,
        taxTotal: 36,
        grandTotal: 236,
      },
      items: [
        {
          sku: "A",
          productName: "Chompa",
          quantity: 2,
          unitPrice: 50,
          subtotal: 100,
          discountAmount: 0,
          unitCode: "NIU",
          taxType: "10",
        },
        {
          sku: "B",
          productName: "Pantalón",
          quantity: 1,
          unitPrice: 100,
          subtotal: 100,
          discountAmount: 0,
          unitCode: "NIU",
          taxType: "10",
        },
      ],
    },
    ...overrides,
  } as SunatDocument;
}

describe("buildCreditNoteRequest", () => {
  it("06 devolución total copia líneas y totales del comprobante original", () => {
    const original = doc();
    const request = buildCreditNoteRequest({
      original,
      series: "FC01",
      reason: { code: "06", description: "Devolución total" },
    });

    expect(request).toMatchObject({
      orderId: "order-1",
      taxDocumentType: "07",
      series: "FC01",
      referenceDocumentId: "inv-1",
      reason: { code: "06", description: "Devolución total" },
      customer: original.taxDocumentPayload.customer,
      totals: original.taxDocumentPayload.totals,
    });
    expect(request.items).toHaveLength(2);
  });

  it("07 devolución por ítem acredita solo las cantidades elegidas", () => {
    const request = buildCreditNoteRequest({
      original: doc(),
      series: "FC01",
      reason: { code: "07", description: "Devolución por ítem" },
      lines: [
        { index: 0, quantity: 1 },
        { index: 1, quantity: 0 },
      ],
    });

    expect(request.items).toEqual([
      expect.objectContaining({ sku: "A", quantity: 1, subtotal: 50 }),
    ]);
    expect(request.totals).toMatchObject({ subtotal: 50, taxTotal: 9, grandTotal: 59 });
  });

  it("04 descuento global arma una sola línea por el monto con IGV incluido", () => {
    const request = buildCreditNoteRequest({
      original: doc(),
      series: "FC01",
      reason: { code: "04", description: "Descuento global" },
      amount: 59,
    });

    expect(request.items).toHaveLength(1);
    expect(request.items[0]).toMatchObject({ quantity: 1, taxType: "10", unitCode: "ZZ" });
    expect(request.totals).toMatchObject({ subtotal: 50, taxTotal: 9, grandTotal: 59 });
  });
});

describe("getCreditableBalance", () => {
  it("resta las notas activas que referencian al comprobante", () => {
    const original = doc();
    const note = (status: string, total: number, id: string) =>
      doc({
        id,
        taxDocumentType: "07",
        cdrStatus: status as SunatDocument["cdrStatus"],
        referenceDocumentId: "inv-1",
        taxDocumentPayload: {
          ...original.taxDocumentPayload,
          totals: { ...original.taxDocumentPayload.totals, grandTotal: total },
        },
      });

    expect(
      getCreditableBalance(original, [
        original,
        note("ACCEPTED", 59, "n1"),
        note("PENDING", 10, "n2"),
        note("REJECTED", 100, "n3"),
      ]),
    ).toBe(167);
  });
});

describe("resolveCreditNoteSeries", () => {
  const seq = (series: string, isDefault = false, type = "07") =>
    ({ series, isDefault, taxDocumentType: type }) as SunatDocumentSequence;

  it("usa serie F para facturas y B para boletas, prefiriendo la predeterminada", () => {
    const sequences = [seq("FC02"), seq("FC01", true), seq("BC01"), seq("F001", true, "01")];

    expect(resolveCreditNoteSeries(sequences, "01")).toBe("FC01");
    expect(resolveCreditNoteSeries(sequences, "03")).toBe("BC01");
  });

  it("devuelve undefined si no hay serie de nota con el prefijo correcto", () => {
    expect(resolveCreditNoteSeries([seq("FC01", true)], "03")).toBeUndefined();
  });
});
