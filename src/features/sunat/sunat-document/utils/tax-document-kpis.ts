import type { TaxDocumentRow } from "../types/tax-document-row";

export interface TaxDocumentKpis {
  emitidosHoy: number;
  pendientes: number;
  rechazados: number;
  facturadoMes: number;
}

function isAccepted(row: TaxDocumentRow): boolean {
  const status = row.taxDocument?.cdrStatus;

  return status === "ACCEPTED" || status === "ACCEPTED_WITH_OBSERVATION";
}

/**
 * Rows that belong to one issuer RUC. Sales without a document have no
 * issuer yet (any RUC can still bill them), so they are kept.
 */
export function filterRowsByIssuerRuc(
  rows: TaxDocumentRow[],
  issuerRuc: string | undefined,
): TaxDocumentRow[] {
  if (!issuerRuc) {
    return rows;
  }

  return rows.filter((row) => !row.taxDocument || row.taxDocument.rucIssuer === issuerRuc);
}

/**
 * KPI calculations intentionally use the SUNAT document itself as the
 * source of truth.
 */
export function computeTaxDocumentKpis(rows: TaxDocumentRow[], now = new Date()): TaxDocumentKpis {
  const isSameMonth = (date: Date) =>
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();

  const acceptedThisMonth = rows.filter(
    (row) => isAccepted(row) && row.taxDocument && isSameMonth(new Date(row.taxDocument.createdAt)),
  );

  const emitidosHoy = acceptedThisMonth.filter(
    (row) => row.taxDocument && new Date(row.taxDocument.createdAt).getDate() === now.getDate(),
  ).length;

  const pendientes = rows.filter((row) => !row.taxDocument).length;

  const rechazados = rows.filter((row) => {
    const status = row.taxDocument?.cdrStatus;

    return status === "REJECTED" || status === "RETRY_EXCEEDED";
  }).length;

  const facturadoMes = acceptedThisMonth.reduce((total, row) => {
    const documentTotal = row.taxDocument?.taxDocumentPayload.totals.grandTotal;

    return total + Number(documentTotal ?? row.sale.grandTotal);
  }, 0);

  // Anticipos are billed when issued. The final comprobante stores its total
  // net of them, so adding both counts the sale once.
  const prepaidMes = rows
    .flatMap((row) => row.prepayments ?? [])
    .filter(
      (document) =>
        (document.cdrStatus === "ACCEPTED" || document.cdrStatus === "ACCEPTED_WITH_OBSERVATION") &&
        isSameMonth(new Date(document.createdAt)),
    )
    .reduce((total, document) => total + Number(document.taxDocumentPayload.totals.grandTotal), 0);

  return { emitidosHoy, pendientes, rechazados, facturadoMes: facturadoMes + prepaidMes };
}
