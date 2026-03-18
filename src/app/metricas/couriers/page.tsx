"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { fetchCouriers, Courier } from "@/services/courierService";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

/* ─────────────────── Types ─────────────────── */

interface ShippingGuide {
  id: string;
  guideNumber: string;
  storeId: string;
  courierId?: string | null;
  courierName?: string | null;
  status: string;
  deliveryType: string;
  amountToCollect?: number | null;
  created_at: string;
  updated_at: string;
}

interface CourierStat {
  name: string;
  envios: number;
  entrega: number; // %
  tiempoProm: number; // days
  devoluciones: number; // %
  costoProm: number;
  score: number;
  color: string;
}

const COURIER_COLORS = [
  "#0d9488", // teal-600
  "#1e3a5f", // navy
  "#d4a017", // gold
  "#6366f1", // indigo
  "#ec4899", // pink
  "#f59e0b", // amber
];

/* ─────────────────── Component ─────────────────── */

export default function MetricasCouriersPage() {
  const { auth, selectedStoreId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [guides, setGuides] = useState<ShippingGuide[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedStoreId || !auth?.company?.id) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [couriersData, guidesRes, ordersRes] = await Promise.all([
          fetchCouriers(auth.company!.id),
          axios.get<ShippingGuide[]>(
            `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/store/${selectedStoreId}`
          ),
          axios.get(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`
          ),
        ]);
        setCouriers(couriersData);
        setGuides(guidesRes.data || []);
        setOrders(ordersRes.data || []);
      } catch (error) {
        console.error("Error fetching courier metrics:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedStoreId, auth?.company?.id]);

  // ── Per-courier stats ──
  const courierStats: CourierStat[] = useMemo(() => {
    const map: Record<
      string,
      {
        envios: number;
        delivered: number;
        failed: number;
        deliveryTimeSum: number;
        deliveredCount: number;
        costSum: number;
      }
    > = {};

    // Initialize from couriers list
    couriers.forEach((c) => {
      map[c.name] = {
        envios: 0,
        delivered: 0,
        failed: 0,
        deliveryTimeSum: 0,
        deliveredCount: 0,
        costSum: 0,
      };
    });

    // Also pick up courier names from guides
    guides.forEach((g) => {
      const name = g.courierName || "Sin asignar";
      if (!map[name]) {
        map[name] = {
          envios: 0,
          delivered: 0,
          failed: 0,
          deliveryTimeSum: 0,
          deliveredCount: 0,
          costSum: 0,
        };
      }
      const s = map[name];
      s.envios++;

      if (g.status === "ENTREGADA") {
        s.delivered++;
        // Delivery time
        const created = new Date(g.created_at);
        const updated = new Date(g.updated_at);
        const days = Math.max(
          0.1,
          (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
        );
        s.deliveryTimeSum += days;
        s.deliveredCount++;
      }

      if (g.status === "FALLIDA" || g.status === "PARCIAL") {
        s.failed++;
      }

      if (g.amountToCollect) {
        s.costSum += Number(g.amountToCollect);
      }
    });

    // Also count from orders courier field
    orders.forEach((o: any) => {
      const name = o.courier;
      if (!name || map[name]) return; // skip if already counted or no courier
      if (!map[name]) {
        map[name] = {
          envios: 0,
          delivered: 0,
          failed: 0,
          deliveryTimeSum: 0,
          deliveredCount: 0,
          costSum: 0,
        };
      }
    });

    return Object.entries(map)
      .filter(([name]) => name !== "Sin asignar")
      .map(([name, s], idx) => {
        const entrega =
          s.envios > 0 ? Math.round((s.delivered / s.envios) * 100) : 0;
        const tiempoProm =
          s.deliveredCount > 0
            ? Number((s.deliveryTimeSum / s.deliveredCount).toFixed(1))
            : 0;
        const devoluciones =
          s.envios > 0 ? Math.round((s.failed / s.envios) * 100) : 0;
        const costoProm =
          s.envios > 0 ? Number((s.costSum / s.envios).toFixed(2)) : 0;

        // Score: weighted (entrega 40%, time 25%, devol 20%, cost 15%)
        const timeScore = tiempoProm > 0 ? Math.max(0, 100 - tiempoProm * 20) : 0;
        const devolScore = Math.max(0, 100 - devoluciones * 5);
        const costScore = costoProm > 0 ? Math.max(0, 100 - costoProm * 3) : 0;
        const score =
          s.envios > 0
            ? Math.round(
                entrega * 0.4 + timeScore * 0.25 + devolScore * 0.2 + costScore * 0.15
              )
            : -1; // -1 means no data

        return {
          name: name.length > 15 ? name.substring(0, 12) + "..." : name,
          envios: s.envios,
          entrega,
          tiempoProm,
          devoluciones,
          costoProm,
          score,
          color: COURIER_COLORS[idx % COURIER_COLORS.length],
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [couriers, guides, orders]);

  // ── KPIs ──
  const couriersActivos = useMemo(
    () => courierStats.filter((c) => c.envios > 0).length,
    [courierStats]
  );
  const totalCouriers = couriers.length;

  const enviosMes = useMemo(() => guides.length, [guides]);

  const costoPromedio = useMemo(() => {
    const withCost = courierStats.filter((c) => c.costoProm > 0);
    if (withCost.length === 0) return 0;
    return Number(
      (withCost.reduce((s, c) => s + c.costoProm, 0) / withCost.length).toFixed(2)
    );
  }, [courierStats]);

  const tasaEntregaGlobal = useMemo(() => {
    const totalEnvios = courierStats.reduce((s, c) => s + c.envios, 0);
    const totalDelivered = guides.filter((g) => g.status === "ENTREGADA").length;
    if (totalEnvios === 0) return 0;
    return Math.round((totalDelivered / totalEnvios) * 100);
  }, [courierStats, guides]);

  // Score badge color
  const scoreColor = (score: number) => {
    if (score < 0) return "bg-red-100 text-red-500";
    if (score >= 85) return "bg-emerald-100 text-emerald-600";
    if (score >= 70) return "bg-amber-100 text-amber-600";
    return "bg-red-100 text-red-500";
  };

  const entregaColor = (v: number) => (v >= 85 ? "text-emerald-500" : v > 0 ? "text-slate-700" : "text-red-400");

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">
          Couriers
        </h1>
        <p className="text-xs text-slate-400 font-semibold tracking-[0.15em] uppercase mt-1">
          Rendimiento y costos de entrega por courier
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Couriers activos */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
            Couriers Activos
          </p>
          <p className="text-2xl font-black text-slate-800">
            {loading ? "—" : couriersActivos}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            De {totalCouriers} configurados
          </p>
        </div>

        {/* Envíos del mes */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
            Envíos del Mes
          </p>
          <p className="text-2xl font-black text-slate-800">
            {loading ? "—" : enviosMes}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Total despachados
          </p>
        </div>

        {/* Costo promedio envío */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
            Costo Promedio Envío
          </p>
          <p className="text-2xl font-black text-slate-800">
            {loading ? "—" : `S/ ${costoPromedio.toFixed(2)}`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Por despacho
          </p>
        </div>

        {/* Tasa entrega global */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Tasa Entrega Global
            </p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
              +1%
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-500">
            {loading ? "—" : `${tasaEntregaGlobal}%`}
          </p>
          <p className="text-xs text-emerald-500 font-semibold mt-0.5">
            Meta: &gt;85% ✓
          </p>
        </div>
      </div>

      {/* Row 1: Tasa de entrega + Tiempo promedio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasa de entrega exitosa */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Tasa de entrega exitosa (%)
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={courierStats.filter((c) => c.envios > 0)}
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
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value: any) => [`${value}%`, "Tasa entrega"]}
                  contentStyle={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                />
                <Bar dataKey="entrega" radius={[6, 6, 0, 0]} barSize={55}>
                  {courierStats
                    .filter((c) => c.envios > 0)
                    .map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tiempo promedio entrega */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Tiempo promedio entrega (días)
          </h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={courierStats.filter((c) => c.tiempoProm > 0)}
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
                  tickFormatter={(v) => `${v}d`}
                />
                <Tooltip
                  formatter={(value: any) => [`${value} días`, "Tiempo promedio"]}
                  contentStyle={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                />
                <Bar dataKey="tiempoProm" radius={[6, 6, 0, 0]} barSize={55}>
                  {courierStats
                    .filter((c) => c.tiempoProm > 0)
                    .map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Envíos vs Devoluciones */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Envíos vs Devoluciones — últimos 30 días
        </h3>
        {loading ? (
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={courierStats.filter((c) => c.envios > 0).map((c) => ({
                name: c.name,
                envios: c.envios,
                devoluciones: Math.round(c.envios * (c.devoluciones / 100)),
              }))}
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
              />
              <Tooltip
                contentStyle={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                height={30}
                wrapperStyle={{ fontSize: "11px", fontWeight: 600 }}
              />
              <Bar
                dataKey="envios"
                name="Envíos"
                fill="#0d9488"
                radius={[6, 6, 0, 0]}
                barSize={40}
              />
              <Bar
                dataKey="devoluciones"
                name="Devoluciones"
                fill="#ef4444"
                radius={[6, 6, 0, 0]}
                barSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Ranking Couriers */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Ranking Couriers — Score Combinado
        </h3>
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider py-2 w-8">
                    #
                  </th>
                  <th className="text-left text-[10px] text-slate-400 font-bold uppercase tracking-wider py-2 pr-3">
                    Courier
                  </th>
                  <th className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider py-2 px-2">
                    Envíos
                  </th>
                  <th className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider py-2 px-2">
                    Tasa Entrega
                  </th>
                  <th className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider py-2 px-2">
                    Tiempo Prom.
                  </th>
                  <th className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider py-2 px-2">
                    Devoluciones
                  </th>
                  <th className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider py-2 px-2">
                    Costo Prom.
                  </th>
                  <th className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider py-2 pl-2">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {courierStats.map((courier, idx) => (
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
                      {courier.name}
                    </td>
                    <td className="py-3 px-2 text-center text-sm font-semibold text-slate-600">
                      {courier.envios}
                    </td>
                    <td
                      className={`py-3 px-2 text-center text-sm font-bold ${entregaColor(courier.entrega)}`}
                    >
                      {courier.entrega}%
                    </td>
                    <td className="py-3 px-2 text-center text-sm text-slate-600">
                      {courier.tiempoProm > 0 ? `${courier.tiempoProm}d` : "—"}
                    </td>
                    <td className="py-3 px-2 text-center text-sm text-slate-600">
                      {courier.envios > 0 ? `${courier.devoluciones}%` : "—"}
                    </td>
                    <td className="py-3 px-2 text-center text-sm text-slate-600">
                      S/ {courier.costoProm.toFixed(2)}
                    </td>
                    <td className="py-3 pl-2 text-center">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${scoreColor(courier.score)}`}
                      >
                        {courier.score >= 0 ? `${courier.score}/100` : "SIN DATOS"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
