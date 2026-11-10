import type { SunatDocument } from "../../models/sunat-document.model";
import { findActiveTaxDocument } from "../find-active-tax-document";

function doc(overrides: Partial<SunatDocument> & { id: string; total?: number }): SunatDocument {
  const { total = 100, ...rest } = overrides;
  return {
    orderId: "order-1",
    companyId: "company-1",
    rucIssuer: "20123456789",
    taxDocumentType: "03",
    series: "B001",
    correlative: "00000001",
    issueDate: "2026-11-10",
    cdrStatus: "ACCEPTED",
    sunatCode: null,
    sunatDescription: null,
    observations: null,
    signedXmlStoragePath: null,
    cdrStoragePath: null,
    digestValue: null,
    taxDocumentPayload: { totals: { grandTotal: total }, items: [] } as never,
    referenceDocumentId: null,
    createdAt: "2026-11-10T10:00:00Z",
    updatedAt: "2026-11-10T10:00:00Z",
    ...rest,
  } as SunatDocument;
}

describe("findActiveTaxDocument", () => {
  it("sin documentos no hay comprobante vigente", () => {
    expect(findActiveTaxDocument([])).toBeNull();
  });

  it.each(["ACCEPTED", "ACCEPTED_WITH_OBSERVATION", "PENDING"] as const)(
    "una boleta %s es vigente",
    (cdrStatus) => {
      expect(findActiveTaxDocument([doc({ id: "b1", cdrStatus })])?.id).toBe("b1");
    },
  );

  it.each(["REJECTED", "RETRY_EXCEEDED"] as const)("una boleta %s no es vigente", (cdrStatus) => {
    expect(findActiveTaxDocument([doc({ id: "b1", cdrStatus })])).toBeNull();
  });

  it("una factura aceptada es vigente", () => {
    expect(findActiveTaxDocument([doc({ id: "f1", taxDocumentType: "01" })])?.id).toBe("f1");
  });

  it("una nota de crédito por el total deja de avisar; una parcial sigue avisando", () => {
    const receipt = doc({ id: "b1", total: 120 });
    const full = doc({ id: "n1", taxDocumentType: "07", total: 120, referenceDocumentId: "b1" });
    const partial = doc({ id: "n2", taxDocumentType: "07", total: 20, referenceDocumentId: "b1" });

    expect(findActiveTaxDocument([receipt, full])).toBeNull();
    expect(findActiveTaxDocument([receipt, partial])?.id).toBe("b1");
  });

  it("una nota de crédito rechazada no cuenta", () => {
    const receipt = doc({ id: "b1", total: 120 });
    const note = doc({
      id: "n1",
      taxDocumentType: "07",
      total: 120,
      cdrStatus: "REJECTED",
      referenceDocumentId: "b1",
    });

    expect(findActiveTaxDocument([receipt, note])?.id).toBe("b1");
  });
});
