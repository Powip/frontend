"use client";

import { useState, useMemo } from "react";
import { DateRange } from "react-day-picker";
import { useAgentePerformance } from "@/hooks/useAgentePerformance";
import { AgentePerformanceKpis } from "@/interfaces/IOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown } from "lucide-react";

/* ── helpers ─────────────────────────────────────────── */
function formatPEN(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

type SortTab = "upsell" | "volumen" | "confirmacion";

const SORT_TABS: { key: SortTab; label: string }[] = [
  { key: "upsell", label: "Upsell S/" },
  { key: "volumen", label: "Volumen" },
  { key: "confirmacion", label: "Confirmación" },
];

function sortAgentes(
  agentes: AgentePerformanceKpis[],
  tab: SortTab,
): AgentePerformanceKpis[] {
  return [...agentes].sort((a, b) => {
    if (tab === "upsell") return b.upsellMonto - a.upsellMonto;
    if (tab === "volumen") return b.asignados - a.asignados;
    return b.pctConfirmados - a.pctConfirmados;
  });
}

/* ── badges automáticos ──────────────────────────────── */
function getBadges(
  agente: AgentePerformanceKpis,
  topUpsellId: string | null,
  topAsignadosId: string | null,
): string[] {
  const badges: string[] = [];
  if (agente.id === topUpsellId && agente.upsellMonto > 0) badges.push("⭐ Top upsell");
  if (agente.id === topAsignadosId) badges.push("🔥 Más pedidos");
  if (agente.asignados > 0 && (agente.upsellMonto === 0 || agente.pctConfirmados < 30)) badges.push("🎓 Coaching");
  return badges;
}

/* ── color de tasa de confirmación ──────────────────── */
function pctConfirmadosClass(pct: number): string {
  if (pct >= 50) return "text-emerald-600 dark:text-emerald-400 font-semibold";
  if (pct >= 30) return "text-amber-600 dark:text-amber-400 font-semibold";
  return "text-red-600 dark:text-red-400 font-semibold";
}

/* ── ranking ─────────────────────────────────────────── */
function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <span title="1°">🥇</span>;
  if (rank === 2) return <span title="2°">🥈</span>;
  if (rank === 3) return <span title="3°">🥉</span>;
  return <span className="text-xs text-muted-foreground font-medium">#{rank}</span>;
}

/* ── columna ordenable ───────────────────────────────── */
interface ThProps {
  children: React.ReactNode;
  active?: boolean;
  dir?: "asc" | "desc";
  className?: string;
}
function Th({ children, active, dir, className = "" }: ThProps) {
  return (
    <th
      className={`px-3 py-2 text-xs font-medium text-left text-muted-foreground uppercase tracking-wide whitespace-nowrap ${active ? "text-slate-800 dark:text-slate-100" : ""} ${className}`}
    >
      <span className="inline-flex items-center gap-0.5">
        {children}
        {active &&
          (dir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          ))}
      </span>
    </th>
  );
}

/* ── componente principal ────────────────────────────── */
interface Props {
  storeId: string;
  companyId: string;
  range: DateRange;
}

