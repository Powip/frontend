"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getLeadPaymentCapabilities } from "@/services/leadPaymentsService";
import { getCommercialCashReport } from "@/services/commercialLeadReportsService";
import type {
  CommercialCashReport,
  CommercialCashReportParams,
} from "@/types/commercialLeadReports";
import { reportCurrencyLabel } from "./ReportCurrencySelector";

type Result = {
  key: string;
  state: "loading" | "disabled" | "forbidden" | "error" | "ready";
  report?: CommercialCashReport;
};
/** Uses the complete server aggregate, independently of ledger pagination. */
export function CommercialCashSummary({
  params,
}: {
  params: CommercialCashReportParams;
}) {
  const { auth } = useAuth();
  const [result, setResult] = useState<Result>();
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([
    auth?.company?.id,
    auth?.user?.id,
    auth?.user?.role,
    auth?.user?.permissions,
    params,
    revision,
  ]);
  const canView = auth?.user?.permissions?.includes("VIEW_FINANCES");
  useEffect(() => {
    if (
      !auth?.accessToken ||
      !canView ||
      (!params.storeId && !params.storeIds && !params.includeUnassignedStore)
    )
      return;
    const abort = new AbortController();
    setResult({ key, state: "loading" });
    void getLeadPaymentCapabilities()
      .then(async (caps) => {
        if (abort.signal.aborted) return;
        if (!caps.enabled) {
          setResult({ key, state: "disabled" });
          return;
        }
        if (!caps.canReview) {
          setResult({ key, state: "forbidden" });
          return;
        }
        const report = await getCommercialCashReport(params, abort.signal);
        if (!abort.signal.aborted) setResult({ key, state: "ready", report });
      })
      .catch(() => {
        if (!abort.signal.aborted) setResult({ key, state: "error" });
      });
    return () => abort.abort();
  }, [key, auth?.accessToken, canView]);
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
  if (!canView) return null;
  const visible = result?.key === key ? result : undefined;
  if (visible?.state === "disabled")
    return (
      <p role="status" className="text-sm text-muted-foreground">
        La caja integral de Leads está deshabilitada. Los cuadros de cobros con
        pedido no incluyen anticipos sin pedido.
      </p>
    );
  if (visible?.state === "forbidden")
    return <p role="status">No tienes acceso a la caja integral.</p>;
  if (visible?.state === "error")
    return (
      <div role="alert" className="rounded-lg border p-4">
        No se pudo cargar la caja integral.{" "}
        <button
          className="underline"
          onClick={() => setRevision((value) => value + 1)}
        >
          Reintentar
        </button>
      </div>
    );
  if (!visible?.report) return <p role="status">Cargando caja integral…</p>;
  const report = visible.report;
  return (
    <section
      aria-label="Caja integral"
      className="space-y-3 rounded-xl border bg-card p-5"
    >
      <h3 className="font-semibold">
        Caja integral: ventas y anticipos de Leads
      </h3>
      <p className="text-sm text-muted-foreground">
        Por fecha del pago, {report.period.fromDate} a {report.period.toDate}{" "}
        (Lima). Cada pago se cuenta una sola vez al convertir un Lead en venta.
        Incluye todos los vendedores del alcance seleccionado.
      </p>
      {report.totalsByCurrency.length === 0 ? (
        <p>No hay pagos en este alcance.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left">Moneda</th>
                <th className="p-2 text-right">Aprobado</th>
                <th className="p-2 text-right">Pendiente</th>
                <th className="p-2 text-right">Perdido</th>
                <th className="p-2 text-right">Aprobado sin pedido</th>
              </tr>
            </thead>
            <tbody>
              {report.totalsByCurrency.map((row) => (
                <tr key={row.currency ?? "UNKNOWN"}>
                  <th className="p-2 text-left">
                    {row.currency ?? "Sin moneda registrada"}
                  </th>
                  {[
                    row.paidAmount,
                    row.pendingAmount,
                    row.lostAmount,
                    row.withoutOrderPaidAmount,
                  ].map((amount, index) => (
                    <td key={index} className="p-2 text-right tabular-nums">
                      {reportCurrencyLabel(row.currency ?? "UNKNOWN")} {amount}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {report.coverage.paymentCount} pagos;{" "}
        {report.coverage.withoutOrderCount} sin pedido;{" "}
        {report.coverage.unknownCurrencyCount} sin moneda registrada. No se
        suman monedas diferentes.
      </p>
      <details>
        <summary className="cursor-pointer text-sm">
          Cobros aprobados por día y moneda
        </summary>
        <ul className="mt-2 space-y-1 text-sm">
          {report.dailyByCurrency.map((row) => (
            <li key={row.date + (row.currency ?? "UNKNOWN")}>
              {row.date} · {row.currency ?? "Sin moneda registrada"} ·{" "}
              {row.paidAmount} aprobado ({row.paymentCount} pagos)
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
