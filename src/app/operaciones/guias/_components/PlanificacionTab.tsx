"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import {
  ArrowRight,
  Clock,
  Loader2,
  Package,
  FileSpreadsheet,
  CalendarClock,
  ListChecks,
  Eye,
  Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { useOperationsRole, OPS_PERMISSIONS } from "@/contexts/OperationsRoleContext";
import { useUserAuditInfo } from "@/hooks/useUserAuditInfo";
import { OrderHeader } from "@/interfaces/IOrder";
import { DELIVERY_ZONES } from "@/constants/operationsDomain";
import { getPedidosTab } from "@/utils/domain/operations-pedidos-tabs";
import {
  Sale,
  mapOrderToSale,
  formatProductsShort,
  openWhatsApp,
} from "@/app/operaciones/pedidos/_components/types";
import {
  StockIssueIcon,
  ZoneBadge,
  StatusPill,
  CallStatusBadge,
  PaymentButton,
  WhatsAppIcon,
} from "@/app/operaciones/pedidos/_components/shared";
import { SourceBadge } from "@/components/shared/SourceBadge";
import CustomerServiceModal from "@/components/modals/CustomerServiceModal";
import PaymentVerificationModal from "@/components/modals/PaymentVerificationModal";

/* -----------------------------------------------------------------------
   Planificación (v6) — ya no es solo pronóstico: los "agendados" (entregas
   reprogramadas y ventas con fecha comprometida) se confirman acá antes de
   caer a Pedidos › Por Despachar, solos a las 11:00 am o a mano. La guía se
   sigue armando únicamente desde Por Despachar — acá solo se confirma.

   BACKEND GAP: el "pase automático a las 11am" es un cron que no existe en
   ms-ventas. Lo que hay acá es la cuenta regresiva + el botón para adelantarlo
   a mano; sin el cron, si nadie abre esta pantalla ni confirma manualmente,
   los agendados de hoy NO se mueven solos. El toggle "Pase automático activo"
   es solo intención de UI, no hay nada que lo respalde en el servidor todavía.

   Tampoco existe un campo de "fecha de entrega comprometida" separado de
   `callbackAt` (que también sirve para reprogramar LLAMADAS) — se sigue
   usando la misma aproximación que ya tenía esta pantalla, distinguida por
   `callStatus` (SCHEDULED = reprogramado, CONFIRMED con fecha futura =
   vendido con fecha).
------------------------------------------------------------------------ */

const ZONE_MAP = new Map(DELIVERY_ZONES.map((z) => [z.value, z]));
const WEEK_LENGTH = 7;
const AUTO_PASS_HOUR = 11;

type SourceKey = "listos" | "reprogramado" | "vendido";
type ViewMode = "cal" | "list";

const SOURCE_LABEL: Record<SourceKey, string> = {
  listos: "📦 Preparado listo",
  reprogramado: "🔁 Reprogramado",
  vendido: "🛍️ Entrega hoy",
};

const SOURCE_BADGE_CLASS: Record<SourceKey, string> = {
  listos:
    "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30",
  reprogramado:
    "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  vendido:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
};

