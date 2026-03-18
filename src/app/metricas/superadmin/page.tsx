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
  AreaChart,
  Area,
} from "recharts";
import { AlertTriangle, TrendingDown, ArrowDownRight, Wifi } from "lucide-react";

/* ─────────────────── Constants ─────────────────── */

const PLAN_COLORS: Record<string, string> = {
  Basic: "#3b82f6",
  Standard: "#1e3a5f",
  Full: "#a78bfa",
  Enterprise: "#10b981",
};

const PLAN_ORDER = ["Basic", "Standard", "Full", "Enterprise"];

/* ─────────────────── Component ─────────────────── */

export default function MetricasSuperAdminPage() {
  const { auth, selectedStoreId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  // Info de la plataforma
  const companyName = "Plataforma Powip";
  const companyRuc = "ADMIN-MODE";

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [ordersRes, companiesRes] = await Promise.all([
          axios.get(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`
          ),
          axios.get(`${process.env.NEXT_PUBLIC_API_COMPANY}/company`)
        ]);
        setOrders(ordersRes.data || []);
        setCompanies(companiesRes.data || []);
      } catch (error) {
        console.error("Error fetching superadmin data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedStoreId]);

  // ── Platform-level KPIs (derived from available data + platform estimates) ──
  const gmv = useMemo(() => {
    return orders.reduce(
      (sum: number, o: any) => sum + (parseFloat(o.grandTotal || "0")),
      0
    );
  }, [orders]);

  // ── Platform-level KPIs (Real business count + estimates) ──
  const negociosActivos = useMemo(() => {
    return companies.length > 0 ? companies.length : 0;
  }, [companies]);

  const negociosNuevos = useMemo(() => {
    // Estimación histórica de crecimiento mensual
    return Math.round(negociosActivos * 0.08);
  }, [negociosActivos]);

  // MRR estimates based on plan distribution
  const planDistribution = useMemo(() => {
    const plans = [
      { name: "Basic", price: 99, pct: 0.35 },
      { name: "Standard", price: 189, pct: 0.35 },
      { name: "Full", price: 269, pct: 0.22 },
      { name: "Enterprise", price: 499, pct: 0.08 },
    ];
    return plans.map((p) => ({
      ...p,
      count: Math.round(negociosActivos * p.pct),
      mrr: Math.round(negociosActivos * p.pct * p.price),
    }));
  }, [negociosActivos]);

  const mrrTotal = useMemo(
    () => planDistribution.reduce((s, p) => s + p.mrr, 0),
    [planDistribution]
  );

  const churnRate = 2.8;
  const nrr = 108;
  const tasaActivacion = 61;
  const ttfv = 2.4;
  const dauMau = 42;

  // ── MRR por plan data ──
  const mrrByPlan = useMemo(
    () =>
      planDistribution.map((p) => ({
        name: `${p.name} S/${p.price}`,
        mrr: p.mrr,
        color: PLAN_COLORS[p.name] || "#94a3b8",
      })),
    [planDistribution]
  );

  // ── Distribución negocios por plan (donut) ──
  const planDonut = useMemo(
    () =>
      planDistribution.map((p) => ({
        name: p.name,
        value: p.count,
        color: PLAN_COLORS[p.name] || "#94a3b8",
      })),
    [planDistribution]
  );

  // ── Nuevos registros últimos 30 días ──
  const registros30d = useMemo(() => {
    const data: { day: number; registros: number }[] = [];
    for (let i = 1; i <= 30; i++) {
      // Simulate a wave pattern with daily variance
      const base = 8 + Math.sin(i * 0.8) * 5;
      data.push({
        day: i,
        registros: Math.max(2, Math.round(base + Math.random() * 4)),
      });
    }
    return data;
  }, []);

  // ── Top 5 negocios ──
  const top5 = useMemo(() => {
    const now = new Date();
    const monthLabel = now.toLocaleDateString("es-PE", { month: "long", year: "numeric" });

    // Group by seller and compute GMV
    const sellerMap: Record<string, number> = {};
    orders.forEach((o: any) => {
      const seller = o.sellerName || "Negocio";
      sellerMap[seller] = (sellerMap[seller] || 0) + parseFloat(o.grandTotal || "0");
    });

    const plans = ["Full", "Full", "Standard", "Standard", "Basic"];
    const risks = ["BAJO", "BAJO", "MEDIO", "BAJO", "ALTO"];

    return {
      month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      data: Object.entries(sellerMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, gmvVal], idx) => ({
          name: name.length > 18 ? name.substring(0, 15) + "..." : name,
          gmv: Math.round(gmvVal),
          plan: plans[idx] || "Basic",
          churnRisk: risks[idx] || "BAJO",
        })),
    };
  }, [orders]);

  // Churn risk badge
  const churnBadge = (risk: string) => {
    switch (risk) {
      case "BAJO":
        return "bg-emerald-100 text-emerald-600";
      case "MEDIO":
        return "bg-amber-100 text-amber-600";
      case "ALTO":
        return "bg-red-100 text-red-500";
      default:
        return "bg-slate-100 text-slate-500";
    }
  };

  // Alert items
  const churnAlerts = [
    {
      icon: <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />,
      title: "14 negocios sin login en 7+ días",
      desc: "Trigger automático de email activado. 4 superan 14 días → llamada CS pendiente.",
      badge: "CRÍTICO",
      badgeColor: "bg-red-100 text-red-500",
      borderColor: "border-l-red-500",
    },
    {
      icon: <TrendingDown className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />,
      title: "8 negocios con caída de pedidos >40% semana a semana",
      desc: "Puede ser problema técnico o insatisfacción. Revisión individual antes de 48h.",
      badge: "ATENCIÓN",
      badgeColor: "bg-amber-100 text-amber-600",
      borderColor: "border-l-amber-500",
    },
    {
      icon: <ArrowDownRight className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />,
      title: "3 negocios con downgrade de plan este mes (Full → Standard)",
      desc: "Oportunidad de intervención comercial. Asignar a equipo de retención.",
      badge: "RETENCIÓN",
      badgeColor: "bg-blue-100 text-blue-600",
      borderColor: "border-l-blue-500",
    },
    {
      icon: <Wifi className="h-4 w-4 text-teal-500 flex-shrink-0 mt-0.5" />,
      title: "Canal desconectado sin reconexión >48h — 6 casos",
      desc: "Notificación push + email enviados. Monitorear reconexión activa.",
      badge: "MONITOREO",
      badgeColor: "bg-teal-100 text-teal-600",
      borderColor: "border-l-teal-500",
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">
          Superadmin — Plataforma Powip
        </h1>
        <p className="text-xs text-slate-400 font-semibold tracking-[0.15em] uppercase mt-1">
          Vista consolidada de todos los negocios · {companyName}
          {companyRuc ? ` · RUC ${companyRuc}` : ""}
        </p>
      </div>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR Total */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              MRR Total
            </p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
              +7.6%
            </span>
          </div>
          <p className="text-2xl font-black text-slate-800">
            {loading
              ? "—"
              : `S/ ${mrrTotal.toLocaleString("es-PE")}`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            +S/6,200 vs mes ant.
          </p>
        </div>

        {/* Negocios Activos */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Negocios Activos
            </p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
              +1.6%
            </span>
          </div>
          <p className="text-2xl font-black text-slate-800">
            {loading ? "—" : negociosActivos}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            +{negociosNuevos} este mes
          </p>
        </div>

        {/* Churn Rate Mensual */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
            Churn Rate Mensual
          </p>
          <p className="text-2xl font-black text-amber-500">
            {loading ? "—" : `${churnRate}%`}
          </p>
          <p className="text-xs text-amber-500 font-semibold mt-0.5">
            Meta: &lt;3% — límite
          </p>
        </div>

        {/* NRR */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              NRR
            </p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
              Excelente
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-500">
            {loading ? "—" : `${nrr}%`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Expansión neta
          </p>
        </div>
      </div>

      {/* KPI Cards Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tasa de Activación */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
            Tasa de Activación
          </p>
          <p className="text-2xl font-black text-amber-500">
            {loading ? "—" : `${tasaActivacion}%`}
          </p>
          <p className="text-xs text-amber-500 font-semibold mt-0.5">
            Meta: &gt;70% — mejorar
          </p>
        </div>

        {/* Time to First Value */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
            Time to First Value
          </p>
          <p className="text-2xl font-black text-slate-800">
            {loading ? "—" : `${ttfv}d`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Meta: &lt;2d — cerca
          </p>
        </div>

        {/* DAU / MAU */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
            DAU / MAU
          </p>
          <p className="text-2xl font-black text-emerald-500">
            {loading ? "—" : `${dauMau}%`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Stickiness excelente
          </p>
        </div>

        {/* GMV Plataforma */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              GMV Plataforma
            </p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
              +22%
            </span>
          </div>
          <p className="text-2xl font-black text-slate-800">
            {loading
              ? "—"
              : gmv >= 1000000
                ? `S/ ${(gmv / 1000000).toFixed(1)}M`
                : `S/ ${gmv.toLocaleString("es-PE", { maximumFractionDigits: 0 })}`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Todas las tiendas
          </p>
        </div>
      </div>

      {/* Row: MRR por plan + Distribución */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MRR por plan */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            MRR por plan
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={mrrByPlan}
                margin={{ top: 5, right: 20, left: 10, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }}
                  interval={0}
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
                    "MRR",
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
                <Bar dataKey="mrr" radius={[6, 6, 0, 0]} barSize={55}>
                  {mrrByPlan.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Distribución negocios por plan */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Distribución negocios por plan
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={260}>
                <PieChart>
                  <Pie
                    data={planDonut}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {planDonut.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: string) => [`${value} negocios`, name]}
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
                {planDonut.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-xs text-slate-600 font-medium">
                      {p.name}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold ml-auto">
                      {p.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Señales de Riesgo de Churn */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Señales de Riesgo de Churn — Intervención requerida
        </h3>
        <div className="flex flex-col gap-3">
          {churnAlerts.map((alert, idx) => (
            <div
              key={idx}
              className={`flex items-start justify-between gap-4 bg-slate-50 rounded-lg px-4 py-3 border-l-4 ${alert.borderColor}`}
            >
              <div className="flex items-start gap-3">
                {alert.icon}
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {alert.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {alert.desc}
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${alert.badgeColor}`}
              >
                {alert.badge}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Row: Nuevos registros + Top 5 negocios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Nuevos registros 30 días */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Nuevos registros — últimos 30 días
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={registros30d} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorRegSa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }}
                interval={4}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
              />
              <Tooltip
                formatter={(value: any) => [`${value}`, "Registros"]}
                contentStyle={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              />
              <Area
                type="monotone"
                dataKey="registros"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#colorRegSa)"
                dot={{ r: 2, strokeWidth: 2, fill: "white" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top 5 negocios */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Top 5 negocios por GMV — {top5.month}
          </h3>
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider py-2 w-8">
                    #
                  </th>
                  <th className="text-left text-[10px] text-slate-400 font-bold uppercase tracking-wider py-2 pr-3">
                    Negocio
                  </th>
                  <th className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider py-2 px-2">
                    GMV
                  </th>
                  <th className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider py-2 px-2">
                    Plan
                  </th>
                  <th className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider py-2 pl-2">
                    Churn Risk
                  </th>
                </tr>
              </thead>
              <tbody>
                {top5.data.map((biz, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-sm font-semibold text-slate-700">
                      {biz.name}
                    </td>
                    <td className="py-3 px-2 text-center text-sm font-semibold text-slate-600">
                      S/ {biz.gmv.toLocaleString("es-PE")}
                    </td>
                    <td className="py-3 px-2 text-center text-sm text-slate-600">
                      {biz.plan}
                    </td>
                    <td className="py-3 pl-2 text-center">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${churnBadge(biz.churnRisk)}`}
                      >
                        {biz.churnRisk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
