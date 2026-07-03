"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Package,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  quoteAliclikOrder,
  createAliclikOrder,
  type AliclikOrderQuote,
  type AliclikCourierOption,
  type AliclikCreateOrderResult,
} from "@/services/aliclikService";

// ─── TIPOS ──────────────────────────────────────────────

/**
 * Shape mínimo requerido de cada pedido de la guía.
 * Compatible con OrderDetail de GuideDetailsModal.
 */
export interface AliclikGuideOrderItem {
  id: string;
  orderNumber: string;
  customer?: {
    fullName?: string;
    district?: string;
    city?: string;
    province?: string;
  };
}

interface WarehouseState {
  selectedCourierId: number | null;
  delivery: string;
}

interface OrderQuoteState {
  quoting: boolean;
  quoteError: string | null;
  quote: AliclikOrderQuote | null;
  warehouseStates: Record<number, WarehouseState>;
}

interface OrderSendResult {
  orderId: string;
  orderNumber: string;
  status: "success" | "error";
  result?: AliclikCreateOrderResult;
  error?: string;
}

// ─── PROPS ──────────────────────────────────────────────

export interface SendToAliclikGuideModalProps {
  open: boolean;
  guideId: string;
  companyId: string;
  orders: AliclikGuideOrderItem[];
  onClose: () => void;
  onSuccess: () => void;
}

// ─── HELPERS ────────────────────────────────────────────

function buildInitialWarehouseStates(
  quote: AliclikOrderQuote,
): Record<number, WarehouseState> {
  const initial: Record<number, WarehouseState> = {};
  quote.warehouses.forEach((wh) => {
    const firstCourier = wh.couriers[0] ?? null;
    initial[wh.warehouseId] = {
      selectedCourierId: firstCourier?.id ?? null,
      delivery: firstCourier
        ? String(firstCourier.deliveryCost)
        : String(quote.shippingTotalSugerido),
    };
  });
  return initial;
}

function buildShipmentsPayload(
  quote: AliclikOrderQuote,
  warehouseStates: Record<number, WarehouseState>,
) {
  return quote.warehouses
    .filter((wh) => {
      const state = warehouseStates[wh.warehouseId];
      return wh.couriers.length > 0 && state?.selectedCourierId != null;
    })
    .map((wh) => {
      const state = warehouseStates[wh.warehouseId];
      const courier = wh.couriers.find(
        (c) => c.id === state.selectedCourierId,
      ) as AliclikCourierOption;
      const parsedDelivery = Number(state.delivery);
      const delivery =
        state.delivery !== "" && !Number.isNaN(parsedDelivery)
          ? parsedDelivery
          : courier.deliveryCost;
      return {
        warehouseId: wh.warehouseId,
        delivery,
        courier: {
          transportId: courier.transportId,
          deliveryCost: courier.deliveryCost,
          returnCost: courier.returnCost,
          addDays: courier.addDays,
          flagDeliveryExpress: courier.flagDeliveryExpress,
          schedule: courier.schedule,
          scheduleExpressStart: courier.scheduleExpressStart,
          scheduleExpressEnd: courier.scheduleExpressEnd,
        },
      };
    });
}

function orderHasMissingCoords(quote: AliclikOrderQuote): boolean {
  const lat = quote.customer.lat;
  const lng = quote.customer.lng;
  return !lat || !lng || Number.isNaN(lat) || Number.isNaN(lng);
}

function orderCanSubmit(
  state: OrderQuoteState,
  sending: boolean,
): boolean {
  const { quote, warehouseStates } = state;
  if (!quote || sending) return false;
  if (quote.unresolvedItems.length > 0) return false;
  if (orderHasMissingCoords(quote)) return false;
  const allCovered = quote.warehouses.every((wh) => {
    if (wh.couriers.length === 0) return true;
    const ws = warehouseStates[wh.warehouseId];
    return ws?.selectedCourierId != null;
  });
  if (!allCovered) return false;
  return quote.warehouses.some(
    (wh) =>
      wh.couriers.length > 0 &&
      warehouseStates[wh.warehouseId]?.selectedCourierId != null,
  );
}

// ─── COMPONENTE ─────────────────────────────────────────

