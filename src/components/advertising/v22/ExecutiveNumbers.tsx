"use client";
import { useState } from "react";
import { startOfWeek, parseISO } from "date-fns";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  AdsExecutiveFlow,
  AdsExecutiveMetric,
  AdsSales,
  AdsSummary,
} from "@/services/advertisingV22Service";
import {
  executiveEfficiency,
  executiveSpend,
  executiveTotal,
  comparableAccounts,
} from "./executive-model";
import { dateRange, dayKey, decimal, money, numeric, pct, ratio } from "./model";
import { Block, MetricCard, SelectField } from "./shared";

const fallbackAccounts = (summary: AdsSummary): NonNullable<AdsSummary["accounts"]> =>
  [...new Set(summary.days.map((row) => row.accountId))].map((id) => ({
    id,
    name: id,
    externalId: id,
    currency: "PEN",
  }));
const stamp = (value?: string | null) =>
  value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("es-PE", {
        timeZone: "America/Lima",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "Pendiente";
const selectedRows = (flow: AdsExecutiveFlow, storeId: string) =>
  flow.daily.filter((row) => storeId === "all" || row.storeId === storeId);
const variation = (current: number | null, previous: number | null | undefined) =>
  current === null || previous == null || previous === 0 ? null : (current - previous) / previous;

export function ExecutiveNumbers({
  summary,
  sales,
  previous,
  storeId,
  accountId,
  canSpend,
}: {
  summary: AdsSummary;
  sales: AdsSales;
  previous?: { summary: AdsSummary; sales: AdsSales };
  storeId: string;
  accountId: string;
  canSpend: boolean;
}) {
  const data = sales.executive;
  if (!data)
    return (
      <p role="status" className="rounded-md border p-3 text-sm text-muted-foreground">
        Las métricas ampliadas están pendientes de actualización del servicio de Ventas.
      </p>
    );
  const flow = data.standard;
  const metric = executiveTotal(selectedRows(flow, storeId));
  const cod =
    data.shopifyCod?.enabled && (storeId === "all" || data.shopifyCod.storeIds.includes(storeId))
      ? data.shopifyCod
      : null;
  const spend = executiveSpend(summary, storeId, accountId);
  // No source currently separates Shopify COD spend from the standard order flow.
  const efficiency = executiveEfficiency(
    metric,
    spend,
    !cod &&
      !data.quality.codHistoryWithoutEnabledConfiguration &&
      comparableAccounts(summary, accountId),
  );
  const old = previous?.sales.executive
    ? executiveTotal(selectedRows(previous.sales.executive.standard, storeId))
    : null;
  const oldSpend = previous ? executiveSpend(previous.summary, storeId, accountId) : null;
  const costDetail = !comparableAccounts(summary, accountId)
    ? "Pendiente de conciliar las zonas horarias de las cuentas con Lima"
    : cod
      ? "Pendiente de separar el gasto de Shopify COD"
      : "Gasto ÷ pedidos con atribución verificada; — si faltan datos";
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {canSpend && (
          <MetricCard
            label="Gasto publicitario"
            value={money(spend)}
            variation={variation(spend, oldSpend)}
            detail="Inversión real del período · PEN"
          />
        )}
        <MetricCard
          label="Pedidos generados"
          value={decimal(metric.orders)}
          variation={variation(metric.orders, old?.orders)}
          detail="Flujo normal · sin leads Shopify COD"
        />
        <MetricCard
          label="Ventas confirmadas"
          value={decimal(metric.confirmed)}
          variation={variation(metric.confirmed, old?.confirmed)}
        />
        <MetricCard
          label="Ventas entregadas"
          value={decimal(metric.delivered)}
          variation={variation(metric.delivered, old?.delivered)}
        />
        <MetricCard
          label="Facturación entregada"
          value={money(numeric(metric.deliveredRevenue))}
          variation={variation(
            numeric(metric.deliveredRevenue),
            old ? numeric(old.deliveredRevenue) : null,
          )}
          detail="De los pedidos creados en el período"
        />
        {canSpend && (
          <MetricCard
            label="ROAS entregado"
            value={decimal(efficiency.roasDelivered, "×")}
            detail="Facturación entregada atribuida ÷ gasto comparable"
          />
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {canSpend && (
          <>
            <MetricCard
              label="CPV · costo por pedido atribuido"
              value={money(efficiency.costOrder)}
              detail={costDetail}
            />
            <MetricCard
              label="Costo por venta confirmada atribuida"
              value={money(efficiency.costConfirmed)}
              detail={costDetail}
            />
            <MetricCard
              label="Costo por venta entregada atribuida"
              value={money(efficiency.costDelivered)}
              detail={costDetail}
            />
            <MetricCard
              label="ROAS de pedidos"
              value={decimal(efficiency.roasOrders, "×")}
              detail="Valor de pedidos atribuidos ÷ gasto comparable"
            />
          </>
        )}
        <MetricCard
          label="Ticket promedio por pedido entregado"
          value={money(ratio(numeric(metric.deliveredRevenue), metric.delivered))}
          detail="Facturación entregada ÷ pedidos entregados"
        />
        <MetricCard
          label="Ticket promedio por unidad entregada"
          value={money(ratio(numeric(metric.deliveredRevenue), metric.deliveredUnits))}
          detail={`${metric.deliveredUnits} unidades entregadas de la misma cohorte`}
        />
        <MetricCard
          label="Tasa de confirmación"
          value={pct(ratio(metric.confirmed, metric.orders))}
          detail={`${metric.confirmed} confirmadas ÷ ${metric.orders} pedidos`}
        />
        <MetricCard
          label="Tasa de entrega"
          value={pct(ratio(metric.delivered, metric.confirmed))}
          detail={`${metric.delivered} entregadas ÷ ${metric.confirmed} confirmadas`}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Cohorte de creación: pedidos y leads creados entre {summary.from} y {summary.to}; se sigue
        su estado hasta la consulta, incluidas entregas posteriores. No representa entregas
        realizadas durante esas fechas. Costos y ROAS usan referencias verificadas; no se reparte
        gasto. Los datos recientes pueden cambiar.
      </p>
      {sales.executiveAvailability?.warnings.includes("SHOPIFY_COD_CONFIGURATION_UNAVAILABLE") && (
        <p role="status" className="rounded-md border p-3 text-sm">
          La configuración Shopify COD todavía no está disponible. Sus métricas y la separación de
          gasto permanecen pendientes.
        </p>
      )}
      {(metric.unknownCurrencyOrders ?? 0) + (metric.excludedCurrencyOrders ?? 0) > 0 && (
        <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Hay pedidos en otra moneda o sin moneda confirmada. Las entidades se conservan; los
          importes y ratios no comparables permanecen pendientes.
        </p>
      )}
      {data.quality.codHistoryWithoutEnabledConfiguration === true && (
        <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Existe historial Shopify COD sin configuración activa confirmada. No se mezcla con pedidos
          normales; revisa la modalidad del negocio antes de comparar costos.
        </p>
      )}
      {metric.unattributedOrders > 0 && (
        <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Sin atribución: {metric.unattributedOrders} de {metric.orders} pedidos. Se incluyen en el
          embudo y los tickets; no se les asigna una cuenta ni facturación publicitaria por
          aproximación.
        </p>
      )}
      {cod && <CodNumbers flow={cod} storeId={storeId} canSpend={canSpend} />}
      <Block title="Del pedido a la venta">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Pedidos generados", count: metric.orders },
            { label: "Ventas confirmadas", count: metric.confirmed },
            { label: "Ventas entregadas", count: metric.delivered },
            { label: "Cancelados / rechazados", count: metric.cancelled },
          ].map((stage) => (
            <div key={stage.label} className="rounded-md bg-muted/50 p-4">
              <p className="text-sm">{stage.label}</p>
              <p className="text-xl font-semibold">{decimal(stage.count)}</p>
              <p className="text-xs text-muted-foreground">
                {pct(ratio(stage.count, metric.orders))} de los pedidos
              </p>
            </div>
          ))}
        </div>
      </Block>
      <ExecutiveTimeline
        summary={summary}
        flow={flow}
        storeId={storeId}
        accountId={accountId}
        canSpend={canSpend}
      />
      <Block title="Desglose por cuenta publicitaria">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs [&_td]:p-3 [&_th]:p-3 [&_td]:whitespace-nowrap">
            <thead>
              <tr>
                {[
                  "Cuenta",
                  ...(canSpend ? ["Gasto"] : []),
                  "Pedidos",
                  ...(cod ? ["Leads COD"] : []),
                  "Confirmadas",
                  "Entregadas",
                  "Facturación entregada",
                  ...(canSpend
                    ? ["CPV", "Costo / confirmada", "Costo / entregada", "ROAS entregado"]
                    : []),
                  "Sincronización",
                ].map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(summary.accounts ?? fallbackAccounts(summary))
                .filter((account) => accountId === "all" || account.id === accountId)
                .map((account) => {
                  const row = executiveTotal(
                    selectedRows(flow, storeId).filter((row) => row.accountId === account.id),
                  );
                  const lead = cod
                    ? executiveTotal(
                        selectedRows(cod, storeId).filter((row) => row.accountId === account.id),
                      )
                    : null;
                  const amount =
                    account.currency === "PEN"
                      ? executiveSpend(summary, storeId, account.id)
                      : null;
                  return (
                    <tr key={account.id} className="border-t">
                      <th scope="row" className="font-normal">
                        <span className="block font-medium">{account.name}</span>
                        <span className="text-muted-foreground">
                          {account.externalId} · {account.currency}
                        </span>
                      </th>
                      <BreakdownCells
                        metric={row}
                        spend={amount}
                        codMetric={lead ?? undefined}
                        canSpend={canSpend}
                        comparable={
                          !cod &&
                          !data.quality.codHistoryWithoutEnabledConfiguration &&
                          comparableAccounts(summary, account.id)
                        }
                      />
                      <td>
                        <span className="block">
                          {stamp(account.lastSyncedAt ?? account.lastSuccessfulAt)}
                        </span>
                        <span className="text-muted-foreground">
                          {account.status ?? "Cobertura del período en revisión"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              {accountId === "all" && (
                <tr className="border-t text-muted-foreground">
                  <th scope="row">Sin atribución</th>
                  <BreakdownCells
                    metric={executiveTotal(
                      selectedRows(flow, storeId).filter((row) => !row.accountId),
                    )}
                    spend={null}
                    codMetric={
                      cod
                        ? executiveTotal(selectedRows(cod, storeId).filter((row) => !row.accountId))
                        : undefined
                    }
                    canSpend={canSpend}
                    comparable={false}
                  />
                  <td>Referencia pendiente</td>
                </tr>
              )}
              <tr className="border-t font-semibold">
                <th scope="row">Total consolidado</th>
                <BreakdownCells
                  metric={metric}
                  spend={spend}
                  codMetric={cod ? executiveTotal(selectedRows(cod, storeId)) : undefined}
                  canSpend={canSpend}
                  comparable={
                    !cod &&
                    !data.quality.codHistoryWithoutEnabledConfiguration &&
                    comparableAccounts(summary, accountId)
                  }
                />
                <td>Entidades únicas</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Las cuentas muestran sólo entidades vinculadas; la fila Sin atribución conserva las demás.
          Confirmadas, entregadas y facturación incluyen el flujo normal y las ventas de leads COD.
          Monedas diferentes de PEN quedan pendientes de comparación.
        </p>
        {canSpend && (
          <p className="text-sm text-amber-700">
            {storeId === "all"
              ? "Gasto sin negocio asignado:"
              : "Alerta global · gasto sin negocio asignado:"}{" "}
            {money(numeric(summary.unassignedSpend))}. Permanece en el total de todas las cuentas y
            negocios.
          </p>
        )}
      </Block>
      <Block title="Canales de venta">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs [&_td]:p-3 [&_th]:p-3">
            <thead>
              <tr>
                {[
                  "Canal",
                  ...(canSpend ? ["Gasto atribuible"] : []),
                  "Pedidos",
                  ...(cod ? ["Leads COD"] : []),
                  "Confirmadas",
                  "Entregadas",
                  "Facturación entregada",
                  ...(canSpend
                    ? ["CPV", "Costo / confirmada", "Costo / entregada", "ROAS entregado"]
                    : []),
                ].map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ...new Set(
                  [...selectedRows(flow, storeId), ...(cod ? selectedRows(cod, storeId) : [])].map(
                    (row) => row.channel ?? "Sin canal",
                  ),
                ),
              ].map((channel) => {
                const row = executiveTotal(
                  selectedRows(flow, storeId).filter((row) => row.channel === channel),
                );
                const lead = cod
                  ? executiveTotal(
                      selectedRows(cod, storeId).filter((row) => row.channel === channel),
                    )
                  : null;
                return (
                  <tr key={channel} className="border-t">
                    <th scope="row">{channel}</th>
                    <BreakdownCells
                      metric={row}
                      spend={null}
                      codMetric={lead ?? undefined}
                      canSpend={canSpend}
                      comparable={false}
                    />
                  </tr>
                );
              })}
              <tr className="border-t font-semibold">
                <th scope="row">Total consolidado</th>
                <BreakdownCells
                  metric={metric}
                  spend={spend}
                  codMetric={cod ? executiveTotal(selectedRows(cod, storeId)) : undefined}
                  canSpend={canSpend}
                  comparable={
                    !cod &&
                    !data.quality.codHistoryWithoutEnabledConfiguration &&
                    comparableAccounts(summary, accountId)
                  }
                />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Los canales conservan su origen registrado. El gasto y ROAS por canal requieren una
          asignación verificable al canal exacto; — indica información pendiente.
        </p>
      </Block>
    </>
  );
}
function BreakdownCells({
  metric,
  spend,
  codMetric,
  canSpend,
  comparable,
}: {
  metric: AdsExecutiveMetric;
  spend: number | null;
  codMetric?: AdsExecutiveMetric;
  canSpend: boolean;
  comparable: boolean;
}) {
  const result = executiveEfficiency(metric, spend, comparable);
  return (
    <>
      {canSpend && <td>{money(spend)}</td>}
      <td>{decimal(metric.orders)}</td>
      {codMetric && <td>{decimal(codMetric.orders)}</td>}
      <td>{decimal(metric.confirmed + (codMetric?.confirmed ?? 0))}</td>
      <td>{decimal(metric.delivered + (codMetric?.delivered ?? 0))}</td>
      <td>
        {money(
          numeric(metric.deliveredRevenue) === null ||
            (codMetric && numeric(codMetric.deliveredRevenue) === null)
            ? null
            : numeric(metric.deliveredRevenue)! +
                (codMetric ? numeric(codMetric.deliveredRevenue)! : 0),
        )}
      </td>
      {canSpend && (
        <>
          <td>{money(result.costOrder)}</td>
          <td>{money(result.costConfirmed)}</td>
          <td>{money(result.costDelivered)}</td>
          <td>{decimal(result.roasDelivered, "×")}</td>
        </>
      )}
    </>
  );
}
function CodNumbers({
  flow,
  storeId,
  canSpend,
}: {
  flow: AdsExecutiveFlow;
  storeId: string;
  canSpend: boolean;
}) {
  const metric = executiveTotal(selectedRows(flow, storeId));
  return (
    <Block title="Shopify COD · Leads">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Leads generados" value={decimal(metric.orders)} />
        <MetricCard
          label="Leads confirmados / ventas"
          value={decimal(metric.confirmed)}
          detail={`Conversión lead → venta: ${pct(ratio(metric.confirmed, metric.orders))}`}
        />
        <MetricCard
          label="Ventas entregadas desde leads"
          value={decimal(metric.delivered)}
          detail={`Entrega: ${pct(ratio(metric.delivered, metric.confirmed))}`}
        />
        <MetricCard
          label="Facturación entregada desde leads"
          value={money(numeric(metric.deliveredRevenue))}
        />
        {canSpend &&
          [
            "Gasto atribuible a Shopify COD",
            "Costo por lead",
            "Costo por venta desde lead",
            "Costo por venta entregada desde lead",
          ].map((label) => (
            <MetricCard
              key={label}
              label={label}
              value="—"
              detail="Falta gasto vinculado de forma verificable a esta cohorte de leads"
            />
          ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Sin atribución publicitaria: {metric.unattributedOrders} leads. Cada lead se cuenta una vez
        y su venta se sigue mediante el identificador de conversión. Los leads y sus ventas se
        presentan separados del flujo normal.
      </p>
    </Block>
  );
}
function ExecutiveTimeline({
  summary,
  flow,
  storeId,
  accountId,
  canSpend,
}: {
  summary: AdsSummary;
  flow: AdsExecutiveFlow;
  storeId: string;
  accountId: string;
  canSpend: boolean;
}) {
  const [grouping, setGrouping] = useState("day");
  const [series, setSeries] = useState({ spend: true, orders: true, revenue: true });
  const groups = new Map<
    string,
    { date: string; spend: number | null; orders: number; revenue: number | null }
  >();
  for (const date of dateRange(summary.from, summary.to)) {
    const key =
      grouping === "week" ? dayKey(startOfWeek(parseISO(date), { weekStartsOn: 1 })) : date;
    const row = groups.get(key) ?? { date: key, spend: 0, orders: 0, revenue: 0 };
    const spend = executiveSpend(summary, storeId, accountId, date);
    const metric = executiveTotal(selectedRows(flow, storeId).filter((item) => item.date === date));
    row.spend = row.spend === null || spend === null ? null : row.spend + spend;
    row.orders += metric.orders;
    const revenue = numeric(metric.deliveredRevenue);
    row.revenue = row.revenue === null || revenue === null ? null : row.revenue + revenue;
    groups.set(key, row);
  }
  return (
    <Block
      title="Cómo va el mes · día por día"
      tools={
        <SelectField
          label="Agrupar seguimiento"
          value={grouping}
          onChange={setGrouping}
          options={[
            { value: "day", label: "Por día" },
            { value: "week", label: "Por semana" },
          ]}
        />
      }
    >
      <div className="flex flex-wrap gap-4 text-xs">
        {[
          { key: "spend" as const, label: "Gasto publicitario (S/)", visible: canSpend },
          { key: "orders" as const, label: "Pedidos generados", visible: true },
          { key: "revenue" as const, label: "Facturación entregada (S/)", visible: true },
        ]
          .filter((item) => item.visible)
          .map((item) => (
            <label key={item.key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={series[item.key]}
                onChange={(event) =>
                  setSeries((prior) => ({ ...prior, [item.key]: event.target.checked }))
                }
              />
              {item.label}
            </label>
          ))}
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={[...groups.values()]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="money" />
            <YAxis yAxisId="orders" orientation="right" allowDecimals={false} />
            <Tooltip />
            {canSpend && series.spend && (
              <Bar yAxisId="money" dataKey="spend" name="Gasto (S/)" fill="#8b5cf6" />
            )}
            {series.revenue && (
              <Line
                yAxisId="money"
                dataKey="revenue"
                name="Facturación entregada (S/)"
                stroke="#0d9488"
                dot={false}
              />
            )}
            {series.orders && (
              <Line yAxisId="orders" dataKey="orders" name="Pedidos" stroke="#c4b5fd" dot={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        Respeta el período, negocio y cuenta seleccionados. Facturación agrupada por creación del
        pedido; una semana incompleta conserva sus días seleccionados.
      </p>
    </Block>
  );
}
