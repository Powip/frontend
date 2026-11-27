import type { SunatDocument } from "../../models/sunat-document.model";
import type { TaxDocumentRow } from "../../types/tax-document-row";
import { findActiveTaxDocument } from "../find-active-tax-document";
import { expandPrepaymentRows, reportAmountsOf } from "../prepayment-report";
import {
  findOpenPrepayments,
  isDocumentInForce,
  prepaidAmountOf,
  prepaymentTaxTypeFor,
  toPrepaymentDocument,
} from "../prepayments";
import { computeTaxDocumentKpis } from "../tax-document-kpis";

function doc(
  overrides: Partial<SunatDocument> & {
    id: string;
    total?: number;
    base?: number;
    isPrepayment?: boolean;
    deducts?: string[];
  },
): SunatDocument {
  const { total = 100, base, isPrepayment, deducts, ...rest } = overrides;
  return {
    orderId: "order-1",
    companyId: "company-1",
    rucIssuer: "20123456789",
    taxDocumentType: "03",
    series: "B001",
    correlative: "00000001",
    issueDate: "2026-11-10",
    cdrStatus: "ACCEPTED",
    taxDocumentPayload: {
      totals: {
        currency: "PEN",
        subtotal: base ?? total / 1.18,
        taxTotal: total - (base ?? total / 1.18),
        grandTotal: total,
      },
      items: [],
      ...(isPrepayment ? { isPrepayment: true } : {}),
      ...(deducts ? { prepayments: deducts.map((documentId) => ({ documentId })) } : {}),
    } as never,
    referenceDocumentId: null,
    createdAt: "2026-11-10T10:00:00Z",
    updatedAt: "2026-11-10T10:00:00Z",
    ...rest,
  } as SunatDocument;
}

const creditNote = (id: string, referenceDocumentId: string, total: number) =>
  doc({ id, taxDocumentType: "07", referenceDocumentId, total });

describe("anticipos abiertos", () => {
  it("un anticipo aceptado sin final está abierto", () => {
    const anticipo = doc({ id: "a1", isPrepayment: true, total: 118 });
    expect(findOpenPrepayments([anticipo])).toEqual([anticipo]);
  });

  it("un anticipo descontado por un final vigente ya no está abierto", () => {
    const anticipo = doc({ id: "a1", isPrepayment: true, total: 118 });
    const final = doc({ id: "f1", total: 236, deducts: ["a1"] });
    expect(findOpenPrepayments([anticipo, final])).toEqual([]);
  });

  it("si el final se anula con nota de crédito, el anticipo vuelve a estar abierto", () => {
    const anticipo = doc({ id: "a1", isPrepayment: true, total: 118 });
    const final = doc({ id: "f1", total: 236, deducts: ["a1"] });
    const nota = creditNote("n1", "f1", 236);
    expect(findOpenPrepayments([anticipo, final, nota])).toEqual([anticipo]);
  });

  it("un anticipo con nota de crédito o rechazado no se descuenta", () => {
    const anulado = doc({ id: "a1", isPrepayment: true, total: 118 });
    const rechazado = doc({ id: "a2", isPrepayment: true, cdrStatus: "REJECTED" });
    expect(findOpenPrepayments([anulado, creditNote("n1", "a1", 118), rechazado])).toEqual([]);
  });

  it("un final pagado entero con anticipos (total 0) sigue vigente hasta que lo anulen", () => {
    const final = doc({ id: "f1", total: 0, deducts: ["a1"] });
    expect(isDocumentInForce(final, [final])).toBe(true);
    expect(isDocumentInForce(final, [final, creditNote("n1", "f1", 0)])).toBe(false);
  });

  it("el comprobante vigente del pedido nunca es un anticipo", () => {
    const anticipo = doc({ id: "a1", isPrepayment: true, total: 118 });
    expect(findActiveTaxDocument([anticipo])).toBeNull();
    const final = doc({ id: "f1", total: 236, deducts: ["a1"] });
    expect(findActiveTaxDocument([anticipo, final])?.id).toBe("f1");
  });

  it("suma lo ya pagado con anticipos", () => {
    expect(prepaidAmountOf([doc({ id: "a1", total: 118 }), doc({ id: "a2", total: 59.5 })])).toBe(
      177.5,
    );
  });
});

describe("documento del anticipo", () => {
  const base = {
    orderId: "order-1",
    taxDocumentType: "03",
    series: "B001",
    items: [
      { sku: "X", productName: "Polo", quantity: 2, unitPrice: 100, subtotal: 200, taxType: "10" },
    ],
    totals: { currency: "PEN", subtotal: 200, taxTotal: 36, grandTotal: 236 },
  } as never;

  it("gravado: una línea con base sin IGV y el IGV incluido en el monto", () => {
    const anticipo = toPrepaymentDocument(base, {
      amount: 100,
      orderNumber: "ORD-1",
      taxType: "10",
    });
    expect(anticipo.isPrepayment).toBe(true);
    expect(anticipo.items).toHaveLength(1);
    expect(anticipo.items[0]).toMatchObject({
      productName: "Anticipo del pedido ORD-1",
      subtotal: 84.75,
      taxType: "10",
    });
    expect(anticipo.totals).toMatchObject({ subtotal: 84.75, taxTotal: 15.25, grandTotal: 100 });
  });

  it("exonerado o Nuevo RUS: sin IGV", () => {
    const anticipo = toPrepaymentDocument(base, { amount: 100, taxType: "20" });
    expect(anticipo.totals).toMatchObject({ subtotal: 100, taxTotal: 0, grandTotal: 100 });
  });

  it("toma la afectación de las líneas cobradas, no de los regalos", () => {
    expect(prepaymentTaxTypeFor([{ taxType: "31" }, { taxType: "20" }] as never)).toBe("20");
    expect(prepaymentTaxTypeFor([])).toBe("10");
  });
});

describe("libros e indicadores sin doble conteo", () => {
  const anticipo = doc({
    id: "a1",
    isPrepayment: true,
    total: 118,
    base: 100,
    series: "B001",
    correlative: "00000007",
    createdAt: "2026-11-10T10:00:00",
  });
  const final = doc({
    id: "f1",
    total: 236,
    base: 200,
    deducts: ["a1"],
    correlative: "00000008",
    createdAt: "2026-11-12T10:00:00",
  });
  const row = {
    sale: { id: "order-1", grandTotal: 354, createdAt: "2026-11-10T10:00:00" },
    taxDocument: final,
    prepayments: [anticipo],
  } as unknown as TaxDocumentRow;

  it("el registro de ventas lista el anticipo y el final por separado; suman la venta una vez", () => {
    const lines = expandPrepaymentRows([row]);
    expect(lines.map((line) => line.taxDocument?.id)).toEqual(["a1", "f1"]);
    const amounts = lines.map(reportAmountsOf);
    expect(amounts.map((amount) => amount.total)).toEqual([118, 236]);
    expect(amounts.reduce((sum, amount) => sum + amount.total, 0)).toBe(354);
    expect(amounts[0]).toMatchObject({ baseImponible: 100, igv: 18 });
  });

  it("facturado del mes cuenta la venta una vez", () => {
    const kpis = computeTaxDocumentKpis([row], new Date("2026-11-15T15:00:00"));
    expect(kpis.facturadoMes).toBe(354);
  });
});
