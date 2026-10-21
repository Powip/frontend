import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type {
  CommercialLeadReport,
  CommercialCashReport,
  CommercialCashReportParams,
  CommercialLeadReportParams,
} from "@/types/commercialLeadReports";

export async function getCommercialLeadReport(
  params: CommercialLeadReportParams,
  signal?: AbortSignal,
): Promise<CommercialLeadReport> {
  return (
    await axiosAuth.get<CommercialLeadReport>(
      `${GATEWAY.ventas}/leads/reports/summary`,
      { params, signal },
    )
  ).data;
}

/** CSV cells are quoted and neutralize spreadsheet formulas in configurable names. */
export function leadReportCsv(report: CommercialLeadReport): string {
  const cell = (value: unknown) => {
    const raw = String(value ?? "");
    const safe = /^[\s]*[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const rows: unknown[][] = [
    [
      "Reporte de Leads",
      report.period.fromDate,
      report.period.toDate,
      report.period.timeZone,
    ],
    [
      "Cohorte",
      "Recibidos en el periodo; estado actual. Web prepago separado del embudo humano",
    ],
    [
      "Tipo",
      "Nombre",
      "Registros recibidos",
      "Leads gestionables",
      "Abiertos",
      "Perdidos",
      "Convertidos vendedor",
      "Web prepago",
      "Verificados históricos",
      "Conversión gestión %",
    ],
    ...report.byType.map((t) => [
      t.typeCode,
      t.name,
      t.received,
      t.pipelineReceived,
      t.open,
      t.lost,
      t.sellerConverted,
      t.webPrepaidConverted,
      t.legacyConverted,
      t.pipelineConversionRate,
    ]),
    [],
    [
      "Moneda",
      "Importe estimado de recibidos",
      "Importe estimado de convertidos",
    ],
    ...report.amountsByCurrency.map((m) => [
      m.currency,
      m.estimatedAmount,
      m.convertedEstimatedAmount,
    ]),
    [],
    [
      "Vendedor asignado",
      "Leads gestionables",
      "Abiertos",
      "Perdidos",
      "Conversiones vendedor",
    ],
    ...report.bySeller.map((row) => [
      row.sellerId ?? "Sin asignar",
      row.pipelineReceived,
      row.open,
      row.lost,
      row.sellerConverted,
    ]),
    [],
    [
      "Confirmador real",
      "Base de confirmación",
      "Confirmaciones en el periodo",
    ],
    ...report.byConfirmer.map((row) => [
      row.confirmerId ?? "Sin actor humano",
      row.basis,
      row.count,
    ]),
    [],
    ["Fecha Lima", "Recibidos en el día", "Primera confirmación en el día"],
    ...report.daily.map((row) => [row.date, row.received, row.converted]),
    [],
    [
      "Confirmados en el periodo (primera fecha)",
      report.confirmedInPeriod.count,
    ],
    [
      "Convertidos sin fecha en todo el alcance",
      report.confirmedInPeriod.withoutDate,
    ],
    [
      "Pedidos históricos sin clasificación en el periodo",
      report.coverage.legacyUnclassifiedOrders,
    ],
  ];
  return "\ufeff" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

export async function getCommercialCashReport(
  params: CommercialCashReportParams,
  signal?: AbortSignal,
): Promise<CommercialCashReport> {
  return (
    await axiosAuth.get<CommercialCashReport>(
      `${GATEWAY.ventas}/leads/reports/cash`,
      { params, signal },
    )
  ).data;
}