export default function SendToAliclikGuideModal({
  open,
  companyId: propCompanyId,
  orders,
  onClose,
  onSuccess,
}: SendToAliclikGuideModalProps) {
  const { auth } = useAuth();
  const companyId = propCompanyId || auth?.company?.id || "";
  const token = auth?.accessToken ?? "";

  // Estado de cotización por pedido (key = orderId)
  const [orderStates, setOrderStates] = useState<
    Record<string, OrderQuoteState>
  >({});

  // Estado de envío global
  const [sending, setSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [sendResults, setSendResults] = useState<OrderSendResult[]>([]);

  // ─── EFECTO: cotizar al abrir ────────────────────────

  useEffect(() => {
    if (!open || orders.length === 0 || !companyId || !token) return;

    // Reset completo
    setIsSuccess(false);
    setSendResults([]);
    setSending(false);

    // Inicializar estado y arrancar cotización para cada pedido
    const initialStates: Record<string, OrderQuoteState> = {};
    orders.forEach((order) => {
      initialStates[order.id] = {
        quoting: true,
        quoteError: null,
        quote: null,
        warehouseStates: {},
      };
    });
    setOrderStates(initialStates);

    // Cotizar todos en paralelo
    orders.forEach((order) => {
      quoteAliclikOrder(token, companyId, order.id)
        .then((data) => {
          setOrderStates((prev) => ({
            ...prev,
            [order.id]: {
              quoting: false,
              quoteError: null,
              quote: data,
              warehouseStates: buildInitialWarehouseStates(data),
            },
          }));
        })
        .catch((err: unknown) => {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? "Error al cotizar";
          setOrderStates((prev) => ({
            ...prev,
            [order.id]: {
              quoting: false,
              quoteError: msg,
              quote: null,
              warehouseStates: {},
            },
          }));
        });
    });
  }, [open, orders, companyId, token]);

  // ─── HANDLERS ────────────────────────────────────────

  const handleCourierChange = (
    orderId: string,
    warehouseId: number,
    courierId: string,
  ) => {
    setOrderStates((prev) => {
      const orderState = prev[orderId];
      if (!orderState?.quote) return prev;
      const wh = orderState.quote.warehouses.find(
        (w) => w.warehouseId === warehouseId,
      );
      const courier = wh?.couriers.find((c) => String(c.id) === courierId);
      return {
        ...prev,
        [orderId]: {
          ...orderState,
          warehouseStates: {
            ...orderState.warehouseStates,
            [warehouseId]: {
              selectedCourierId: courier?.id ?? null,
              delivery: courier
                ? String(courier.deliveryCost)
                : orderState.warehouseStates[warehouseId]?.delivery ?? "",
            },
          },
        },
      };
    });
  };

  const handleDeliveryChange = (
    orderId: string,
    warehouseId: number,
    value: string,
  ) => {
    setOrderStates((prev) => {
      const orderState = prev[orderId];
      if (!orderState) return prev;
      return {
        ...prev,
        [orderId]: {
          ...orderState,
          warehouseStates: {
            ...orderState.warehouseStates,
            [warehouseId]: {
              ...orderState.warehouseStates[warehouseId],
              delivery: value,
            },
          },
        },
      };
    });
  };

  // ─── VALIDACIÓN GLOBAL ───────────────────────────────

  const submittableOrders = useMemo(() => {
    return orders.filter((order) => {
      const state = orderStates[order.id];
      if (!state) return false;
      return orderCanSubmit(state, sending);
    });
  }, [orders, orderStates, sending]);

  const canSubmitAll = submittableOrders.length > 0 && !sending;

  // ─── ENVÍO SECUENCIAL ────────────────────────────────

  const handleSendAll = async () => {
    if (submittableOrders.length === 0 || !companyId) return;

    setSending(true);
    const results: OrderSendResult[] = [];

    for (const order of submittableOrders) {
      const state = orderStates[order.id];
      if (!state?.quote) continue;

      const shipments = buildShipmentsPayload(
        state.quote,
        state.warehouseStates,
      );

      try {
        const result = await createAliclikOrder(token, {
          companyId,
          orderId: order.id,
          shipments,
        });
        results.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: "success",
          result,
        });
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? "Error al crear pedido en Aliclik";
        results.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: "error",
          error: msg,
        });
      }
    }

    setSendResults(results);
    setSending(false);
    setIsSuccess(true);

    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    if (errorCount === 0) {
      toast.success(
        `${successCount} pedido${successCount !== 1 ? "s" : ""} creado${successCount !== 1 ? "s" : ""} en Aliclik correctamente`,
      );
    } else {
      toast.warning(
        `${successCount} de ${results.length} pedidos creados. ${errorCount} fallaron.`,
      );
    }

    onSuccess();
  };

  // ─── RENDER ───────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] p-0 bg-white dark:bg-slate-900 overflow-visible">
        <div
          className="relative flex flex-col"
          style={{ maxHeight: "calc(90vh - 2rem)" }}
        >
          {/* Header fijo */}
          <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b dark:border-slate-700 p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-500" />
                Enviar a Aliclik
                {orders.length > 0 && (
                  <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                    — {orders.length} pedido{orders.length !== 1 ? "s" : ""}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Contenido scrolleable */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-6 space-y-6">
              {orders.length === 0 ? (
                <div className="py-20 text-center text-slate-400 dark:text-slate-500">
                  No hay pedidos seleccionados
                </div>
              ) : isSuccess ? (
                /* ── PANTALLA DE RESULTADO ── */
                <div className="flex flex-col items-center justify-center py-16 space-y-8 animate-in fade-in zoom-in duration-500">
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-20 scale-150" />
                    <CheckCircle2 className="h-28 w-28 text-green-500 relative z-10" />
                  </div>

                  <div className="text-center space-y-3 max-w-md w-full">
                    <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                      {sendResults.every((r) => r.status === "success")
                        ? "¡Pedidos creados!"
                        : "¡Proceso completado!"}
                    </h2>

                    <div className="mt-4 space-y-3">
                      {/* Pedidos exitosos */}
                      {sendResults.filter((r) => r.status === "success")
                        .length > 0 && (
                        <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg text-left">
                          <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-3">
                            Pedidos creados en Aliclik:
                          </p>
                          <div className="space-y-2">
                            {sendResults
                              .filter((r) => r.status === "success")
                              .map((r) => (
                                <div key={r.orderId} className="space-y-1">
                                  <p className="text-xs font-semibold text-green-800 dark:text-green-300">
                                    #{r.orderNumber}
                                  </p>
                                  {r.result?.shipments.map((s) => (
                                    <div
                                      key={s.warehouseId}
                                      className="flex justify-between items-center text-xs py-0.5 pl-3 border-b border-green-100 dark:border-green-900 last:border-0"
                                    >
                                      <span className="text-green-700 dark:text-green-300">
                                        Almacén {s.warehouseId}
                                      </span>
                                      <span className="font-mono font-bold text-green-800 dark:text-green-400">
                                        {s.externalOrderNumber}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Pedidos fallidos */}
                      {sendResults.filter((r) => r.status === "error").length >
                        0 && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-left">
                          <p className="text-amber-800 dark:text-amber-400 font-bold text-sm mb-2">
                            {sendResults.filter((r) => r.status === "error")
                              .length}{" "}
                            pedido(s) fallaron:
                          </p>
                          <div className="text-xs text-amber-700 dark:text-amber-500 space-y-1 max-h-32 overflow-y-auto">
                            {sendResults
                              .filter((r) => r.status === "error")
                              .map((r) => (
                                <div
                                  key={r.orderId}
                                  className="flex items-start gap-2"
                                >
                                  <span className="font-mono text-amber-600 dark:text-amber-400">
                                    •
                                  </span>
                                  <span>
                                    <span className="font-semibold">
                                      #{r.orderNumber}:
                                    </span>{" "}
                                    {r.error}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={onClose}
                    className="bg-slate-900 hover:bg-black dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white px-12 h-12 font-bold rounded-2xl shadow-xl shadow-slate-200 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                  >
                    Entendido, cerrar
                  </Button>
                </div>
              ) : (
                /* ── PANTALLA DE CONFIGURACIÓN ── */
                <>
                  <div className="space-y-4">
                    {orders.map((order) => {
                      const state = orderStates[order.id];

                      return (
                        <Card
                          key={order.id}
                          className="overflow-hidden border-slate-200 dark:border-slate-700 dark:bg-slate-800"
                        >
                          <CardContent className="p-5 space-y-4">
                            {/* Cabecera del pedido */}
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-bold text-base text-slate-800 dark:text-slate-100">
                                  #{order.orderNumber}
                                </h4>
                                {order.customer?.fullName && (
                                  <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {order.customer.fullName}
                                    {(order.customer.district ||
                                      order.customer.city) && (
                                      <span>
                                        {" "}
                                        —{" "}
                                        {order.customer.district ||
                                          order.customer.city}
                                      </span>
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Estado: cotizando */}
                            {(!state || state.quoting) && (
                              <div className="flex items-center gap-3 py-4 text-slate-500 dark:text-slate-400">
                                <Loader2 className="h-5 w-5 animate-spin text-blue-500 shrink-0" />
                                <p className="text-sm font-medium">
                                  Cotizando en Aliclik...
                                </p>
                              </div>
                            )}

                            {/* Estado: error de cotización */}
                            {state && !state.quoting && state.quoteError && (
                              <div className="flex items-center gap-3 py-3">
                                <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
                                <p className="text-sm text-red-600 dark:text-red-400">
                                  {state.quoteError}
                                </p>
                              </div>
                            )}

                            {/* Estado: cotización cargada */}
                            {state && !state.quoting && state.quote && (
                              <>
                                {/* Banner ítems no enlazados — BLOQUEANTE */}
                                {state.quote.unresolvedItems.length > 0 && (
                                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex gap-3">
                                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-1">
                                        Productos no enlazados al catálogo
                                        Aliclik
                                      </p>
                                      <p className="text-xs text-amber-700 dark:text-amber-500 mb-2">
                                        No podés crear el pedido hasta enlazar
                                        estos productos al catálogo de Aliclik.
                                        Dalos de alta en Aliclik, corré la
                                        sincronización y verificá que el
                                        SKU/EAN coincida.
                                      </p>
                                      <ul className="text-xs text-amber-700 dark:text-amber-500 space-y-0.5">
                                        {state.quote.unresolvedItems.map(
                                          (item) => (
                                            <li
                                              key={item.sku}
                                              className="flex items-start gap-1"
                                            >
                                              <span className="text-amber-500">
                                                •
                                              </span>
                                              <span>
                                                <span className="font-mono">
                                                  {item.sku}
                                                </span>{" "}
                                                — {item.productName}
                                              </span>
                                            </li>
                                          ),
                                        )}
                                      </ul>
                                    </div>
                                  </div>
                                )}

                                {/* Banner coordenadas faltantes — BLOQUEANTE */}
                                {orderHasMissingCoords(state.quote) && (
                                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex gap-3">
                                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-1">
                                        Faltan coordenadas del cliente
                                        (lat/lng)
                                      </p>
                                      <p className="text-xs text-amber-700 dark:text-amber-500">
                                        Aliclik requiere la ubicación exacta
                                        del cliente para crear el pedido.
                                        Cargalas en la venta antes de enviar
                                        a Aliclik.
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Almacenes y couriers */}
                                <div className="space-y-3">
                                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Almacenes y couriers
                                  </p>

                                  {state.quote.warehouses.map((wh) => {
                                    const ws =
                                      state.warehouseStates[wh.warehouseId];
                                    const hasCoverage = wh.couriers.length > 0;
                                    const selectedCourier =
                                      ws?.selectedCourierId != null
                                        ? wh.couriers.find(
                                            (c) =>
                                              c.id === ws.selectedCourierId,
                                          )
                                        : undefined;

                                    return (
                                      <div
                                        key={wh.warehouseId}
                                        className={cn(
                                          "border rounded-lg p-3 space-y-3",
                                          hasCoverage
                                            ? "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30"
                                            : "border-red-200 dark:border-red-800/50 bg-red-50/30 dark:bg-red-950/10",
                                        )}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                              {wh.warehouseName}
                                            </p>
                                            {wh.ubigeo && (
                                              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                                {[
                                                  wh.ubigeo.district,
                                                  wh.ubigeo.province,
                                                  wh.ubigeo.department,
                                                ]
                                                  .filter(Boolean)
                                                  .join(", ")}
                                              </p>
                                            )}
                                          </div>
                                          {!hasCoverage && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 uppercase">
                                              Sin cobertura
                                            </span>
                                          )}
                                        </div>

                                        {/* Ítems del almacén */}
                                        <div className="space-y-0.5">
                                          {wh.items.map((item) => (
                                            <div
                                              key={item.sku}
                                              className="flex items-center justify-between text-xs py-0.5 border-b border-slate-100 dark:border-slate-700 last:border-0"
                                            >
                                              <div className="flex items-center gap-2">
                                                <span className="font-mono text-slate-400 dark:text-slate-500">
                                                  {item.sku}
                                                </span>
                                                <span className="text-slate-700 dark:text-slate-200">
                                                  {item.productName}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-3 shrink-0">
                                                <span className="text-slate-500 dark:text-slate-400">
                                                  ×{item.quantity}
                                                </span>
                                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                                  S/{" "}
                                                  {item.unitPrice.toFixed(2)}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>

                                        {/* Selección courier + delivery editable */}
                                        {hasCoverage ? (
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                              <Label
                                                htmlFor={`courier-${order.id}-${wh.warehouseId}`}
                                                className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                                              >
                                                Courier
                                              </Label>
                                              <Select
                                                value={
                                                  ws?.selectedCourierId != null
                                                    ? String(
                                                        ws.selectedCourierId,
                                                      )
                                                    : ""
                                                }
                                                onValueChange={(val) =>
                                                  handleCourierChange(
                                                    order.id,
                                                    wh.warehouseId,
                                                    val,
                                                  )
                                                }
                                              >
                                                <SelectTrigger
                                                  id={`courier-${order.id}-${wh.warehouseId}`}
                                                  className="h-8 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-slate-100 text-xs"
                                                >
                                                  <SelectValue placeholder="Seleccionar courier" />
                                                </SelectTrigger>
                                                <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                                                  {wh.couriers.map(
                                                    (courier) => (
                                                      <SelectItem
                                                        key={courier.id}
                                                        value={String(
                                                          courier.id,
                                                        )}
                                                        className="dark:focus:bg-slate-700 text-xs"
                                                      >
                                                        <div className="flex items-center gap-2">
                                                          <span>
                                                            {
                                                              courier.transportName
                                                            }
                                                          </span>
                                                          <span className="text-slate-500 dark:text-slate-400">
                                                            S/{" "}
                                                            {courier.deliveryCost.toFixed(
                                                              2,
                                                            )}
                                                          </span>
                                                          {courier.flagDeliveryExpress && (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 uppercase">
                                                              Express
                                                            </span>
                                                          )}
                                                        </div>
                                                      </SelectItem>
                                                    ),
                                                  )}
                                                </SelectContent>
                                              </Select>
                                              {selectedCourier && (
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                                                  Entrega estimada: +
                                                  {selectedCourier.addDays}{" "}
                                                  días
                                                </p>
                                              )}
                                            </div>

                                            <div className="space-y-1">
                                              <Label
                                                htmlFor={`delivery-${order.id}-${wh.warehouseId}`}
                                                className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                                              >
                                                Costo de envío (S/)
                                              </Label>
                                              <Input
                                                id={`delivery-${order.id}-${wh.warehouseId}`}
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                value={ws?.delivery ?? ""}
                                                onChange={(e) =>
                                                  handleDeliveryChange(
                                                    order.id,
                                                    wh.warehouseId,
                                                    e.target.value,
                                                  )
                                                }
                                                className="h-8 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-slate-100 text-xs"
                                              />
                                              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                                                Editable — prellenado con el
                                                courier elegido
                                              </p>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-800/50 rounded-lg text-xs text-red-600 dark:text-red-400">
                                            No hay couriers disponibles para
                                            este almacén. Este almacén no se
                                            incluirá en el pedido.
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Costo sugerido */}
                                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 rounded-lg p-3 flex justify-between items-center">
                                  <span className="text-xs font-bold">
                                    Costo de envío sugerido
                                  </span>
                                  <span className="font-mono font-bold text-sm">
                                    S/{" "}
                                    {state.quote.shippingTotalSugerido.toFixed(
                                      2,
                                    )}
                                  </span>
                                </div>

                                {/* Indicador de estado del pedido */}
                                {orderCanSubmit(state, sending) ? (
                                  <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                    <span>Listo para enviar</span>
                                  </div>
                                ) : state.quote.unresolvedItems.length > 0 ? (
                                  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                                    <span>
                                      Bloqueado — productos no enlazados
                                    </span>
                                  </div>
                                ) : orderHasMissingCoords(state.quote) ? (
                                  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                                    <span>
                                      Bloqueado — faltan coordenadas en la
                                      venta
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                    <span>
                                      Sin cobertura disponible — no se incluirá
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Resumen y botón de envío */}
                  <div className="pt-4 border-t dark:border-slate-700 space-y-4">
                    {/* Resumen de pedidos enviables */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        Pedidos a enviar
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {submittableOrders.length} de {orders.length}
                      </span>
                    </div>

                    {submittableOrders.length === 0 &&
                      !Object.values(orderStates).some(
                        (s) => s.quoting,
                      ) && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex gap-2 items-start">
                          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700 dark:text-amber-500">
                            Ningún pedido está listo para enviar. Revisá los
                            productos no enlazados, las coordenadas del cliente
                            en la venta o la cobertura de couriers.
                          </p>
                        </div>
                      )}

                    <Button
                      onClick={handleSendAll}
                      disabled={!canSubmitAll}
                      className="w-full h-12 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enviando pedidos...
                        </>
                      ) : (
                        `Enviar ${submittableOrders.length > 0 ? submittableOrders.length : "todos"} a Aliclik`
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