export function CcLeaderboard({ storeId, companyId, range }: Props) {
  const [activeTab, setActiveTab] = useState<SortTab>("upsell");
  const { data: rawAgentes, isLoading, isError } = useAgentePerformance(
    storeId,
    companyId,
    range,
  );

  const agentes = useMemo(
    () => (rawAgentes ? sortAgentes(rawAgentes, activeTab) : []),
    [rawAgentes, activeTab],
  );

  /* ── ids de top performers ─────────────────────────── */
  const topUpsellId = useMemo(() => {
    if (!rawAgentes?.length) return null;
    return [...rawAgentes].sort((a, b) => b.upsellMonto - a.upsellMonto)[0]?.id ?? null;
  }, [rawAgentes]);

  const topAsignadosId = useMemo(() => {
    if (!rawAgentes?.length) return null;
    return [...rawAgentes].sort((a, b) => b.asignados - a.asignados)[0]?.id ?? null;
  }, [rawAgentes]);

  /* ── totales para la fila de pie ───────────────────── */
  const totales = useMemo(() => {
    if (!agentes.length)
      return {
        asignados: 0,
        confirmados: 0,
        unidades: 0,
        facturacionBase: 0,
        upsellMonto: 0,
        ticketFinalProm: 0,
      };
    const totalConfirmados = agentes.reduce((s, a) => s + a.confirmados, 0);
    const totalFact = agentes.reduce(
      (s, a) => s + a.facturacionBase + a.upsellMonto,
      0,
    );
    return {
      asignados: agentes.reduce((s, a) => s + a.asignados, 0),
      confirmados: totalConfirmados,
      unidades: agentes.reduce((s, a) => s + a.unidades, 0),
      facturacionBase: agentes.reduce((s, a) => s + a.facturacionBase, 0),
      upsellMonto: agentes.reduce((s, a) => s + a.upsellMonto, 0),
      // ticket final promedio ponderado: total facturación / total confirmados
      ticketFinalProm: totalConfirmados > 0 ? totalFact / totalConfirmados : 0,
    };
  }, [agentes]);

  /* ── insights ──────────────────────────────────────── */
  const insights = useMemo(() => {
    if (!agentes.length) return [];
    const list: string[] = [];

    // Mayor upsell/pedido
    const withUpsell = agentes.filter(
      (a) => a.upsellMonto > 0 && a.confirmados > 0,
    );
    if (withUpsell.length) {
      const best = withUpsell.reduce((prev, cur) =>
        cur.upsellMonto / cur.confirmados > prev.upsellMonto / prev.confirmados
          ? cur
          : prev,
      );
      list.push(
        `Mayor upsell/pedido: ${best.nombre ?? "—"} con ${formatPEN(best.upsellMonto / best.confirmados)} promedio`,
      );
    }

    // Sin upsell + potencial estimado (usando ticket promedio global)
    const sinUpsell = agentes.filter((a) => a.upsellMonto === 0 && a.confirmados > 0);
    if (sinUpsell.length && totales.upsellMonto > 0 && totales.confirmados > 0) {
      const upsellPorPedido = totales.upsellMonto / totales.confirmados;
      const totalConfSinUpsell = sinUpsell.reduce((s, a) => s + a.confirmados, 0);
      const potencial = upsellPorPedido * totalConfSinUpsell;
      list.push(
        `${sinUpsell.length} agente${sinUpsell.length !== 1 ? "s" : ""} sin upsell · potencial estimado: ${formatPEN(potencial)}`,
      );
    }

    // Unidades/pedido global
    if (totales.confirmados > 0) {
      const uppp = (totales.unidades / totales.confirmados).toFixed(2);
      list.push(`Unidades/pedido global: ${uppp}`);
    }

    return list;
  }, [agentes, totales]);

  return (
    <Card className="border-0 shadow-sm bg-slate-50 dark:bg-slate-800/50">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
            Leaderboard de Vendedores
          </CardTitle>

          {/* Tabs de orden */}
          <div className="flex gap-1 rounded-lg bg-slate-200 dark:bg-slate-700 p-1">
            {SORT_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {isError && (
          <p className="text-sm text-red-500 dark:text-red-400">
            Error al cargar el leaderboard. Intentá de nuevo.
          </p>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-10 rounded bg-slate-200 dark:bg-slate-700 animate-pulse"
              />
            ))}
          </div>
        ) : !agentes.length ? (
          <p className="text-sm text-muted-foreground">
            Sin agentes con datos para el período seleccionado.
          </p>
        ) : (
          <>
            {/* Tabla */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <Th className="w-10">#</Th>
                    <Th>Vendedor</Th>
                    <Th active={activeTab === "volumen"} dir="desc">
                      Asignados
                    </Th>
                    <Th active={activeTab === "confirmacion"} dir="desc">
                      Confirmados
                    </Th>
                    <Th>Unidades</Th>
                    <Th>Fact. base</Th>
                    <Th active={activeTab === "upsell"} dir="desc">
                      Upsell S/
                    </Th>
                    <Th>Ticket final</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {agentes.map((agente, idx) => {
                    const badges = getBadges(agente, topUpsellId, topAsignadosId);
                    const ticketFinal = agente.ticketFinal ?? 0;

                    return (
                      <tr
                        key={agente.id}
                        className="bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        {/* Ranking */}
                        <td className="px-3 py-2.5 text-center">
                          <RankIcon rank={idx + 1} />
                        </td>

                        {/* Vendedor */}
                        <td className="px-3 py-2.5 min-w-[160px]">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-slate-800 dark:text-slate-100 truncate max-w-[160px]">
                              {agente.nombre ?? "—"}
                            </span>
                            {agente.ccRol && (
                              <Badge
                                variant="secondary"
                                className="w-fit text-[10px] py-0 px-1.5"
                              >
                                {agente.ccRol}
                              </Badge>
                            )}
                            {badges.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {badges.map((b) => (
                                  <span
                                    key={b}
                                    className="text-[10px] bg-slate-100 dark:bg-slate-700 rounded px-1 py-0.5 text-slate-600 dark:text-slate-300"
                                  >
                                    {b}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Asignados */}
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {agente.asignados}
                        </td>

                        {/* Confirmados */}
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          <span className={pctConfirmadosClass(agente.pctConfirmados)}>
                            {agente.confirmados}
                          </span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({agente.pctConfirmados.toFixed(1)}%)
                          </span>
                        </td>

                        {/* Unidades */}
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {agente.unidades}
                        </td>

                        {/* Fact. base */}
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <div className="flex flex-col items-end gap-0">
                            <span>{formatPEN(agente.facturacionBase)}</span>
                            {agente.confirmados > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                ticket {formatPEN(agente.facturacionBase / agente.confirmados)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Upsell S/ */}
                        <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                          {agente.upsellMonto > 0 ? (
                            <span className="font-semibold text-violet-700 dark:text-violet-300">
                              {formatPEN(agente.upsellMonto)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                              sin upsell
                            </span>
                          )}
                        </td>

                        {/* Ticket final */}
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                            {formatPEN(ticketFinal)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Fila de totales */}
                <tfoot>
                  <tr
                    className="border-t-2 border-slate-300 dark:border-slate-600"
                    style={{ backgroundColor: "#F4F6FB" }}
                  >
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                      Total
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                      {totales.asignados}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                      {totales.confirmados}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                      {totales.unidades}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {formatPEN(totales.facturacionBase)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-violet-700 dark:text-violet-300 whitespace-nowrap">
                      {formatPEN(totales.upsellMonto)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                      {formatPEN(totales.ticketFinalProm)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Insights */}
            {insights.length > 0 && (
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-3 space-y-1.5">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">
                  Insights
                </p>
                {insights.map((insight, i) => (
                  <p key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                    <span className="text-violet-500 mt-0.5 shrink-0">•</span>
                    {insight}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
