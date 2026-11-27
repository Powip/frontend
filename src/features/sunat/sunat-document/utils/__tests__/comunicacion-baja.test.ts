import type { SunatDocument } from "../../models/sunat-document.model";
import { getCreditableBalance } from "../build-credit-note-request";
import { countsAsIssued } from "../counts-as-issued";
import { findActiveTaxDocument } from "../find-active-tax-document";
import { formatVoidDeadline, getVoidStatusBadge } from "../void-status";

/** Caso AMA: factura F002-00000048 de S/ 250.32 con tres NC de S/ 83.44 (417, 418, 419). */
function invoice(): SunatDocument {
  return {
    id: "f48",
    orderId: "order-ama",
    companyId: "ama",
    rucIssuer: "20601234567",
    taxDocumentType: "01",
    series: "F002",
    correlative: "00000048",
    issueDate: "2026-11-20",
    cdrStatus: "ACCEPTED",
    sunatCode: "0",
    sunatDescription: null,
    observations: null,
    signedXmlStoragePath: null,
    cdrStoragePath: null,
    digestValue: null,
    referenceDocumentId: null,
    voidStatus: null,
    voidReason: null,
    voidRequestedAt: null,
    voidTicket: null,
    voidSunatCode: null,
    voidSunatDescription: null,
    voidedAt: null,
    voidDeadline: "2026-11-27",
    voidable: false,
    createdAt: "2026-11-20T10:00:00Z",
    updatedAt: "2026-11-20T10:00:00Z",
    taxDocumentPayload: {
      totals: {
        currency: "PEN",
        subtotal: 212.14,
        discountTotal: 0,
        shippingTotal: 0,
        taxTotal: 38.18,
        grandTotal: 250.32,
      },
      items: [],
    },
  };
}

function note(correlative: string, overrides: Partial<SunatDocument> = {}): SunatDocument {
  const base = invoice();
  return {
    ...base,
    id: `n${correlative}`,
    taxDocumentType: "07",
    series: "FC01",
    correlative: `00000${correlative}`,
    issueDate: "2026-11-27",
    referenceDocumentId: "f48",
    voidDeadline: "2026-12-04",
    voidable: true,
    taxDocumentPayload: {
      ...base.taxDocumentPayload,
      totals: { ...base.taxDocumentPayload.totals, grandTotal: 83.44 },
    },
    ...overrides,
  };
}

const voided = { voidStatus: "VOIDED" as const, voidable: false };

describe("comunicación de baja: saldo de la factura", () => {
  it("con las 3 NC vivas la factura queda sin saldo y no está vigente", () => {
    const documents = [invoice(), note("417"), note("418"), note("419")];

    expect(getCreditableBalance(invoice(), documents)).toBe(0);
    expect(findActiveTaxDocument(documents)).toBeNull();
  });

  it("caso AMA: con 418 y 419 de baja solo cuenta la 417 (saldo 166.88) y la factura sigue vigente", () => {
    const documents = [invoice(), note("417"), note("418", voided), note("419", voided)];

    expect(getCreditableBalance(invoice(), documents)).toBe(166.88);
    expect(findActiveTaxDocument(documents)?.id).toBe("f48");
  });

  it("baja en proceso o rechazada: la NC sigue contando hasta que SUNAT acepta la baja", () => {
    const documents = [
      invoice(),
      note("417"),
      note("418", { voidStatus: "IN_PROCESS", voidable: false }),
      note("419", { voidStatus: "REJECTED" }),
    ];

    expect(getCreditableBalance(invoice(), documents)).toBe(0);
  });

  it("una factura de baja ya no está vigente", () => {
    expect(findActiveTaxDocument([{ ...invoice(), ...voided }])).toBeNull();
  });

  it("countsAsIssued: aceptado o pendiente cuentan; rechazado o de baja, no", () => {
    expect(countsAsIssued({ cdrStatus: "ACCEPTED", voidStatus: null })).toBe(true);
    expect(countsAsIssued({ cdrStatus: "PENDING", voidStatus: null })).toBe(true);
    expect(countsAsIssued({ cdrStatus: "REJECTED", voidStatus: null })).toBe(false);
    expect(countsAsIssued({ cdrStatus: "ACCEPTED", voidStatus: "VOIDED" })).toBe(false);
  });
});

describe("comunicación de baja: etiquetas", () => {
  it("sin pedido de baja no muestra etiqueta", () => {
    expect(getVoidStatusBadge(note("418"))).toBeNull();
  });

  it("en proceso, de baja y rechazada (con el mensaje de SUNAT)", () => {
    expect(getVoidStatusBadge(note("418", { voidStatus: "IN_PROCESS" }))?.label).toBe(
      "Baja en proceso",
    );
    expect(getVoidStatusBadge(note("418", voided))?.label).toBe("De baja");

    const rejected = getVoidStatusBadge(
      note("418", {
        voidStatus: "REJECTED",
        voidSunatCode: "2398",
        voidSunatDescription: "El documento no puede ser dado de baja",
      }),
    );
    expect(rejected?.label).toBe("Baja rechazada");
    expect(rejected?.detalle).toBe("2398 · El documento no puede ser dado de baja");
  });

  it("fecha límite en formato peruano", () => {
    expect(formatVoidDeadline("2026-12-04")).toBe("04/12/2026");
  });
});
