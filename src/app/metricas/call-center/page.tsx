"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
} from "recharts";
import { ChevronDown } from "lucide-react";

/* ─────────────────── Constants ─────────────────── */

const RESULT_COLORS = [
  "#10b981", // confirmado
  "#ec4899", // no contesta
  "#f59e0b", // reagendar
  "#6366f1", // rechazado
];

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/* ─────────────────── Component ─────────────────── */

export default function MetricasCallCenterPage() {
  const { selectedStoreId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);

  // Date range
  const now = new Date();
  const dateFrom = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const dateLabel = useMemo(() => {
    const fmt = (d: Date) =>
      d.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
    return `Hoy — ${fmt(dateFrom)}`;
  }, [dateFrom]);

  // Fetch
  useEffect(() => {
    if (!selectedStoreId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`
        );
        setOrders(res.data || []);
      } catch (error) {
        console.error("Error fetching call-center data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedStoreId]);

  // Orders that went through "LLAMADO" status (called)
  const calledOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status !== "PENDIENTE" &&
          o.status !== "ANULADO" &&
          new Date(o.created_at) >= dateFrom
      ),
    [orders, dateFrom]
  );

  const todayOrders = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return orders.filter(
      (o) => new Date(o.created_at).toISOString().split("T")[0] === today
    );
  }, [orders]);

  // ── KPIs ──

  // Contact Rate: orders contacted / total orders in period
  const totalPeriod = useMemo(
    () => orders.filter((o) => new Date(o.created_at) >= dateFrom).length,
    [orders, dateFrom]
  );
  const contactRate = useMemo(() => {
    if (totalPeriod === 0) return 0;
    return Math.round((calledOrders.length / totalPeriod) * 100);
  }, [calledOrders, totalPeriod]);

  // Confirmation Rate: confirmed (ENTREGADO + PAGADO + EN_ENVIO) / called
  const confirmed = useMemo(
    () =>
      calledOrders.filter((o) =>
        ["ENTREGADO", "PAGADO", "EN_ENVIO", "CON_GUIA"].includes(o.status)
      ).length,
    [calledOrders]
  );
  const confirmRate = useMemo(() => {
    if (calledOrders.length === 0) return 0;
    return Math.round((confirmed / calledOrders.length) * 100);
  }, [confirmed, calledOrders]);

  // Tasa NCI: no contactado / total
  const nciRate = useMemo(() => {
    if (totalPeriod === 0) return 0;
    const notContacted = totalPeriod - calledOrders.length;
    return Math.round((notContacted / totalPeriod) * 100);
  }, [totalPeriod, calledOrders]);

  // Speed to Call: avg minutes from creation to first status change (simulated)
  const speedToCall = useMemo(() => {
    const withUpdate = calledOrders.filter((o) => o.updated_at);
    if (withUpdate.length === 0) return 0;
    const avgMin =
      withUpdate.reduce((sum: number, o: any) => {
        const created = new Date(o.created_at).getTime();
        const updated = new Date(o.updated_at).getTime();
        return sum + (updated - created) / (1000 * 60);
      }, 0) / withUpdate.length;
    return Math.round(avgMin);
  }, [calledOrders]);

  // Tiempo Medio de Confirmación (TMC) en horas
  const tmc = useMemo(() => {
    const confirmedOrders = calledOrders.filter((o) =>
      ["ENTREGADO", "PAGADO", "EN_ENVIO", "CON_GUIA", "PREPARADO"].includes(o.status)
    );
    if (confirmedOrders.length === 0) return 0;
    
    const avgHs = confirmedOrders.reduce((sum: number, o: any) => {
      const created = new Date(o.created_at).getTime();
      const updated = new Date(o.updated_at).getTime();
      return sum + (updated - created) / (1000 * 60 * 60);
    }, 0) / confirmedOrders.length;
    
    return Number(avgHs.toFixed(1));
  }, [calledOrders]);

  // Upsell Rate & Revenue
  const upsellOrders = useMemo(
    () => calledOrders.filter((o) => (o.items?.length || 0) > 1),
    [calledOrders]
  );
  const upsellRate = useMemo(() => {
    if (calledOrders.length === 0) return 0;
    return Math.round((upsellOrders.length / calledOrders.length) * 100);
  }, [upsellOrders, calledOrders]);

  const upsellRevenue = useMemo(() => {
    return upsellOrders.reduce((sum: number, o: any) => {
      const items = o.items || [];
      if (items.length <= 1) return sum;
      // Additional items beyond the first
      const extra = items.slice(1).reduce(
        (s: number, i: any) => s + Number(i.subtotal || i.price || 0),
        0
      );
      return sum + extra;
    }, 0);
  }, [upsellOrders]);

  // Pedidos/Día por Agente
  const pedidosAgenteDia = useMemo(() => {
    if (calledOrders.length === 0) return 0;
    
    // Count unique agents
    const uniqueAgents = new Set(calledOrders.map((o) => o.sellerName || o.userId || "Agente")).size;
    
    // Determine the number of days in the period (dateFrom to now)
    const daysInPeriod = 7;
    
    if (uniqueAgents === 0) return 0;
    return Math.round(calledOrders.length / (uniqueAgents * daysInPeriod));
  }, [calledOrders]);

  // ── Call results donut (Today) ──
  const callResults = useMemo(() => {
    const results = [
      {
        name: "Confirmado",
        value: todayOrders.filter((o) =>
          ["ENTREGADO", "PAGADO", "EN_ENVIO", "CON_GUIA", "PREPARADO"].includes(o.status)
        ).length,
        color: RESULT_COLORS[0],
      },
      {
        name: "No contesta",
        value: todayOrders.filter((o) => o.status === "PENDIENTE").length,
        color: RESULT_COLORS[1],
      },
      {
        name: "Reagendar",
        value: todayOrders.filter((o) => o.status === "LLAMADO").length,
        color: RESULT_COLORS[2],
      },
      {
        name: "Rechazado",
        value: todayOrders.filter((o) => o.status === "ANULADO").length,
        color: RESULT_COLORS[3],
      },
    ].filter((r) => r.value > 0);
    return results;
  }, [todayOrders]);

  // ── Agent ranking (simulated from sellers) ──
  const agentRanking = useMemo(() => {
    const sellerMap: Record<
      string,
      { total: number; confirmed: number; upsell: number; handleTimeSum: number }
    > = {};

    calledOrders.forEach((o: any) => {
      const seller = o.sellerName || "Agente";
      if (!sellerMap[seller]) {
        sellerMap[seller] = { total: 0, confirmed: 0, upsell: 0, handleTimeSum: 0 };
      }
      sellerMap[seller].total++;
      if (["ENTREGADO", "PAGADO", "EN_ENVIO", "CON_GUIA"].includes(o.status)) {
        sellerMap[seller].confirmed++;
      }
      if ((o.items?.length || 0) > 1) {
        sellerMap[seller].upsell++;
      }
      if (o.updated_at && ["ENTREGADO", "PAGADO", "EN_ENVIO", "CON_GUIA", "PREPARADO"].includes(o.status)) {
        const diff =
          (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) /
          (1000 * 60 * 60);
        sellerMap[seller].handleTimeSum += diff;
      }
    });

    return Object.entries(sellerMap)
      .map(([name, s]) => ({
        name: name.length > 12 ? name.substring(0, 10) + "." : name,
        confirm: s.total > 0 ? Math.round((s.confirmed / s.total) * 100) : 0,
        tmc: s.confirmed > 0 ? Number((s.handleTimeSum / s.confirmed).toFixed(1)) : 0,
        upsell: s.total > 0 ? Math.round((s.upsell / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.confirm - a.confirm)
      .slice(0, 6);
  }, [calledOrders]);

  // ── Upselling últimos 7 días ──
  const weeklyUpsell = useMemo(() => {
    const data = DAY_LABELS.map((day) => ({ day, total: 0 }));
    calledOrders.forEach((o: any) => {
      if ((o.items?.length || 0) <= 1) return;
      const d = new Date(o.created_at);
      let dayIdx = d.getDay() - 1;
      if (dayIdx < 0) dayIdx = 6;
      const extra = (o.items || []).slice(1).reduce(
        (s: number, i: any) => s + Number(i.subtotal || i.price || 0),
        0
      );
      data[dayIdx].total += extra;
    });
    return data.map((d) => ({ ...d, total: Math.round(d.total) }));
  }, [calledOrders]);

  // Badge color helpers
  const confirmColor = (v: number) =>
    v >= 75 ? "text-emerald-500" : "text-amber-500";
  const upsellColor = (v: number) =>
    v >= 20 ? "text-emerald-500" : "text-amber-500";

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            Call Center
          </h1>
          <p className="text-xs text-slate-400 font-semibold tracking-[0.15em] uppercase mt-1">
            Confirmaciones, gestión de llamadas y upselling
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700">
          <span>{dateLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Contact Rate */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Contact Rate
            </p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
              +3%
            </span>
          </div>
          <p className="text-2xl font-black text-slate-800">
            {loading ? "—" : `${contactRate}%`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Meta: &gt;65% ✓
          </p>
        </div>

        {/* Confirmation Rate */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Confirmation Rate
            </p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
              +1%
            </span>
          </div>
          <p className="text-2xl font-black text-slate-800">
            {loading ? "—" : `${confirmRate}%`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Meta: &gt;75% ✓
          </p>
        </div>

        {/* Tasa NCI */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
            Tasa NCI
          </p>
          <p className="text-2xl font-black text-amber-500">
            {loading ? "—" : `${nciRate}%`}
          </p>
          <p className="text-xs text-amber-500 font-semibold mt-0.5">
            Meta: &lt;10% — límite
          </p>
        </div>

        {/* Speed to Call */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
            Speed to Call
          </p>
          <p className="text-2xl font-black text-slate-800">
            {loading ? "—" : `${speedToCall}m`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Meta: &lt;30m ✓
          </p>
        </div>
      </div>

      {/* KPI Cards Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tiempo Confirmación */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
            Tiempo Confirmación
          </p>
          <p className="text-2xl font-black text-slate-800">
            {loading ? "—" : `${tmc}h`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Mín: &lt;24h ✓
          </p>
        </div>

        {/* Upsell Rate */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Upsell Rate
            </p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
              +4%
            </span>
          </div>
          <p className="text-2xl font-black text-slate-800">
            {loading ? "—" : `${upsellRate}%`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Meta: &gt;20% ✓
          </p>
        </div>

        {/* Upselling Generado */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
            Upselling Generado
          </p>
          <p className="text-2xl font-black text-slate-800">
            {loading
              ? "—"
              : `S/ ${upsellRevenue.toLocaleString("es-PE", { minimumFractionDigits: 0 })}`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Ingresos adicionales
          </p>
        </div>

        {/* Pedidos/Día Agente */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
            Pedidos/Día Agente
          </p>
          <p className="text-2xl font-black text-slate-800">
            {loading ? "—" : pedidosAgenteDia}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Meta: &gt;15/d ✓
          </p>
        </div>
      </div>

      {/* Row: Resultados de llamadas + Ranking de agentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resultados de llamadas — Hoy */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Resultados de llamadas — Hoy
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : callResults.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
              Sin llamadas hoy
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={260}>
                <PieChart>
                  <Pie
                    data={callResults}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {callResults.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: string) => [`${value}`, name]}
                    contentStyle={{
                      background: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 flex-1">
                {callResults.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: r.color }}
                    />
                    <span className="text-xs text-slate-600 font-medium">
                      {r.name}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold ml-auto">
                      {r.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Ranking de agentes — Hoy */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Ranking de agentes — Hoy
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : agentRanking.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
              Sin datos de agentes
            </div>
          ) : (
            <div className="overflow-auto max-h-[320px]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider py-2 w-8">
                      #
                    </th>
                    <th className="text-left text-[10px] text-slate-400 font-bold uppercase tracking-wider py-2 pr-2">
                      Agente
                    </th>
                    <th className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider py-2 px-2">
                      Confirm
                    </th>
                    <th className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider py-2 px-2">
                      TMC
                    </th>
                    <th className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider py-2 pl-2">
                      Upsell
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {agentRanking.map((agent, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3 pr-2 text-sm font-semibold text-slate-700">
                        {agent.name}
                      </td>
                      <td
                        className={`py-3 px-2 text-center text-sm font-bold ${confirmColor(agent.confirm)}`}
                      >
                        {agent.confirm}%
                      </td>
                      <td className="py-3 px-2 text-center text-sm text-slate-600">
                        {agent.tmc}h
                      </td>
                      <td
                        className={`py-3 pl-2 text-center text-sm font-bold ${upsellColor(agent.upsell)}`}
                      >
                        {agent.upsell}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Upselling generado — últimos 7 días */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Upselling generado — últimos 7 días
        </h3>
        {loading ? (
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyUpsell} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                tickFormatter={(v) =>
                  v >= 1000 ? `S/${(v / 1000).toFixed(0)}k` : `S/${v}`
                }
              />
              <Tooltip
                formatter={(value: any) => [
                  `S/ ${Number(value).toLocaleString("es-PE")}`,
                  "Upselling",
                ]}
                contentStyle={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              />
              <Bar dataKey="total" fill="#0d9488" radius={[6, 6, 0, 0]} barSize={55} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
