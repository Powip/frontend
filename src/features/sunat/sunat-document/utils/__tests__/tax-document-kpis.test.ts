import type { TaxDocumentRow } from "../../types/tax-document-row";
import { computeTaxDocumentKpis, filterRowsByIssuerRuc } from "../tax-document-kpis";

const NOW = new Date("2026-11-15T15:00:00");
const A = "20111111111";
const B = "20222222222";

function row(
  id: string,
  document?: { ruc: string; status: string; total: number; createdAt?: string },
): TaxDocumentRow {
  return {
    sale: { id, grandTotal: document?.total ?? 50 },
    ...(document
      ? {
          taxDocument: {
            id: `doc-${id}`,
            rucIssuer: document.ruc,
            cdrStatus: document.status,
            createdAt: document.createdAt ?? "2026-11-15T10:00:00",
            taxDocumentPayload: { totals: { grandTotal: document.total } },
          },
        }
      : {}),
  } as unknown as TaxDocumentRow;
}

const rows = [
  row("1", { ruc: A, status: "ACCEPTED", total: 158 }),
  row("2", { ruc: B, status: "ACCEPTED", total: 122.1 }),
  row("3", { ruc: B, status: "REJECTED", total: 99 }),
  row("4", { ruc: B, status: "ACCEPTED", total: 40, createdAt: "2026-11-02T10:00:00" }),
  row("5"),
  row("6"),
];

describe("filterRowsByIssuerRuc", () => {
  it("sin RUC devuelve todas las filas", () => {
    expect(filterRowsByIssuerRuc(rows, undefined)).toHaveLength(6);
  });

  it("deja los comprobantes de ese RUC y las ventas aún sin comprobante", () => {
    const ids = filterRowsByIssuerRuc(rows, B).map((item) => item.sale.id);

    expect(ids).toEqual(["2", "3", "4", "5", "6"]);
  });
});

describe("computeTaxDocumentKpis", () => {
  it("con todos los RUC suma todo", () => {
    expect(computeTaxDocumentKpis(rows, NOW)).toEqual({
      emitidosHoy: 2,
      pendientes: 2,
      rechazados: 1,
      facturadoMes: 158 + 122.1 + 40,
    });
  });

  it("con un RUC filtrado no mezcla lo facturado ni lo rechazado por otro RUC", () => {
    expect(computeTaxDocumentKpis(filterRowsByIssuerRuc(rows, A), NOW)).toEqual({
      emitidosHoy: 1,
      pendientes: 2,
      rechazados: 0,
      facturadoMes: 158,
    });
    expect(computeTaxDocumentKpis(filterRowsByIssuerRuc(rows, B), NOW)).toEqual({
      emitidosHoy: 1,
      pendientes: 2,
      rechazados: 1,
      facturadoMes: 122.1 + 40,
    });
  });
});