interface PlanItem {
  order: OrderHeader;
  source: SourceKey;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function money(n: number): string {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function nextAutoPass(): Date {
  const now = new Date();
  const target = new Date(now);
  target.setHours(AUTO_PASS_HOUR, 0, 0, 0);
  if (now >= target) target.setDate(target.getDate() + 1);
  return target;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "ahora";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function PlanificacionTab() {
  const { selectedStoreId } = useAuth();
  const { can } = useOperationsRole();
  const router = useRouter();
  const getUserInfo = useUserAuditInfo();

  const [orders, setOrders] = useState<OrderHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("cal");
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [autoPassOn, setAutoPassOn] = useState(true);
  const [countdown, setCountdown] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [paymentSale, setPaymentSale] = useState<Sale | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!selectedStoreId) return;
    setLoading(true);
    axios
      .get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/store/${selectedStoreId}`,
      )
      .then((res) => setOrders(res.data ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [selectedStoreId]);

  // Cuenta regresiva al próximo pase automático (solo visual, ver BACKEND GAP arriba).
  useEffect(() => {
    const tick = () =>
      setCountdown(formatCountdown(nextAutoPass().getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: WEEK_LENGTH }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const todayKey = dayKey(days[0]);

  const buckets = useMemo(() => {
    const map = new Map<string, PlanItem[]>();
    for (const d of days) map.set(dayKey(d), []);

    for (const o of orders) {
      if (o.deliveryType !== "DOMICILIO") continue;
      if (o.status === "ENTREGADO" || o.status === "ANULADO") continue;
      if (getPedidosTab(o) !== "despachar") continue;

      // Con fecha comprometida (reprogramado o vendido con fecha): es un
      // "agendado" del día que le corresponda, todavía no confirmado — se
      // clasifica ahí sin importar si esa fecha es hoy o a futuro.
      if (o.callbackAt) {
        const key = dayKey(new Date(o.callbackAt));
        if (map.has(key)) {
          const source: SourceKey =
            o.callStatus === "SCHEDULED" ? "reprogramado" : "vendido";
          map.get(key)?.push({ order: o, source });
        }
        continue;
      }

      // Sin fecha propia: preparado normal, ya listo — se muestra en "Hoy".
      map.get(todayKey)?.push({ order: o, source: "listos" });
    }
    return map;
  }, [orders, days, todayKey]);

  const activeDayKey = selectedDayKey ?? todayKey;
  const activeDayLabel = useMemo(() => {
    const d = days.find((x) => dayKey(x) === activeDayKey) ?? days[0];
    return d.toLocaleDateString("es-PE", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  }, [days, activeDayKey]);

  // "Agendados" = lo que todavía no está confirmado a Preparados (reprogramado / vendido con fecha).
  const agendados = useMemo(
    () =>
      (buckets.get(activeDayKey) ?? []).filter((it) => it.source !== "listos"),
    [buckets, activeDayKey],
  );

  const selectedItems = agendados.filter((it) => selectedIds.has(it.order.id));
  const totalPorCobrar = agendados.reduce(
    (sum, it) =>
      sum +
      Math.max(0, Number(it.order.grandTotal || 0) - paidAmount(it.order)),
    0,
  );

  const goDespachar = () => router.push("/operaciones/pedidos?tab=despachar");

  const openDayInList = (key: string) => {
    setSelectedDayKey(key);
    setViewMode("list");
    setSelectedIds(new Set());
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const allSelected = agendados.every((it) => prev.has(it.order.id));
      return allSelected
        ? new Set()
        : new Set(agendados.map((it) => it.order.id));
    });
  };

  const pasarAPreparados = async (ids: string[]) => {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await Promise.all(
        ids.map((id) =>
          axios.patch(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${id}`,
            {
              callStatus: "CONFIRMED",
              // Limpiar la fecha comprometida: tanto esta pantalla como Por
              // Despachar agrupan por `callbackAt` cuando existe — si no se
              // limpia, el pedido confirmado sigue cayendo en el mismo día
              // futuro en vez de pasar a "hoy".
              callbackAt: null,
              ...getUserInfo(),
            },
          ),
        ),
      );
      toast.success(
        ids.length === 1
          ? "Pedido confirmado — ya está en Por Despachar"
          : `${ids.length} pedidos confirmados — ya están en Por Despachar`,
      );
      setSelectedIds(new Set());
      load();
    } catch {
      toast.error("No se pudieron confirmar los pedidos");
    } finally {
      setBusy(false);
    }
  };

  const reprogramar = async () => {
    if (!rescheduleDate || selectedItems.length === 0) return;
    setBusy(true);
    try {
      await Promise.all(
        selectedItems.map((it) =>
          axios.patch(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${it.order.id}`,
            {
              callbackAt: new Date(rescheduleDate).toISOString(),
              ...getUserInfo(),
            },
          ),
        ),
      );
      toast.success("Reprogramado a otro día");
      setSelectedIds(new Set());
      setRescheduleDate("");
      load();
    } catch {
      toast.error("No se pudo reprogramar");
    } finally {
      setBusy(false);
    }
  };

  const handleExport = () => {
    if (agendados.length === 0) {
      toast.warning("No hay agendados para exportar");
      return;
    }
    const rows = agendados.map((it) => ({
      Pedido: it.order.orderNumber,
      Cliente: it.order.customer?.fullName ?? "-",
      Distrito: it.order.customer?.district ?? "-",
      Zona: it.order.customer?.zone ?? "-",
      "Por qué está agendado": SOURCE_LABEL[it.source],
      "Por cobrar": Math.max(
        0,
        Number(it.order.grandTotal || 0) - paidAmount(it.order),
      ).toFixed(2),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Agendados");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `agendados_${activeDayKey}.xlsx`,
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando
        planificación…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
          <button
            onClick={() => setViewMode("cal")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === "cal"
                ? "bg-background shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            Calendario semana
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === "list"
                ? "bg-background shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            <ListChecks className="h-3.5 w-3.5" />
            Agendados del día
          </button>
        </div>
      </div>

      {viewMode === "cal" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {days.map((d, idx) => (
            <DayCard
              key={dayKey(d)}
              date={d}
              isToday={idx === 0}
              items={buckets.get(dayKey(d)) ?? []}
              onVerAgendados={() => openDayInList(dayKey(d))}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Reloj de pase automático */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-500/30 dark:bg-violet-500/10">
            <Clock className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
            <div className="min-w-[220px] flex-1">
              <p className="text-sm font-bold text-violet-900 dark:text-violet-200">
                Pase automático a Preparados: hoy {AUTO_PASS_HOUR}:00 a.m.
              </p>
              <p className="text-xs text-violet-700 dark:text-violet-300">
                A esa hora POWIP mueve solo los agendados de hoy a Por
                Despachar. Si quieres adelantarlo, confírmalos manualmente acá
                abajo.
              </p>
            </div>
            <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-bold text-white">
              faltan {countdown}
            </span>
            <label className="flex items-center gap-2 text-xs font-semibold text-violet-700 dark:text-violet-300">
              <Switch checked={autoPassOn} onCheckedChange={setAutoPassOn} />
              Pase automático activo
            </label>
          </div>

          {selectedItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-violet-600 p-2.5 text-sm text-white shadow-sm">
              <span className="font-semibold">
                {selectedItems.length} agendados seleccionados
              </span>
              <div className="ml-1 h-5 w-px bg-white/30" />
              <Button
                size="sm"
                disabled={busy}
                className="h-8 gap-1 bg-white text-xs font-bold text-violet-700 hover:bg-white/90"
                onClick={() =>
                  pasarAPreparados(selectedItems.map((it) => it.order.id))
                }
              >
                <Package className="h-3.5 w-3.5" />
                Confirmar y pasar a Preparados ahora
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 border-white/40 bg-white/10 text-xs text-white hover:bg-white/20"
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    Reprogramar a otro día
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                  <p className="mb-2 text-xs font-semibold text-foreground">
                    Nueva fecha de entrega
                  </p>
                  <Input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={!rescheduleDate || busy}
                    className="mt-2 w-full"
                    onClick={reprogramar}
                  >
                    Reprogramar
                  </Button>
                </PopoverContent>
              </Popover>
              <button
                className="ml-auto text-white/80 hover:text-white"
                onClick={() => setSelectedIds(new Set())}
              >
                ✕
              </button>
            </div>
          )}

          <div className="rounded-xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
              <div>
                <h3 className="flex items-center gap-2 font-bold capitalize">
                  Agendados de {activeDayKey === todayKey ? "hoy" : ""} ·{" "}
                  {activeDayLabel}
                  <Badge className="border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300">
                    {agendados.length} por pasar
                  </Badge>
                </h3>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Estos aún <b>no están</b> en la cola de despacho. Cuando se
                  confirman (auto a las {AUTO_PASS_HOUR}am o manual acá), pasan
                  a <b>Por Despachar</b> y se juntan con las ventas del día. La
                  guía se arma allá, no acá.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={handleExport}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Exportar
                </Button>
                <Button
                  size="sm"
                  disabled={agendados.length === 0 || busy}
                  className="gap-1.5 bg-violet-600 text-white hover:bg-violet-700"
                  onClick={() =>
                    pasarAPreparados(agendados.map((it) => it.order.id))
                  }
                >
                  <Package className="h-4 w-4" />
                  Confirmar día → Preparados
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">
                      <Checkbox
                        checked={
                          agendados.length > 0 &&
                          agendados.every((it) => selectedIds.has(it.order.id))
                        }
                        onCheckedChange={toggleAll}
                      />
                    </th>
                    <th className="px-3 py-2">N° Orden</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Distrito</th>
                    <th className="px-3 py-2">Zona</th>
                    <th className="px-3 py-2">Productos</th>
                    <th className="px-3 py-2">Agendado</th>
                    <th className="px-3 py-2">Origen</th>
                    <th className="px-3 py-2 text-right">Total / Saldo</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Guía</th>
                    <th className="px-3 py-2">Courier</th>
                    <th className="px-3 py-2">Vendedor</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {agendados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={14}
                        className="py-10 text-center text-muted-foreground"
                      >
                        Nada agendado para este día.
                      </td>
                    </tr>
                  ) : (
                    agendados.map((it) => {
                      const sale = mapOrderToSale(it.order);
                      return (
                        <tr
                          key={it.order.id}
                          className="border-t hover:bg-muted/30"
                        >
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={selectedIds.has(sale.id)}
                              onCheckedChange={() => toggleOne(sale.id)}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">
                            <div className="flex items-center gap-1.5">
                              <StockIssueIcon show={sale.hasStockIssue} />
                              {sale.orderNumber}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{sale.clientName}</div>
                            <div className="text-xs text-muted-foreground">
                              {sale.phoneNumber}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-sm">
                            {sale.district || "—"}
                          </td>
                          <td className="px-3 py-2">
                            <ZoneBadge zone={sale.zone} />
                          </td>
                          <td className="px-3 py-2 max-w-[200px] whitespace-normal text-xs text-muted-foreground">
                            {formatProductsShort(sale.items)}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${SOURCE_BADGE_CLASS[it.source]}`}
                            >
                              {SOURCE_LABEL[it.source]}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <SourceBadge source={sale.externalSource} />
                          </td>
                          <td className="px-3 py-2 text-right text-sm tabular-nums">
                            {money(sale.total)}
                            {sale.pendingPayment > 0 && (
                              <div className="text-xs font-semibold text-red-600">
                                Saldo {money(sale.pendingPayment)}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <StatusPill status={sale.status} />
                              <CallStatusBadge sale={sale} />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-sm">
                            {sale.guideNumber || "—"}
                          </td>
                          <td className="px-3 py-2 text-sm">
                            {sale.courier || "—"}
                          </td>
                          <td className="px-3 py-2 text-sm">
                            {sale.sellerName || "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Ver pedido"
                                onClick={() => setViewOrderId(sale.id)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <PaymentButton
                                hasPendingApproval={sale.hasPendingApprovalPayments}
                                onClick={() => setPaymentSale(sale)}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-green-600 hover:text-green-700"
                                title="WhatsApp"
                                onClick={() =>
                                  openWhatsApp(
                                    sale.phoneNumber,
                                    sale.orderNumber,
                                    sale.clientName,
                                  )
                                }
                              >
                                <WhatsAppIcon className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Editar pedido"
                                onClick={() =>
                                  router.push(`/registrar-venta?orderId=${sale.id}`)
                                }
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Pasar a Preparados"
                                disabled={busy}
                                onClick={() => pasarAPreparados([sale.id])}
                              >
                                <Package className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
              <span>
                {agendados.length} agendados · al confirmar se suman a los que
                ya están en Por Despachar · {money(totalPorCobrar)} por cobrar
              </span>
              <div className="flex items-center gap-2">
                <span>Pase automático {AUTO_PASS_HOUR}:00 am</span>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={goDespachar}
                >
                  Ir a Por Despachar <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CustomerServiceModal
        open={!!viewOrderId}
        orderId={viewOrderId || ""}
        onClose={() => setViewOrderId(null)}
        onOrderUpdated={load}
        isOperaciones
        showTracking
      />

      <PaymentVerificationModal
        open={!!paymentSale}
        onClose={() => setPaymentSale(null)}
        orderId={paymentSale?.id || ""}
        orderNumber={paymentSale?.orderNumber || ""}
        onPaymentUpdated={load}
        canApprove={can(OPS_PERMISSIONS.APPROVE_PAYMENTS)}
      />
    </div>
  );
}

function paidAmount(order: OrderHeader): number {
  return (order.payments ?? [])
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

function DayCard({
  date,
  isToday,
  items,
  onVerAgendados,
}: {
  date: Date;
  isToday: boolean;
  items: PlanItem[];
  onVerAgendados: () => void;
}) {
  const zoneCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      const z = it.order.customer?.zone || "SIN_ZONA";
      m.set(z, (m.get(z) || 0) + 1);
    }
    return m;
  }, [items]);

  const label = date.toLocaleDateString("es-PE", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });

  return (
    <div
      className={`flex flex-col rounded-xl border bg-card shadow-sm ${isToday ? "border-teal-400" : ""}`}
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div>
          <p className="text-sm font-bold capitalize">{label}</p>
          {isToday && (
            <p className="text-[10px] font-bold uppercase text-teal-600">Hoy</p>
          )}
        </div>
        <Badge variant="outline" className="text-xs">
          {items.length}
        </Badge>
      </div>

      {zoneCounts.size > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pt-2">
          {Array.from(zoneCounts.entries()).map(([zone, count]) => (
            <span
              key={zone}
              className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]"
            >
              {ZONE_MAP.get(zone)?.emoji ?? "📍"} {count}
            </span>
          ))}
        </div>
      )}

      <div className="max-h-72 flex-1 space-y-1.5 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Sin movimientos
          </p>
        ) : (
          items.map((it) => (
            <div
              key={`${it.source}-${it.order.id}`}
              className="flex items-center justify-between gap-2 rounded-lg border bg-background px-2 py-1.5 text-xs"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Badge
                    className={`border px-1.5 py-0 text-[9px] ${SOURCE_BADGE_CLASS[it.source]}`}
                  >
                    {SOURCE_LABEL[it.source]}
                  </Badge>
                </div>
                <p className="truncate font-semibold">{it.order.orderNumber}</p>
                <p className="truncate text-muted-foreground">
                  {it.order.customer?.fullName}
                </p>
              </div>
              <span className="tabular-nums font-medium">
                {money(Number(it.order.grandTotal || 0))}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="p-3 pt-0">
        <Button
          size="sm"
          variant={isToday ? "default" : "outline"}
          className={`w-full justify-center gap-1.5 text-xs ${isToday ? "bg-teal-600 hover:bg-teal-700" : ""}`}
          onClick={onVerAgendados}
        >
          Ver agendados <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
