"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardScope } from "@/contexts/DashboardScopeContext";
import {
  commercialLeadError,
  getCommercialLeadCapabilities,
  listCommercialLeadTypes,
} from "@/services/commercialLeadsService";
import {
  getCommercialLeadReport,
  leadReportCsv,
} from "@/services/commercialLeadReportsService";
import type { CommercialLeadReport } from "@/types/commercialLeadReports";
import type { LeadType } from "@/types/leads";

const todayInPeru = () =>
  new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const money = (value: string, currency: string) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(
    Number(value),
  );

type ReportState = {
  key: string;
  data?: CommercialLeadReport;
  types?: LeadType[];
  error?: string;
  unavailable?: string;
};

export default function CommercialLeadsMetricsPage() {
  const { auth } = useAuth();
  const { scope, storeIds, canFetch } = useDashboardScope();
  const [fromDate, setFromDate] = useState(
    () => todayInPeru().slice(0, 8) + "01",
  );
  const [toDate, setToDate] = useState(todayInPeru);
  const [typeCode, setTypeCode] = useState("");
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<ReportState | null>(null);
  const key = JSON.stringify([
    auth?.company?.id,
    auth?.user?.id,
    auth?.user?.role,
    auth?.user?.permissions,
    storeIds,
    scope,
    fromDate,
    toDate,
    typeCode,
    revision,
  ]);
  const visible = state?.key === key ? state : null;
  const reportScopeReady =
    canFetch ||
    (scope === "business" &&
      Boolean(auth?.accessToken && auth?.user?.id && auth?.company?.id));
  const validDates = Boolean(fromDate && toDate && fromDate <= toDate);
  const data = visible?.data;

  useEffect(() => {
    if (!reportScopeReady || !validDates) return;
    const abort = new AbortController();
    let active = true;
    async function load() {
      try {
        const caps = await getCommercialLeadCapabilities();
        if (!active) return;
        if (!caps.enabled || !caps.canView) {
          setState({
            key,
            unavailable: !caps.enabled
              ? "La gestión comercial de Leads todavía no está habilitada."
              : "No tienes permiso para consultar los reportes de Leads.",
          });
          return;
        }
        const [report, types] = await Promise.all([
          getCommercialLeadReport(
            {
              storeIds: storeIds.join(","),
              includeUnassignedStore: scope === "business",
              fromDate,
              toDate,
              ...(typeCode ? { typeCode } : {}),
            },
            abort.signal,
          ),
          listCommercialLeadTypes(),
        ]);
        if (active) setState({ key, data: report, types });
      } catch (error) {
        if (active && !abort.signal.aborted)
          setState({ key, error: commercialLeadError(error) });
      }
    }
    void load();
    return () => {
      active = false;
      abort.abort();
    };
  }, [
    key,
    reportScopeReady,
    validDates,
    storeIds,
    scope,
    fromDate,
    toDate,
    typeCode,
  ]);

  useEffect(() => {
    const refresh = (event: Event) => {
      if (
        auth?.company?.id &&
        (event as CustomEvent<{ companyId: string }>).detail?.companyId ===
          auth.company.id
      )
        setRevision((value) => value + 1);
    };
    window.addEventListener("commercial-leads:changed", refresh);
    return () =>
      window.removeEventListener("commercial-leads:changed", refresh);
  }, [auth?.company?.id, auth?.user?.id]);

  function exportCsv() {
    if (!data) return;
    const url = URL.createObjectURL(
      new Blob([leadReportCsv(data)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `leads-${data.period.fromDate}-${data.period.toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reporte de Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Oportunidades comerciales, ventas confirmadas y web con prepago.
          </p>
        </div>
        <Link
          href="/leads-comerciales"
          className="rounded-md border px-3 py-2 text-sm"
        >
          Abrir bandeja de Leads
        </Link>
      </div>
      <form
        className="flex flex-wrap items-end gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setRevision((value) => value + 1);
        }}
      >
        <label className="grid gap-1 text-sm">
          Desde
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="rounded-md border bg-background px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Hasta
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="rounded-md border bg-background px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Tipo de lead
          <select
            value={typeCode}
            onChange={(event) => setTypeCode(event.target.value)}
            className="rounded-md border bg-background px-3 py-2"
          >
            <option value="">Todos los tipos</option>
            {(visible?.types ?? data?.byType ?? []).map((type) => {
              const code = "code" in type ? type.code : type.typeCode;
              return (
                <option key={code} value={code}>
                  {type.name}
                  {!type.active ? " (inactivo)" : ""}
                </option>
              );
            })}
          </select>
        </label>
        <button type="submit" className="rounded-md border px-3 py-2 text-sm">
          Actualizar
        </button>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!data}
          className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
        >
          Exportar CSV
        </button>
      </form>
      {!validDates ? (
        <p role="alert">Selecciona un rango de fechas válido.</p>
      ) : null}
      {visible?.unavailable ? (
        <p role="status" className="rounded-lg border p-4">
          {visible.unavailable}
        </p>
      ) : null}
      {visible?.error ? (
        <div role="alert" className="rounded-lg border p-4">
          <p>{visible.error}</p>
          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
            className="mt-2 underline"
          >
            Reintentar
          </button>
        </div>
      ) : null}
      {canFetch && validDates && !visible ? (
        <p role="status">Cargando reporte…</p>
      ) : null}
      {data ? (
        <>
          <p className="text-sm text-muted-foreground">
            Cohorte recibida del {data.period.fromDate} al {data.period.toDate},
            hora de Lima. Muestra su estado actual; la web con prepago se separa
            del embudo de gestión.{" "}
            {data.scope.includeUnassignedStore
              ? "Incluye oportunidades sin tienda asignada."
              : "Sólo incluye las tiendas seleccionadas."}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {[
              ["Leads gestionables", data.totals.pipelineReceived],
              ["Abiertos", data.totals.open],
              ["Perdidos", data.totals.lost],
              ["Confirmados por vendedor", data.totals.sellerConverted],
              ["Web prepago", data.totals.webPrepaidConverted],
              [
                "Conversión de gestión",
                `${data.totals.pipelineConversionRate}%`,
              ],
            ].map(([label, value]) => (
              <section className="rounded-lg border p-4" key={label}>
                <h2 className="text-sm text-muted-foreground">{label}</h2>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
              </section>
            ))}
          </div>
          <section className="space-y-3">
            <h2 className="font-semibold">Todos los tipos de lead</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {[
                      "Tipo",
                      "Registros recibidos",
                      "Leads gestionables",
                      "Abiertos",
                      "Perdidos",
                      "Vendedor",
                      "Web prepago",
                      "Históricos verificados",
                      "Conversión gestión",
                    ].map((label) => (
                      <th key={label} className="border-b p-2 text-left">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.byType.map((type) => (
                    <tr key={type.typeCode}>
                      <th
                        scope="row"
                        className="border-b p-2 text-left font-normal"
                      >
                        {type.name}
                        <span className="block text-xs text-muted-foreground">
                          {type.typeCode}
                          {!type.active ? " · Inactivo" : ""}
                        </span>
                      </th>
                      {[
                        type.received,
                        type.pipelineReceived,
                        type.open,
                        type.lost,
                        type.sellerConverted,
                        type.webPrepaidConverted,
                        type.legacyConverted,
                        `${type.pipelineConversionRate}%`,
                      ].map((value, index) => (
                        <td key={index} className="border-b p-2">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.totals.received === 0 ? (
              <p>No hay oportunidades recibidas en este periodo.</p>
            ) : null}
          </section>
          <section className="space-y-3">
            <h2 className="font-semibold">Importes estimados por moneda</h2>
            <p className="text-sm text-muted-foreground">
              Estimaciones de las oportunidades recibidas; no son ingresos de
              caja. Los pagos y anticipos se consultan en Finanzas.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {data.amountsByCurrency.map((row) => (
                <div className="rounded-lg border p-4" key={row.currency}>
                  <h3>{row.currency}</h3>
                  <p>Recibidos: {money(row.estimatedAmount, row.currency)}</p>
                  <p>
                    Convertidos:{" "}
                    {money(row.convertedEstimatedAmount, row.currency)}
                  </p>
                </div>
              ))}
            </div>
            {data.coverage.unknownCurrencyRecords > 0 ? (
              <p className="text-sm">
                {data.coverage.unknownCurrencyRecords} registros sin moneda; no
                se les asigna un importe en otra moneda.
              </p>
            ) : null}
          </section>
          <section className="space-y-3">
            <h2 className="font-semibold">
              Primera confirmación dentro del periodo
            </h2>
            <p>
              {data.confirmedInPeriod.count} confirmaciones:{" "}
              {data.confirmedInPeriod.seller} de vendedor,{" "}
              {data.confirmedInPeriod.webPrepaid} de web prepago y{" "}
              {data.confirmedInPeriod.legacy} históricas verificadas.
            </p>
            <p className="text-sm text-muted-foreground">
              Este conteo usa la primera confirmación de compra y puede incluir
              oportunidades recibidas antes del periodo. No usa la fecha de
              edición, pago o despacho.
            </p>
            <p className="text-sm">
              {data.confirmedInPeriod.withoutDate} conversiones sin fecha
              conocida en todo el alcance. No se asignan a un día del periodo.
            </p>
          </section>
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer font-semibold">
              Evolución diaria y confirmadores
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="mb-2 text-left">
                  Recibidos y primeras confirmaciones, por fecha de Lima
                </caption>
                <thead>
                  <tr>
                    <th className="p-2 text-left">Fecha</th>
                    <th className="p-2 text-left">Recibidos</th>
                    <th className="p-2 text-left">Confirmados</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((row) => (
                    <tr key={row.date}>
                      <th scope="row" className="p-2 text-left font-normal">
                        {row.date}
                      </th>
                      <td className="p-2">{row.received}</td>
                      <td className="p-2">{row.converted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="mt-4 font-medium">
              Quién confirmó dentro del periodo
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {data.byConfirmer.map((row) => (
                <li key={`${row.confirmerId}-${row.basis}`}>
                  {row.confirmerId ??
                    (row.basis === "WEB_PREPAID"
                      ? "Web prepago automático"
                      : "Confirmador desconocido")}
                  : {row.count} ·{" "}
                  {row.basis === "SELLER"
                    ? "Vendedor"
                    : row.basis === "WEB_PREPAID"
                      ? "Web prepago"
                      : "Histórico verificado"}
                </li>
              ))}
            </ul>
          </details>
          <section className="space-y-3">
            <h2 className="font-semibold">
              Distribución por vendedor asignado
            </h2>
            <p className="text-sm text-muted-foreground">
              La asignación actual no identifica a la persona que confirmó la
              compra.
            </p>
            <ul className="space-y-1 text-sm">
              {data.bySeller.map((row) => (
                <li key={row.sellerId ?? "unassigned"}>
                  {row.sellerId ?? "Sin asignar"}: {row.pipelineReceived} Leads
                  gestionables · {row.sellerConverted} confirmados por vendedor
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-lg border p-4 text-sm">
            <h2 className="font-semibold">Cobertura de pedidos históricos</h2>
            <p>
              {data.coverage.classifiedOrders} pedidos con clasificación y{" "}
              {data.coverage.legacyUnclassifiedOrders} históricos sin
              clasificación, creados en el periodo y en las tiendas
              seleccionadas. Esta cobertura no aplica el filtro de
              tipo/vendedor. Los históricos conservan su tratamiento anterior;
              no se reclasifican desde el reporte.
            </p>
          </section>
        </>
      ) : null}
    </main>
  );
}
