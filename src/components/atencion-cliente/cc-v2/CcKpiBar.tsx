"use client";

import { KpisCC, TipoGestionCC } from "@/interfaces/IOrder";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface StatItem {
  key: string;
  label: string;
  sub: string;
  valueClass: string;
  isPercent?: boolean;
}

const STATUS_STATS: Record<TipoGestionCC, StatItem[]> = {
  cod: [
    { key: "por_confirmar", label: "Por confirmar",  sub: "COD sin contactar",       valueClass: "text-red-600" },
    { key: "contactado",    label: "Contactado",      sub: "Link adelanto enviado",   valueClass: "text-blue-600" },
    { key: "no_contesta",   label: "No contesta",     sub: "Sin respuesta",           valueClass: "text-amber-600" },
    { key: "reprogramado",  label: "Reprogramado",    sub: "Nueva fecha",             valueClass: "text-violet-600" },
  ],
  lima: [
    { key: "entrega_lima",  label: "Por coordinar",   sub: "Pendiente de llamada",   valueClass: "text-teal-600" },
    { key: "no_contesta",   label: "No contesta",     sub: "Sin respuesta",           valueClass: "text-amber-600" },
    { key: "reprogramado",  label: "Reprogramados",   sub: "Nueva fecha acordada",    valueClass: "text-gray-600" },
  ],
  carrito: [
    { key: "carrito_sin_contactar", label: "Asignados",   sub: "Sin primer contacto",    valueClass: "text-purple-600" },
    { key: "carrito_contactado",    label: "Contactados",  sub: "En proceso de recupero", valueClass: "text-blue-600" },
  ],
};

interface Props {
  tipoGestion: TipoGestionCC;
  kpis: KpisCC | undefined;
  loading: boolean;
}

function StatCard({ item, value, loading }: { item: StatItem; value: number; loading: boolean }) {
  const display = loading ? "—" : item.isPercent ? `${value}%` : String(value);
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3.5 py-3">
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">{item.label}</p>
      <p className={`text-2xl font-black tracking-tight ${item.valueClass}`}>{display}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{item.sub}</p>
    </div>
  );
}

export function CcKpiBar({ tipoGestion, kpis, loading }: Props) {
  const statusCards = STATUS_STATS[tipoGestion];
  const today = new Date();
  const monthLabel = format(today, "MMMM yyyy", { locale: es });
  const todayLabel = format(today, "dd/MM/yyyy", { locale: es });

  const isCarrito = tipoGestion === "carrito";

  const periodDayStats: StatItem[] = [
    {
      key: "efectividadHoy",
      label: isCarrito ? "Tasa recupero hoy" : "Efectividad hoy",
      sub: isCarrito ? "Recuperados / asignados" : "Confirmados / gestionados",
      valueClass: "text-purple-600",
      isPercent: true,
    },
    {
      key: "upsellHoy",
      label: "Upsell hoy",
      sub: "Productos agregados por CC",
      valueClass: "text-orange-600",
    },
  ];

  const periodMonthStats: StatItem[] = [
    {
      key: "confirmadosMes",
      label: isCarrito ? "Recuperados mes" : "Confirmados mes",
      sub: "Acumulado mensual",
      valueClass: "text-green-600",
    },
    {
      key: "efectividadMes",
      label: isCarrito ? "Tasa recupero mes" : "Efectividad mes",
      sub: isCarrito ? "Recuperados / asignados" : "Confirmados / gestionados",
      valueClass: "text-purple-600",
      isPercent: true,
    },
    {
      key: "upsellMensual",
      label: "Upsell del mes",
      sub: "Productos agregados por CC",
      valueClass: "text-orange-600",
    },
  ];

  return (
    <div className="space-y-2.5">
      {/* Fila de estados actuales (punto en el tiempo) */}
      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: `repeat(${statusCards.length}, minmax(0, 1fr))` }}
      >
        {statusCards.map((card) => (
          <StatCard key={card.key} item={card} value={kpis?.[card.key] ?? 0} loading={loading} />
        ))}
      </div>

      {/* Fila de KPIs duales: HOY vs MES */}
      <div className="grid grid-cols-2 gap-3">
        {/* Panel HOY */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-900 p-3">
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-2.5">
            Resumen del día · {todayLabel}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2.5">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                {isCarrito ? "Recuperados hoy" : "Confirmados hoy"}
              </p>
              <p className="text-2xl font-black tracking-tight text-green-600">
                {loading ? "—" : (kpis?.["confirmado"] ?? 0)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">Pasaron a Ventas</p>
            </div>
            {periodDayStats.map((item) => (
              <StatCard key={item.key} item={item} value={kpis?.[item.key] ?? 0} loading={loading} />
            ))}
          </div>
        </div>

        {/* Panel MES */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-900 p-3">
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2.5">
            Acumulado del mes · {monthLabel}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {periodMonthStats.map((item) => (
              <StatCard key={item.key} item={item} value={kpis?.[item.key] ?? 0} loading={loading} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
