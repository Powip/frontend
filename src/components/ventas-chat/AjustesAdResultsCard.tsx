"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { useAdResults, useMetaAdAccounts, useMetaAdsSettings } from "@/hooks/useCrmMetaAds";
import { NATIVE_SELECT_CLASS } from "./format";

/** YYYY-MM-DD in Lima time, `daysAgo` days before today. */
export function limaDay(daysAgo = 0, now: Date = new Date()): string {
  const d = new Date(now.getTime() - daysAgo * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Lima" });
}

const fmtMoney = (value: number | null, currency: string | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("es-PE", { style: "currency", currency: currency || "PEN" }).format(value);
const fmtInt = (value: number | null) => (value === null ? "—" : value.toLocaleString("es-PE"));
const fmtRoas = (value: number | null) => (value === null ? "—" : `${value.toFixed(2)}x`);

function Kpi({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums" data-testid={testId}>
        {value}
      </p>
    </div>
  );
}

/**
 * «Resultados de anuncios»: gasto de cada anuncio de Meta junto a los chats, pedidos y ventas
 * que llegaron al CRM desde ese anuncio (último anuncio antes del pedido, dentro de la ventana
 * de atribución). Solo administrador.
 */
export default function AdResultsCard() {
  const [from, setFrom] = useState(() => limaDay(29));
  const [to, setTo] = useState(() => limaDay(0));
  const [accountId, setAccountId] = useState("");
  const accounts = useMetaAdAccounts();
  const settings = useMetaAdsSettings();
  const accountList = accounts.data?.items ?? [];
  const chosenAccount =
    accountId || settings.data?.defaultAdAccountId || accountList[0]?.id || "";
  const results = useAdResults(from, to, chosenAccount || undefined);
  const data = results.data;
  const currency = data?.currency ?? null;
  const badRange = !!from && !!to && from > to;

  return (
    <section
      aria-labelledby="ad-results-title"
      className="space-y-3 rounded-md border bg-card p-4"
      data-testid="card-ad-results"
    >
      <div className="space-y-1">
        <h2 id="ad-results-title" className="text-sm font-semibold">
          Resultados de anuncios
        </h2>
        <p className="text-xs text-muted-foreground">
          Cuánto gastaste en cada anuncio de Meta y cuántos chats, pedidos y ventas trajo al CRM.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Desde
          <Input
            type="date"
            aria-label="Desde"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 w-40"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Hasta
          <Input
            type="date"
            aria-label="Hasta"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 w-40"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Cuenta publicitaria
          <select
            aria-label="Cuenta publicitaria de resultados"
            value={chosenAccount}
            onChange={(e) => setAccountId(e.target.value)}
            className={cn(NATIVE_SELECT_CLASS, "w-auto min-w-48")}
            disabled={accountList.length === 0}
          >
            {accountList.length === 0 && <option value="">Sin cuentas</option>}
            {accountList.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.id})
              </option>
            ))}
          </select>
        </label>
      </div>

      {badRange && (
        <p role="alert" className="text-xs text-destructive">
          La fecha «Desde» debe ser anterior a «Hasta».
        </p>
      )}
      {data?.simulated && (
        <p className="text-xs text-amber-700">
          Modo de prueba: Meta está simulado en este servidor. El gasto es de ejemplo.
        </p>
      )}
      {data?.spendError && (
        <p role="status" className="text-xs text-amber-700" data-testid="ad-results-spend-error">
          {data.spendError} Se muestran solo los datos del CRM.
        </p>
      )}

      {results.isLoading ? (
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando resultados…
        </p>
      ) : results.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {crmError(results.error).message}
        </p>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Gasto" value={fmtMoney(data.totals.spend, currency)} testId="kpi-spend" />
            <Kpi label="Chats" value={fmtInt(data.totals.chats)} testId="kpi-chats" />
            <Kpi label="Pedidos" value={fmtInt(data.totals.orders)} testId="kpi-orders" />
            <Kpi label="Ventas" value={fmtMoney(data.totals.revenue, currency)} testId="kpi-revenue" />
            <Kpi label="Costo por chat" value={fmtMoney(data.totals.costPerChat, currency)} testId="kpi-cpc" />
            <Kpi label="Retorno (ROAS)" value={fmtRoas(data.totals.roas)} testId="kpi-roas" />
          </div>

          {data.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No hay chats ni gasto de anuncios en estas fechas.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs" data-testid="ad-results-table">
                <thead className="bg-muted/40">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Anuncio</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Gasto</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Clics</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Chats</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Pedidos</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Ventas</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Costo por chat</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.adId ?? "sin-id"} className="border-t">
                      <td className="px-3 py-2">
                        <p className="font-medium">{r.adName}</p>
                        {r.campaignName && (
                          <p className="text-[11px] text-muted-foreground">{r.campaignName}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.spend, currency)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtInt(r.clicks)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtInt(r.chats)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtInt(r.orders)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.revenue, currency)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.costPerChat, currency)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtRoas(r.roas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Un pedido cuenta para el último anuncio por el que escribió el cliente, hasta{" "}
            {data.attributionDays} días antes del pedido.
          </p>
        </>
      ) : null}
    </section>
  );
}
