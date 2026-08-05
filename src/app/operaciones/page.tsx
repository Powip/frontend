"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useRouter } from "next/navigation";
import {
  Package,
  Truck,
  AlertTriangle,
  Wallet,
  ScanLine,
  Building2,
  CheckCircle2,
  Ban,
  Link2,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { OrderHeader } from "@/interfaces/IOrder";
import {
  getPedidosTab,
  isFailedDelivery,
  hasCourierSyncError,
  SHIPPING_STATUSES,
} from "@/utils/domain/operations-pedidos-tabs";
import { GUIDE_AGE_THRESHOLDS } from "@/constants/operationsDomain";
import { GlobalScanner } from "./_shared/GlobalScanner";
import { PowipPulseLoader } from "./_shared/PowipPulseLoader";

/* -----------------------------------------------------------------------
   Tablero de Operaciones.
   "La foto de hoy en 10 segundos": KPIs + Bandeja de Atención + efectividad
   por courier. Reemplaza el tablero que hoy no existe como pantalla propia
   (estaba disuelto entre Centro de Envíos y nada más) — ver auditoría del
   2026-07-27, hallazgo de "Tablero" como pieza nueva.
------------------------------------------------------------------------ */

function daysSince(dateStr?: string | null): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function money(n: number): string {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function paidAmount(order: OrderHeader): number {
  return (order.payments ?? [])
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

/** Mejor esfuerzo para categorizar el motivo de fallo a partir de texto libre del courier.
 *  No existe hoy un enum estructurado de motivos — ver informe de brechas de backend. */
function guessFailureReason(order: OrderHeader): string {
  const raw = `${order.shalomError ?? ""} ${Object.values(order.syncErrors ?? {}).join(" ")}`.toLowerCase();
  if (!raw.trim()) return "Sin detalle del courier";
  if (raw.includes("no recog") || raw.includes("no recoge")) return "Cliente no recoge en agencia";
  if (raw.includes("direcci") || raw.includes("ubicaci")) return "Dirección incorrecta";
  if (raw.includes("rechaz")) return "Rechazó el pedido";
  if (raw.includes("no contest") || raw.includes("sin respuesta")) return "No contesta el teléfono";
  return "Otro motivo (sin categorizar)";
}

export default function OperacionesTableroPage() {
  const { selectedStoreId } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoading(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`,
      );
      setOrders(res.data ?? []);
    } catch {
      // silencioso: el tablero no es la pantalla de trabajo, si falla se
      // ve vacío y el usuario puede refrescar
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    load();
  }, [load]);

  const shippingOrders = useMemo(
    () => orders.filter((o) => o.deliveryType === "DOMICILIO" && SHIPPING_STATUSES.includes(o.status)),
    [orders],
  );

  const tabCounts = useMemo(() => {
    const counts = { despachar: 0, camino: 0, atencion: 0 };
    let porDespacharPendiente = 0;
    let porDespacharProvincia = 0;
    let enCaminoMas15 = 0;
    let atencionEnJuego = 0;
    for (const o of shippingOrders) {
      const tab = getPedidosTab(o);
      const pending = Number(o.grandTotal || 0) - paidAmount(o);
      if (tab === "despachar") {
        counts.despachar++;
        porDespacharPendiente += pending;
        if (o.salesRegion === "PROVINCIA") porDespacharProvincia++;
      } else if (tab === "camino") {
        counts.camino++;
        if (daysSince(o.updated_at) > 15) enCaminoMas15++;
      } else if (tab === "atencion") {
        counts.atencion++;
        atencionEnJuego += pending;
      }
    }
    return { counts, porDespacharPendiente, porDespacharProvincia, enCaminoMas15, atencionEnJuego };
  }, [shippingOrders]);

  const porLiquidar = useMemo(() => {
    // Aproximado: entregado con saldo pendiente registrado. No existe
    // todavía un campo "liquidado" en el pedido — ver informe de brechas de
    // backend, sección Liquidaciones.
    return shippingOrders
      .filter((o) => o.status === "ENTREGADO")
      .reduce((sum, o) => sum + Math.max(0, Number(o.grandTotal || 0) - paidAmount(o)), 0);
  }, [shippingOrders]);

  const bandeja = useMemo(() => {
    const listosParaEscanear = shippingOrders.filter(
      (o) => !!o.guideNumber && o.status !== "EN_ENVIO" && o.status !== "ENTREGADO",
    ).length;
    const erroresAgencia = shippingOrders.filter(hasCourierSyncError).length;
    const agenciaPorVencer = shippingOrders.filter(
      (o) =>
        o.status === "EN_ENVIO" &&
        o.shalomStatus === "EN_DESTINO" &&
        daysSince(o.updated_at) >= GUIDE_AGE_THRESHOLDS.proximoDias,
    ).length;
    const porConfirmar = shippingOrders.filter(
      (o) => o.shalomStatus === "ENTREGADO" && o.status !== "ENTREGADO",
    ).length;
    const fallidos = shippingOrders.filter(isFailedDelivery).length;
    const sinTracking = orders.filter(
      (o) => !o.guideNumber && !o.externalTrackingNumber && !!o.externalSource,
    ).length;
    return { listosParaEscanear, erroresAgencia, agenciaPorVencer, porConfirmar, fallidos, sinTracking };
  }, [shippingOrders, orders]);

  const courierStats = useMemo(() => {
    const byCourier = new Map<
      string,
      { despachados: number; entregados: number; fallidos: number; costos: number[]; dias: number[] }
    >();
    for (const o of shippingOrders) {
      const courier = o.courier?.trim();
      if (!courier) continue;
      if (!byCourier.has(courier)) {
        byCourier.set(courier, { despachados: 0, entregados: 0, fallidos: 0, costos: [], dias: [] });
      }
      const stat = byCourier.get(courier)!;
      stat.despachados++;
      if (o.status === "ENTREGADO") {
        stat.entregados++;
        stat.dias.push(daysSince(o.created_at));
      }
      if (isFailedDelivery(o)) stat.fallidos++;
      if (o.carrierShippingCost) stat.costos.push(Number(o.carrierShippingCost));
    }
    return Array.from(byCourier.entries())
      .map(([courier, s]) => ({
        courier,
        despachados: s.despachados,
        entregados: s.entregados,
        fallidos: s.fallidos,
        efectividad: s.despachados ? Math.round((s.entregados / s.despachados) * 100) : 0,
        diasProm: s.dias.length ? (s.dias.reduce((a, b) => a + b, 0) / s.dias.length).toFixed(1) : "—",
        costoProm: s.costos.length ? s.costos.reduce((a, b) => a + b, 0) / s.costos.length : null,
      }))
      .sort((a, b) => b.despachados - a.despachados);
  }, [shippingOrders]);

  const failureReasons = useMemo(() => {
    const failed = shippingOrders.filter(isFailedDelivery);
    const byReason = new Map<string, { count: number; monto: number }>();
    for (const o of failed) {
      const reason = guessFailureReason(o);
      const pending = Math.max(0, Number(o.grandTotal || 0) - paidAmount(o));
      const entry = byReason.get(reason) ?? { count: 0, monto: 0 };
      entry.count++;
      entry.monto += pending;
      byReason.set(reason, entry);
    }
    return Array.from(byReason.entries())
      .map(([reason, v]) => ({ reason, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [shippingOrders]);

  const goPedidos = (tab: string, qf?: string) =>
    router.push(`/operaciones/pedidos?tab=${tab}${qf ? `&qf=${qf}` : ""}`);
  const goGuias = (tab: string, qf?: string) =>
    router.push(`/operaciones/guias?tab=${tab}${qf ? `&qf=${qf}` : ""}`);

  const handleExportTablero = () => {
    const workbook = XLSX.utils.book_new();

    const kpiSheet = XLSX.utils.json_to_sheet([
      { KPI: "Por despachar", Valor: tabCounts.counts.despachar, Detalle: `${money(tabCounts.porDespacharPendiente)} por cobrar · ${tabCounts.porDespacharProvincia} a provincia` },
      { KPI: "En camino", Valor: tabCounts.counts.camino, Detalle: `${tabCounts.enCaminoMas15} con más de 15 días` },
      { KPI: "Necesita atención", Valor: tabCounts.counts.atencion, Detalle: `${money(tabCounts.atencionEnJuego)} en juego` },
      { KPI: "Por liquidar (aprox.)", Valor: money(porLiquidar), Detalle: "Cobrado por courier, ver Liquidaciones" },
    ]);
    XLSX.utils.book_append_sheet(workbook, kpiSheet, "KPIs");

    const courierSheet = XLSX.utils.json_to_sheet(
      courierStats.map((c) => ({
        Courier: c.courier,
        Despachados: c.despachados,
        Entregados: c.entregados,
        Fallidos: c.fallidos,
        "Efectividad %": c.efectividad,
        "Días prom.": c.diasProm,
        "Costo x envío": c.costoProm ? c.costoProm.toFixed(2) : "-",
      })),
    );
    XLSX.utils.book_append_sheet(workbook, courierSheet, "Efectividad por courier");

    const motivosSheet = XLSX.utils.json_to_sheet(
      failureReasons.map((f) => ({ Motivo: f.reason, Casos: f.count, "S/ en juego": f.monto.toFixed(2) })),
    );
    XLSX.utils.book_append_sheet(workbook, motivosSheet, "Motivos de fallo");

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `tablero_operaciones_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  if (loading) {
    return <PowipPulseLoader label="Cargando..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Tablero de Operaciones</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            La foto de hoy en 10 segundos: qué hay que mover, qué está trabado y cuánta plata está en la calle.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="gap-1.5 bg-violet-600 text-white hover:bg-violet-700"
            onClick={() => setScannerOpen(true)}
          >
            <ScanLine className="h-4 w-4" />
            Escanear
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportTablero}>
            <FileSpreadsheet className="h-4 w-4" />
            Exportar tablero
          </Button>
        </div>
      </div>

      <GlobalScanner open={scannerOpen} onOpenChange={setScannerOpen} />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Package className="h-4 w-4" />}
          color="teal"
          label="Por despachar"
          value={tabCounts.counts.despachar}
          sub={`${money(tabCounts.porDespacharPendiente)} por cobrar · ${tabCounts.porDespacharProvincia} a provincia`}
          onClick={() => goPedidos("despachar")}
        />
        <Kpi
          icon={<Truck className="h-4 w-4" />}
          color="blue"
          label="En camino"
          value={tabCounts.counts.camino}
          sub={`${tabCounts.enCaminoMas15} con más de 15 días`}
          onClick={() => goPedidos("camino")}
        />
        <Kpi
          icon={<AlertTriangle className="h-4 w-4" />}
          color="red"
          label="Necesita atención"
          value={tabCounts.counts.atencion}
          sub={`${money(tabCounts.atencionEnJuego)} en juego`}
          onClick={() => goPedidos("atencion")}
        />
        <Kpi
          icon={<Wallet className="h-4 w-4" />}
          color="amber"
          label="Por liquidar (aprox.)"
          value={money(porLiquidar)}
          sub="Cobrado por courier, ver Liquidaciones"
          onClick={() => router.push("/operaciones/liquidaciones")}
        />
      </div>

      {/* Bandeja de Atención */}
      <div>
        <h2 className="mb-3 text-lg font-bold">📥 Bandeja de Atención</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <BandejaCard
            icon={<ScanLine className="h-4 w-4" />}
            color="purple"
            title="Listos para escanear"
            desc="Pedidos con guía esperando despacho"
            n={bandeja.listosParaEscanear}
            onClick={() => goPedidos("despachar", "listos-escanear")}
          />
          <BandejaCard
            icon={<AlertTriangle className="h-4 w-4" />}
            color="red"
            title="Errores de agencia"
            desc="Registros con error de courier"
            n={bandeja.erroresAgencia}
            onClick={() => goPedidos("atencion", "errores-agencia")}
          />
          <BandejaCard
            icon={<Building2 className="h-4 w-4" />}
            color="amber"
            title="Agencia por vencer"
            desc={`Pedidos con +${GUIDE_AGE_THRESHOLDS.proximoDias} días en agencia`}
            n={bandeja.agenciaPorVencer}
            onClick={() => goPedidos("camino", "agencia-por-vencer")}
          />
          <BandejaCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            color="green"
            title="Por confirmar"
            desc="Entregas por confirmar + cobro"
            n={bandeja.porConfirmar}
            onClick={() => goPedidos("camino", "por-confirmar")}
          />
          <BandejaCard
            icon={<Ban className="h-4 w-4" />}
            color="rose"
            title="Fallidos"
            desc="Pedidos devueltos — reasignar"
            n={bandeja.fallidos}
            onClick={() => goPedidos("atencion", "fallidos")}
          />
          <BandejaCard
            icon={<Link2 className="h-4 w-4" />}
            color="blue"
            title="Sin tracking"
            desc="Pedidos externos sin guía vinculada"
            n={bandeja.sinTracking}
            onClick={() => goGuias("rastreo", "sin-tracking")}
          />
        </div>
      </div>

      {/* Efectividad + motivos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-bold">Efectividad de entrega por courier</h3>
          <p className="mb-4 text-xs text-muted-foreground">Entregados sobre despachados, datos de la tienda actual</p>
          {courierStats.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin envíos con courier todavía</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Courier</th>
                    <th className="py-2 pr-3">Despachados</th>
                    <th className="py-2 pr-3">Entregados</th>
                    <th className="py-2 pr-3">Fallidos</th>
                    <th className="py-2 pr-3">Efectividad</th>
                    <th className="py-2 pr-3">Días prom.</th>
                    <th className="py-2 pr-3">Costo x envío</th>
                  </tr>
                </thead>
                <tbody>
                  {courierStats.map((c) => (
                    <tr key={c.courier} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-semibold">{c.courier}</td>
                      <td className="py-2 pr-3 tabular-nums">{c.despachados}</td>
                      <td className="py-2 pr-3 tabular-nums">{c.entregados}</td>
                      <td className="py-2 pr-3 tabular-nums text-red-600">{c.fallidos}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            c.efectividad >= 90
                              ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                              : c.efectividad >= 80
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                              : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                          }`}
                        >
                          {c.efectividad}%
                        </span>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{c.diasProm}d</td>
                      <td className="py-2 pr-3 tabular-nums">{c.costoProm ? money(c.costoProm) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-bold">Dónde se traba</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Motivo de los {failureReasons.reduce((a, b) => a + b.count, 0)} fallidos abiertos
          </p>
          {failureReasons.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin fallidos abiertos 🎉</p>
          ) : (
            <div className="space-y-2">
              {failureReasons.map((f) => (
                <div key={f.reason} className="flex items-center justify-between border-b pb-2 text-sm last:border-0">
                  <span>{f.reason}</span>
                  <span className="flex items-center gap-3">
                    <b className="tabular-nums">{f.count}</b>
                    <b className="tabular-nums text-red-600">{money(f.monto)}</b>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const KPI_COLOR: Record<string, string> = {
  teal: "border-l-teal-500 text-teal-600 dark:text-teal-400",
  blue: "border-l-blue-500 text-blue-600 dark:text-blue-400",
  red: "border-l-red-500 text-red-600 dark:text-red-400",
  amber: "border-l-amber-500 text-amber-600 dark:text-amber-400",
};

function Kpi({
  icon,
  color,
  label,
  value,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: number | string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border border-l-4 bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${KPI_COLOR[color]}`}
    >
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </button>
  );
}

const BANDEJA_BORDER: Record<string, string> = {
  purple: "border-l-violet-500",
  red: "border-l-red-500",
  amber: "border-l-amber-500",
  green: "border-l-green-500",
  rose: "border-l-pink-500",
  blue: "border-l-blue-500",
};
const BANDEJA_NUM: Record<string, string> = {
  purple: "text-violet-600 dark:text-violet-400",
  red: "text-red-600 dark:text-red-400",
  amber: "text-amber-600 dark:text-amber-400",
  green: "text-green-600 dark:text-green-400",
  rose: "text-pink-600 dark:text-pink-400",
  blue: "text-blue-600 dark:text-blue-400",
};

function BandejaCard({
  icon,
  color,
  title,
  desc,
  n,
  onClick,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  desc: string;
  n: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col gap-1 rounded-xl border border-l-4 bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${BANDEJA_BORDER[color]}`}
    >
      <span className="text-lg">{icon}</span>
      <span className="pr-10 font-bold">{title}</span>
      <span className="pr-10 text-xs text-muted-foreground">{desc}</span>
      <span className={`absolute right-4 top-4 text-2xl font-extrabold ${BANDEJA_NUM[color]}`}>{n}</span>
    </button>
  );
}
