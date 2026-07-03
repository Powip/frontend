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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, AlertCircle, Package } from "lucide-react";
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
import { updateClient } from "@/services/clients.service";

// ─── CONSTANTES ─────────────────────────────────────────

const CHANNEL_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "shopify", label: "Shopify" },
  { value: "web", label: "Web" },
  { value: "mensaje", label: "Mensaje" },
  { value: "llamada", label: "Llamada" },
] as const;

// Sentinel para el Select de channel (Radix no admite value="")
const CHANNEL_NONE = "__ninguno__";

// ─── TIPOS INTERNOS ─────────────────────────────────────

interface WarehouseState {
  selectedCourierId: number | null;
  delivery: string;
}

// ─── PROPS ──────────────────────────────────────────────

interface SendToAliclikModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  companyId?: string;
  clientId?: string;
  onSuccess?: () => void;
}

// ─── COMPONENTE ─────────────────────────────────────────

export default function SendToAliclikModal({
  open,
  onClose,
  orderId,
  companyId: propCompanyId,
  clientId,
  onSuccess,
}: SendToAliclikModalProps) {
  const { auth } = useAuth();
  const companyId = propCompanyId ?? auth?.company?.id;
  const token = auth?.accessToken ?? "";

  // Estado principal
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quote, setQuote] = useState<AliclikOrderQuote | null>(null);

  // Estado por almacén
  const [warehouseStates, setWarehouseStates] = useState<
    Record<number, WarehouseState>
  >({});

  // Campos globales opcionales
  const [channel, setChannel] = useState<string>(CHANNEL_NONE);
  const [note, setNote] = useState<string>("");

  // Override de coordenadas cuando el cliente no las tiene
  const [overrideLat, setOverrideLat] = useState("");
  const [overrideLng, setOverrideLng] = useState("");

  // Envío
  const [sending, setSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successResult, setSuccessResult] =
    useState<AliclikCreateOrderResult | null>(null);

  // ─── EFECTOS ──────────────────────────────────────────

  useEffect(() => {
    if (!open || !orderId || !companyId || !token) return;

    // Reset
    setQuote(null);
    setQuoteError(null);
    setWarehouseStates({});
    setChannel(CHANNEL_NONE);
    setNote("");
    setIsSuccess(false);
    setSuccessResult(null);
    setOverrideLat("");
    setOverrideLng("");

    // Cotizar
    setQuoting(true);
    quoteAliclikOrder(token, companyId, orderId)
      .then((data) => {
        setQuote(data);
        // Inicializar estado por almacén
        const initial: Record<number, WarehouseState> = {};
        data.warehouses.forEach((wh) => {
          const firstCourier = wh.couriers[0] ?? null;
          initial[wh.warehouseId] = {
            selectedCourierId: firstCourier?.id ?? null,
            delivery: firstCourier
              ? String(firstCourier.deliveryCost)
              : String(data.shippingTotalSugerido),
          };
        });
        setWarehouseStates(initial);
      })
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? "Error al cotizar el pedido en Aliclik";
        setQuoteError(msg);
        toast.error(msg);
      })
      .finally(() => setQuoting(false));
  }, [open, orderId, companyId, token]);

  // ─── HANDLERS ─────────────────────────────────────────

  const handleCourierChange = (warehouseId: number, courierId: string) => {
    if (!quote) return;
    const wh = quote.warehouses.find((w) => w.warehouseId === warehouseId);
    const courier = wh?.couriers.find((c) => String(c.id) === courierId);
    setWarehouseStates((prev) => ({
      ...prev,
      [warehouseId]: {
        selectedCourierId: courier?.id ?? null,
        delivery: courier ? String(courier.deliveryCost) : prev[warehouseId]?.delivery ?? "",
      },
    }));
  };

  const handleDeliveryChange = (warehouseId: number, value: string) => {
    setWarehouseStates((prev) => ({
      ...prev,
      [warehouseId]: {
        ...prev[warehouseId],
        delivery: value,
      },
    }));
  };

  // ─── COORDENADAS ──────────────────────────────────────

  const coordsMissing = useMemo(() => {
    if (!quote) return false;
    const lat = quote.customer.lat;
    const lng = quote.customer.lng;
    return !lat || !lng || Number.isNaN(lat) || Number.isNaN(lng);
  }, [quote]);

  const overrideLatNum = parseFloat(overrideLat);
  const overrideLngNum = parseFloat(overrideLng);
  const overrideCoordsValid =
    overrideLat.trim() !== "" &&
    overrideLng.trim() !== "" &&
    !Number.isNaN(overrideLatNum) &&
    !Number.isNaN(overrideLngNum);

  // ─── VALIDACIÓN ───────────────────────────────────────

  const canSubmit = useMemo(() => {
    if (!quote || sending) return false;
    // Bloquear si hay ítems sin enlace al catálogo Aliclik — el backend rechaza el pedido completo
    if (quote.unresolvedItems.length > 0) return false;
    // Si faltan coordenadas, el usuario debe ingresarlas manualmente
    const lat = quote.customer.lat;
    const lng = quote.customer.lng;
    const needsCoords = !lat || !lng || Number.isNaN(lat) || Number.isNaN(lng);
    if (needsCoords) {
      const latNum = parseFloat(overrideLat);
      const lngNum = parseFloat(overrideLng);
      const valid =
        overrideLat.trim() !== "" &&
        overrideLng.trim() !== "" &&
        !Number.isNaN(latNum) &&
        !Number.isNaN(lngNum);
      if (!valid) return false;
    }
    // Cada almacén CON cobertura debe tener courier seleccionado
    const allCovered = quote.warehouses.every((wh) => {
      if (wh.couriers.length === 0) return true; // sin cobertura: excluimos del payload pero no bloqueamos
      const state = warehouseStates[wh.warehouseId];
      return state?.selectedCourierId != null;
    });
    if (!allCovered) return false;
    // Debe haber al menos un almacén con cobertura y courier elegido
    const hasAtLeastOneShipment = quote.warehouses.some(
      (wh) =>
        wh.couriers.length > 0 &&
        warehouseStates[wh.warehouseId]?.selectedCourierId != null,
    );
    return hasAtLeastOneShipment;
  }, [quote, warehouseStates, sending, overrideLat, overrideLng]);

  // ─── SUBMIT ───────────────────────────────────────────

  const handleCreate = async () => {
    if (!quote || !companyId) return;
    // Guard defensivo: el backend rechaza el pedido completo si hay ítems no
    // enlazados. El botón ya está deshabilitado en ese caso (canSubmit), pero
    // evitamos enviar un pedido inválido si se invoca por otra vía.
    if (quote.unresolvedItems.length > 0) return;

    setSending(true);
    try {
      // Si faltan coordenadas y el usuario las completó, persistirlas en el cliente antes del POST
      if (coordsMissing && overrideCoordsValid) {
        if (!clientId) {
          toast.error("No se pudo determinar el cliente para guardar las coordenadas");
          setSending(false);
          return;
        }
        try {
          await updateClient(clientId, {
            companyId,
            latitude: overrideLatNum,
            longitude: overrideLngNum,
          });
        } catch {
          toast.error("Error al guardar las coordenadas del cliente");
          setSending(false);
          return;
        }
      }

      const shipments = quote.warehouses
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

      const payload = {
        companyId,
        orderId,
        ...(channel !== CHANNEL_NONE && { channel }),
        ...(note.trim() && { note: note.trim() }),
        shipments,
      };

      const result = await createAliclikOrder(token, payload);
      setSuccessResult(result);
      setIsSuccess(true);
      toast.success("Pedido creado en Aliclik correctamente");
      onSuccess?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Error al crear el pedido en Aliclik";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0 bg-white dark:bg-slate-900 overflow-visible">
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
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Contenido scrolleable */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-6 space-y-6">
              {/* Estado: Cotizando */}
              {quoting && (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                  <p className="text-sm font-medium">
                    Cotizando pedido en Aliclik...
                  </p>
                </div>
              )}

              {/* Estado: Error de cotización */}
              {!quoting && quoteError && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <AlertCircle className="h-12 w-12 text-red-400" />
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    {quoteError}
                  </p>
                  <Button variant="outline" onClick={onClose}>
                    Cerrar
                  </Button>
                </div>
              )}

              {/* Estado: Éxito */}
              {isSuccess && successResult && (
                <div className="flex flex-col items-center justify-center py-16 space-y-8 animate-in fade-in zoom-in duration-500">
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-20 scale-150" />
                    <CheckCircle2 className="h-28 w-28 text-green-500 relative z-10" />
                  </div>

                  <div className="text-center space-y-3 max-w-md w-full">
                    <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                      ¡Pedido creado!
                    </h2>

                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg text-left">
                      <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-3">
                        Números de pedido en Aliclik:
                      </p>
                      <div className="space-y-2">
                        {successResult.shipments.map((s) => (
                          <div
                            key={s.warehouseId}
                            className="flex justify-between items-center text-xs py-1 border-b border-green-100 dark:border-green-900 last:border-0"
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
                    </div>

                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-4">
                      El pedido fue registrado en Aliclik correctamente.
                    </p>
                  </div>

                  <Button
                    onClick={onClose}
                    className="bg-slate-900 hover:bg-black dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white px-12 h-12 font-bold rounded-2xl shadow-xl shadow-slate-200 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                  >
                    Entendido, cerrar
                  </Button>
                </div>
              )}

              {/* Estado: Cotización cargada */}
              {!quoting && !quoteError && quote && !isSuccess && (
                <>
                  {/* Datos del cliente */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                      Cliente
                    </p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                      {quote.customer.fullName}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {[
                        quote.customer.district,
                        quote.customer.city,
                        quote.customer.province,
                      ]
                        .filter(Boolean)
                        .join(" — ")}
                    </p>

                    {/* Coordenadas faltantes — Aliclik las exige */}
                    {coordsMissing && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          Aliclik requiere coordenadas GPS del cliente
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label
                              htmlFor="override-lat"
                              className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                            >
                              Latitud <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="override-lat"
                              type="text"
                              inputMode="decimal"
                              placeholder="-12.046374"
                              value={overrideLat}
                              onChange={(e) => setOverrideLat(e.target.value)}
                              className={cn(
                                "h-8 text-sm bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-slate-100",
                                overrideLat.trim() && Number.isNaN(parseFloat(overrideLat))
                                  ? "border-red-400"
                                  : "",
                              )}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label
                              htmlFor="override-lng"
                              className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                            >
                              Longitud <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="override-lng"
                              type="text"
                              inputMode="decimal"
                              placeholder="-77.042793"
                              value={overrideLng}
                              onChange={(e) => setOverrideLng(e.target.value)}
                              className={cn(
                                "h-8 text-sm bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-slate-100",
                                overrideLng.trim() && Number.isNaN(parseFloat(overrideLng))
                                  ? "border-red-400"
                                  : "",
                              )}
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                          Las coordenadas se guardarán en el perfil del cliente automáticamente.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Banner ítems no enlazados */}
                  {quote.unresolvedItems.length > 0 && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-1">
                          Productos no enlazados al catálogo Aliclik
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-500 mb-2">
                          No podés crear el pedido hasta enlazar estos productos
                          al catálogo de Aliclik. Dalos de alta en Aliclik,
                          corré la sincronización y verificá que el SKU/EAN
                          coincida.
                        </p>
                        <ul className="text-xs text-amber-700 dark:text-amber-500 space-y-0.5">
                          {quote.unresolvedItems.map((item) => (
                            <li
                              key={item.sku}
                              className="flex items-start gap-1"
                            >
                              <span className="text-amber-500">•</span>
                              <span>
                                <span className="font-mono">{item.sku}</span> —{" "}
                                {item.productName}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Almacenes */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Almacenes y couriers
                    </h3>

                    {quote.warehouses.map((wh) => {
                      const state = warehouseStates[wh.warehouseId];
                      const selectedCourier =
                        state?.selectedCourierId != null
                          ? wh.couriers.find(
                              (c) => c.id === state.selectedCourierId,
                            )
                          : undefined;
                      const hasCoverage = wh.couriers.length > 0;

                      return (
                        <Card
                          key={wh.warehouseId}
                          className={cn(
                            "overflow-hidden border-slate-200 dark:border-slate-700 dark:bg-slate-800",
                            !hasCoverage &&
                              "border-red-200 dark:border-red-800/50 bg-red-50/30 dark:bg-red-950/10",
                          )}
                        >
                          <CardContent className="p-5 space-y-4">
                            {/* Nombre del almacén */}
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                  Almacén
                                </p>
                                <h4 className="font-bold text-base text-slate-800 dark:text-slate-100">
                                  {wh.warehouseName}
                                </h4>
                                {wh.ubigeo && (
                                  <p className="text-xs text-slate-400 dark:text-slate-500">
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
                                <span className="text-[10px] font-bold px-2 py-1 rounded bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 uppercase">
                                  Sin cobertura
                                </span>
                              )}
                            </div>

                            {/* Ítems del almacén */}
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                                Productos
                              </p>
                              <div className="space-y-1">
                                {wh.items.map((item) => (
                                  <div
                                    key={item.sku}
                                    className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-700 last:border-0"
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
                                        S/ {item.unitPrice.toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Selección de courier */}
                            {hasCoverage ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <Label
                                    htmlFor={`courier-${wh.warehouseId}`}
                                    className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                                  >
                                    Courier
                                  </Label>
                                  <Select
                                    value={
                                      state?.selectedCourierId != null
                                        ? String(state.selectedCourierId)
                                        : ""
                                    }
                                    onValueChange={(val) =>
                                      handleCourierChange(wh.warehouseId, val)
                                    }
                                  >
                                    <SelectTrigger id={`courier-${wh.warehouseId}`} className="h-9 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-slate-100">
                                      <SelectValue placeholder="Seleccionar courier" />
                                    </SelectTrigger>
                                    <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                                      {wh.couriers.map((courier) => (
                                        <SelectItem
                                          key={courier.id}
                                          value={String(courier.id)}
                                          className="dark:focus:bg-slate-700"
                                        >
                                          <div className="flex items-center gap-2">
                                            <span>{courier.transportName}</span>
                                            <span className="text-slate-500 dark:text-slate-400">
                                              S/{" "}
                                              {courier.deliveryCost.toFixed(2)}
                                            </span>
                                            {courier.flagDeliveryExpress && (
                                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 uppercase">
                                                Express
                                              </span>
                                            )}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {selectedCourier && (
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                                      Entrega estimada: +{selectedCourier.addDays}{" "}
                                      días
                                    </p>
                                  )}
                                </div>

                                <div className="space-y-1.5">
                                  <Label
                                    htmlFor={`delivery-${wh.warehouseId}`}
                                    className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                                  >
                                    Costo de envío (S/)
                                  </Label>
                                  <Input
                                    id={`delivery-${wh.warehouseId}`}
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={state?.delivery ?? ""}
                                    onChange={(e) =>
                                      handleDeliveryChange(
                                        wh.warehouseId,
                                        e.target.value,
                                      )
                                    }
                                    className="h-9 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-slate-100"
                                  />
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                                    Editable — prellenado con el courier elegido
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-800/50 rounded-lg text-xs text-red-600 dark:text-red-400">
                                No hay couriers disponibles para este almacén.
                                Este almacén no se incluirá en el pedido.
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Campos globales opcionales */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Opcionales
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="aliclik-channel"
                          className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                        >
                          Canal de venta
                        </Label>
                        <Select value={channel} onValueChange={setChannel}>
                          <SelectTrigger id="aliclik-channel" className="h-9 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-slate-100">
                            <SelectValue placeholder="Sin canal" />
                          </SelectTrigger>
                          <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                            <SelectItem
                              value={CHANNEL_NONE}
                              className="dark:focus:bg-slate-700"
                            >
                              Sin canal
                            </SelectItem>
                            {CHANNEL_OPTIONS.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={opt.value}
                                className="dark:focus:bg-slate-700"
                              >
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5 sm:col-span-1">
                        <Label
                          htmlFor="aliclik-note"
                          className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                        >
                          Nota interna
                        </Label>
                        <Textarea
                          id="aliclik-note"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Nota para el pedido (opcional)"
                          className="min-h-[72px] bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Resumen de costo sugerido */}
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 rounded-lg p-4 flex justify-between items-center">
                    <span className="font-bold text-sm">
                      Costo de envío sugerido
                    </span>
                    <span className="font-mono font-bold">
                      S/ {quote.shippingTotalSugerido.toFixed(2)}
                    </span>
                  </div>

                  {/* Botón de acción */}
                  <div className="pt-2 border-t dark:border-slate-700">
                    <Button
                      onClick={handleCreate}
                      disabled={!canSubmit || sending}
                      className="w-full h-12 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creando pedido...
                        </>
                      ) : (
                        "Crear pedido en Aliclik"
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
