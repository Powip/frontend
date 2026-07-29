"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
import { Combobox } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Package,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  getEvaCredentials,
  getEvaDistricts,
  createEvaOrdersBulk,
  type EvaCredentialSafe,
  type EvaClientType,
  type EvaPaymentMethod,
  type EvaServiceType,
  type CreateEvaOrderPayload,
  type EvaSendOrdersBulkItemResult,
} from "@/services/evaService";

// ─── CONSTANTES ─────────────────────────────────────────

const SERVICE_TYPE_OPTIONS: { value: EvaServiceType; label: string }[] = [
  { value: 1, label: "General" },
  { value: 2, label: "Tarde" },
];

const PAYMENT_METHOD_OPTIONS: { value: EvaPaymentMethod; label: string }[] = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "SOLO ENTREGAR", label: "Solo entregar (sin cobro)" },
  { value: "POS", label: "POS" },
  { value: "TRANSFERENCIA / YAPE", label: "Transferencia / Yape" },
  {
    value: "TRANSFERENCIA DIRECTA A EMPRESA",
    label: "Transferencia directa a empresa",
  },
  { value: "CAMBIO / CAMBIO CON COBRO", label: "Cambio / Cambio con cobro" },
  { value: "RECOJO EN RUTA", label: "Recojo en ruta" },
];

/** Límite razonable para el autogenerado de `product` en filas RECOJO. */
const MAX_PRODUCT_LENGTH = 180;

/** Normaliza un teléfono peruano de 9 dígitos (con o sin "51"/"+51") a "+51XXXXXXXXX". */
function normalizeEvaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("51") && digits.length === 11) return `+${digits}`;
  if (digits.length === 9) return `+51${digits}`;
  return digits ? `+${digits}` : "";
}

function isValidEvaPhone(raw: string): boolean {
  return /^\+51\d{9}$/.test(normalizeEvaPhone(raw));
}

/**
 * Normaliza un string de distrito para matching TOLERANTE: recorta espacios,
 * colapsa espacios múltiples internos y uppercasea — replica exactamente la
 * normalización de `EvaCoverageService.validateDistrict` en ms-integrations
 * (a propósito SIN accent-folding, EVA es sensible a tildes). Duplicado a
 * propósito de `SendToEvaModal.tsx`: son funciones puras de una línea, no
 * vale la pena extraerlas a un módulo compartido para este alcance.
 */
function normalizeDistrict(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

// ─── TIPOS ──────────────────────────────────────────────

/**
 * Shape mínimo requerido de cada pedido de la guía.
 * Compatible con OrderDetail de GuideDetailsModal — se declaran acá también
 * los campos de solo lectura (cliente, ítems, pagos) que ese componente
 * SIEMPRE provee en runtime, para poder mostrar el detalle completo del
 * pedido en este modal sin recurrir a `any`.
 */
export interface EvaGuideOrderItem {
  id: string;
  orderNumber: string;
  status?: string;
  customer: {
    fullName: string;
    phoneNumber: string;
    district?: string;
    city?: string;
    province?: string;
    address?: string;
    dni?: string | null;
  };
  grandTotal?: number;
  totals?: {
    grandTotal: number;
    totalPaid?: number;
    pendingAmount?: number;
  };
  payments?: Array<{
    id?: string;
    amount: number;
    status: string;
  }>;
  items: Array<{
    productName: string;
    sku: string;
    quantity: number;
    unitPrice?: number;
    attributes?: Record<string, string>;
  }>;
}

interface EvaGuideRowState {
  selected: boolean;
  recipientName: string;
  recipientPhone: string;
  /** Valor exacto del maestro de distritos EVA, o "" si no matcheó. */
  district: string;
  districtMismatch: boolean;
  address: string;
  amount: string;
  product: string;
  packages: string;
  sku: string;
}

interface EvaGuideResultRow {
  orderId: string;
  orderNumber: string;
  outcome: EvaSendOrdersBulkItemResult["outcome"];
  trackingId?: string;
  reason?: string;
}

// ─── PROPS ──────────────────────────────────────────────

export interface SendToEvaGuideModalProps {
  open: boolean;
  guideId: string;
  companyId: string;
  orders: EvaGuideOrderItem[];
  onClose: () => void;
  onSuccess: () => void;
}

// ─── HELPERS ────────────────────────────────────────────

function buildSkuDefault(items: EvaGuideOrderItem["items"]): string {
  return items.map((i) => `${i.sku}(${i.quantity})`).join(",");
}

function buildProductDefault(items: EvaGuideOrderItem["items"]): string {
  const joined = items.map((i) => i.productName).join(", ");
  return joined.length > MAX_PRODUCT_LENGTH
    ? `${joined.slice(0, MAX_PRODUCT_LENGTH - 1)}…`
    : joined;
}

/**
 * Monto total, pagado y pendiente de un pedido — mismo cálculo que
 * `cobranzaStats`/`handleBulkWhatsApp` de `GuideDetailsModal` (solo pagos
 * con status "PAID" se descuentan del total).
 */
function computeOrderAmounts(order: EvaGuideOrderItem): {
  total: number;
  paid: number;
  pending: number;
} {
  const rawTotal = Number(order.totals?.grandTotal ?? order.grandTotal ?? 0);
  const total = Number.isFinite(rawTotal) ? rawTotal : 0;
  const paid =
    order.payments
      ?.filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
  const pending = Math.max(total - paid, 0);
  return { total, paid, pending };
}

function buildRow(
  order: EvaGuideOrderItem,
  clientType: EvaClientType,
  districts: string[],
): EvaGuideRowState {
  const items = order.items ?? [];
  const rawDistrict = (order.customer?.district ?? "").trim();
  const normalizedTarget = normalizeDistrict(rawDistrict);
  const match = normalizedTarget
    ? districts.find((d) => normalizeDistrict(d) === normalizedTarget)
    : undefined;

  // Number() defensivo — algunos endpoints serializan columnas decimal como
  // string (mismo patrón que el resto de GuideDetailsModal con grandTotal).
  const amount = Number(order.totals?.grandTotal ?? order.grandTotal ?? 0);

  return {
    selected: true,
    recipientName: order.customer?.fullName ?? "",
    recipientPhone: order.customer?.phoneNumber ?? "",
    district: match ?? "",
    districtMismatch: !match && rawDistrict.length > 0,
    address: order.customer?.address ?? "",
    amount: Number.isFinite(amount) ? String(amount) : "0",
    product: clientType === "RECOJO" ? buildProductDefault(items) : "",
    packages:
      clientType === "RECOJO" ? String(Math.max(items.length, 1)) : "1",
    sku: clientType === "ALMACEN" ? buildSkuDefault(items) : "",
  };
}

function isRowValid(row: EvaGuideRowState, clientType: EvaClientType): boolean {
  if (!row.recipientName.trim()) return false;
  if (!isValidEvaPhone(row.recipientPhone)) return false;
  if (!row.district) return false;
  if (!row.address.trim()) return false;

  const parsedAmount = parseFloat(row.amount);
  if (Number.isNaN(parsedAmount) || parsedAmount < 0) return false;

  if (clientType === "RECOJO") {
    const parsedPackages = parseInt(row.packages, 10);
    if (
      !row.product.trim() ||
      Number.isNaN(parsedPackages) ||
      parsedPackages < 1
    )
      return false;
  }

  if (clientType === "ALMACEN" && !row.sku.trim()) return false;

  return true;
}

// ─── COMPONENTE ─────────────────────────────────────────

export default function SendToEvaGuideModal({
  open,
  companyId: propCompanyId,
  orders,
  onClose,
  onSuccess,
}: SendToEvaGuideModalProps) {
  const { auth } = useAuth();
  const companyId = propCompanyId || auth?.company?.id || "";
  const token = auth?.accessToken ?? "";

  // Credencial + distritos EVA — se resuelven UNA sola vez para toda la guía
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [credential, setCredential] = useState<EvaCredentialSafe | null>(null);
  const [districts, setDistricts] = useState<string[]>([]);

  // Campos globales — aplican a todas las filas tildadas
  const [paymentMethod, setPaymentMethod] =
    useState<EvaPaymentMethod>("EFECTIVO");
  const [serviceType, setServiceType] = useState<EvaServiceType>(1);

  // Filas por pedido (key = orderId)
  const [rows, setRows] = useState<Record<string, EvaGuideRowState>>({});

  // Envío
  const [sending, setSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [results, setResults] = useState<EvaGuideResultRow[]>([]);

  // Timer de auto-cierre tras un envío exitoso (ver handleSendAll). Se cancela
  // si el usuario cierra manualmente con "Entendido, cerrar" (o el modal se
  // remonta) antes de que dispare, para no llamar a onClose() dos veces.
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── EFECTO: resolver credencial + distritos + armar filas ──

  // Deps intencionalmente limitadas a [open]: el padre (GuideDetailsModal)
  // pasa `orders` como `ordersDetails.filter(...)`, que es un array NUEVO en
  // cada render del padre aunque el contenido no cambie. Si `orders` estuviera
  // en este array de deps, un envío exitoso (handleSendAll -> onSuccess() ->
  // fetchGuide() del padre, que actualiza ordersDetails) re-dispara este
  // efecto, que hace setIsSuccess(false) y pisa el setIsSuccess(true) recién
  // hecho — el modal "parpadea" y vuelve a la pantalla de configuración
  // aunque el envío a EVA ya se haya completado correctamente en el backend.
  // companyId/token/orders se siguen leyendo del closure con su valor
  // vigente; solo NO deben disparar una re-ejecución del reset por sí solos.
  useEffect(() => {
    if (!open || orders.length === 0 || !companyId || !token) return;

    // Reset completo
    setLoadingSetup(true);
    setCredentialError(null);
    setCredential(null);
    setDistricts([]);
    setRows({});
    setIsSuccess(false);
    setResults([]);
    setSending(false);
    setPaymentMethod("EFECTIVO");
    setServiceType(1);

    Promise.all([getEvaCredentials(token, companyId), getEvaDistricts(token)])
      .then(([cred, districtList]) => {
        setDistricts(districtList);

        if (!cred || !cred.isActive) {
          setCredentialError(
            "La integración con EVA no está configurada o activa para esta empresa. Configurala en Configuración > Integraciones > EVA.",
          );
          return;
        }

        setCredential(cred);

        const initialRows: Record<string, EvaGuideRowState> = {};
        orders.forEach((order) => {
          initialRows[order.id] = buildRow(
            order,
            cred.clientType,
            districtList,
          );
        });
        setRows(initialRows);
      })
      .catch(() => {
        setCredentialError(
          "Error al verificar la configuración de EVA o cargar los distritos habilitados.",
        );
      })
      .finally(() => setLoadingSetup(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── EFECTO: cancelar el timer de auto-cierre pendiente ─────
  // Corre en cada cambio de `open` (incluido cierre manual) y en el
  // desmonte, limpiando cualquier timer de handleSendAll que no haya
  // disparado todavía — evita un onClose() duplicado o fuera de lugar.
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, [open]);

  // ─── HANDLERS ────────────────────────────────────────

  const updateRow = (orderId: string, patch: Partial<EvaGuideRowState>) => {
    setRows((prev) => {
      const current = prev[orderId];
      if (!current) return prev;
      return { ...prev, [orderId]: { ...current, ...patch } };
    });
  };

  const toggleAll = (checked: boolean) => {
    setRows((prev) => {
      const next: Record<string, EvaGuideRowState> = {};
      Object.entries(prev).forEach(([id, row]) => {
        next[id] = { ...row, selected: checked };
      });
      return next;
    });
  };

  // ─── VALIDACIÓN GLOBAL ───────────────────────────────

  const selectedValidOrders = useMemo(() => {
    if (!credential) return [];
    return orders.filter((order) => {
      const row = rows[order.id];
      if (!row?.selected) return false;
      return isRowValid(row, credential.clientType);
    });
  }, [orders, rows, credential]);

  const allSelected =
    orders.length > 0 && orders.every((order) => rows[order.id]?.selected);

  const canSubmit =
    !!credential && selectedValidOrders.length > 0 && !sending;

  // ─── ENVÍO BULK (una sola llamada HTTP) ──────────────

  const handleSendAll = async () => {
    if (!credential || !companyId || selectedValidOrders.length === 0) return;

    setSending(true);
    try {
      const payloads: CreateEvaOrderPayload[] = selectedValidOrders.map(
        (order) => {
          const row = rows[order.id];
          const payload: CreateEvaOrderPayload = {
            companyId,
            orderId: order.id,
            recipientName: row.recipientName.trim(),
            recipientPhone: normalizeEvaPhone(row.recipientPhone),
            district: row.district.trim(),
            address: row.address.trim(),
            amount: parseFloat(row.amount),
            paymentMethod,
            serviceType,
            ...(credential.clientType === "RECOJO" && {
              product: row.product.trim(),
              packages: parseInt(row.packages, 10),
            }),
            ...(credential.clientType === "ALMACEN" && {
              sku: row.sku.trim(),
            }),
          };
          return payload;
        },
      );

      const apiResults = await createEvaOrdersBulk(token, payloads);

      const resultRows: EvaGuideResultRow[] = selectedValidOrders.map(
        (order, index) => {
          const apiResult = apiResults[index];
          return {
            orderId: order.id,
            orderNumber: order.orderNumber,
            outcome: apiResult?.outcome ?? "failed_pending",
            trackingId: apiResult?.trackingId,
            reason: apiResult?.reason,
          };
        },
      );

      setResults(resultRows);
      setIsSuccess(true);

      const createdCount = resultRows.filter(
        (r) => r.outcome === "created",
      ).length;
      const totalCount = resultRows.length;

      if (createdCount === totalCount) {
        toast.success(
          `${createdCount} de ${totalCount} pedido${totalCount !== 1 ? "s" : ""} enviado${totalCount !== 1 ? "s" : ""} a EVA`,
        );
      } else if (createdCount === 0) {
        toast.error(`Ningún pedido pudo enviarse a EVA (0 de ${totalCount})`);
      } else {
        toast.warning(`${createdCount} de ${totalCount} pedidos enviados a EVA`);
      }

      onSuccess();

      // Auto-cierre: tras mostrar la pantalla de éxito, volvemos solos a
      // GuideDetailsModal (que para entonces ya refleja el estado EVA
      // actualizado vía onSuccess -> fetchGuide del padre). El botón manual
      // "Entendido, cerrar" sigue disponible para quien no quiera esperar.
      autoCloseTimerRef.current = setTimeout(() => {
        onClose();
        autoCloseTimerRef.current = null;
      }, 1500);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ?? "Error al enviar la guía a EVA";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] p-0 bg-white dark:bg-slate-900 overflow-visible">
        <div
          className="relative flex flex-col"
          style={{ maxHeight: "calc(90vh - 2rem)" }}
        >
          {/* Header fijo */}
          <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b dark:border-slate-700 p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-500" />
                Enviar guía a EVA
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
            <div className="p-6 space-y-5">
              {orders.length === 0 ? (
                <div className="py-20 text-center text-slate-400 dark:text-slate-500">
                  No hay pedidos seleccionados
                </div>
              ) : loadingSetup ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                  <p className="text-sm font-medium">
                    Verificando configuración de EVA...
                  </p>
                </div>
              ) : credentialError ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <AlertCircle className="h-12 w-12 text-red-400" />
                  <p className="text-sm font-medium text-red-600 dark:text-red-400 text-center">
                    {credentialError}
                  </p>
                  <Button variant="outline" onClick={onClose}>
                    Cerrar
                  </Button>
                </div>
              ) : isSuccess ? (
                /* ── PANTALLA DE RESULTADO ── */
                <div className="flex flex-col items-center justify-center py-16 space-y-8 animate-in fade-in zoom-in duration-500">
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-20 scale-150" />
                    <CheckCircle2 className="h-28 w-28 text-green-500 relative z-10" />
                  </div>

                  <div className="text-center space-y-3 max-w-lg w-full">
                    <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                      {results.every((r) => r.outcome === "created")
                        ? "¡Pedidos enviados!"
                        : "¡Proceso completado!"}
                    </h2>

                    <div className="mt-4 space-y-3">
                      {results.filter((r) => r.outcome === "created").length >
                        0 && (
                        <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg text-left">
                          <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-3">
                            Pedidos creados en EVA:
                          </p>
                          <div className="space-y-1">
                            {results
                              .filter((r) => r.outcome === "created")
                              .map((r) => (
                                <div
                                  key={r.orderId}
                                  className="flex justify-between items-center text-xs py-0.5 border-b border-green-100 dark:border-green-900 last:border-0"
                                >
                                  <span className="text-green-700 dark:text-green-300">
                                    #{r.orderNumber}
                                  </span>
                                  <span className="font-mono font-bold text-green-800 dark:text-green-400">
                                    {r.trackingId}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {results.filter((r) => r.outcome !== "created").length >
                        0 && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-left">
                          <p className="text-amber-800 dark:text-amber-400 font-bold text-sm mb-2">
                            {
                              results.filter((r) => r.outcome !== "created")
                                .length
                            }{" "}
                            pedido(s) no se enviaron:
                          </p>
                          <div className="text-xs text-amber-700 dark:text-amber-500 space-y-1 max-h-32 overflow-y-auto">
                            {results
                              .filter((r) => r.outcome !== "created")
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
                                    {r.reason || r.outcome}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      // Cierre manual explícito: cancelamos el timer de
                      // auto-cierre acá mismo, sin depender exclusivamente
                      // del cleanup del efecto atado a `open` (ver arriba).
                      if (autoCloseTimerRef.current) {
                        clearTimeout(autoCloseTimerRef.current);
                        autoCloseTimerRef.current = null;
                      }
                      onClose();
                    }}
                    className="bg-slate-900 hover:bg-black dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white px-12 h-12 font-bold rounded-2xl shadow-xl shadow-slate-200 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                  >
                    Entendido, cerrar
                  </Button>
                </div>
              ) : (
                credential && (
                  /* ── PANTALLA DE CONFIGURACIÓN ── */
                  <>
                    {/* Servicio EVA global */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Servicio EVA (aplica a toda la guía)
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label
                            htmlFor="eva-guide-service-type"
                            className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                          >
                            Tipo de servicio
                          </Label>
                          <Select
                            value={String(serviceType)}
                            onValueChange={(val) =>
                              setServiceType(Number(val) as EvaServiceType)
                            }
                          >
                            <SelectTrigger
                              id="eva-guide-service-type"
                              className="h-9 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-slate-100"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                              {SERVICE_TYPE_OPTIONS.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={String(opt.value)}
                                  className="dark:focus:bg-slate-700"
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label
                            htmlFor="eva-guide-payment-method"
                            className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                          >
                            Método de cobro
                          </Label>
                          <Select
                            value={paymentMethod}
                            onValueChange={(val) =>
                              setPaymentMethod(val as EvaPaymentMethod)
                            }
                          >
                            <SelectTrigger
                              id="eva-guide-payment-method"
                              className="h-9 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-slate-100"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                              {PAYMENT_METHOD_OPTIONS.map((opt) => (
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
                      </div>
                    </div>

                    {/* Selección global */}
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Pedidos a revisar
                      </p>
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(checked) =>
                            toggleAll(checked === true)
                          }
                        />
                        Seleccionar todos
                      </label>
                    </div>

                    {/* Cards de revisión — una por pedido */}
                    <div className="space-y-4">
                      {orders.map((order) => {
                        const row = rows[order.id];
                        if (!row) return null;

                        const valid = isRowValid(row, credential.clientType);
                        const districtOptions = districts.map((d) => ({
                          value: d,
                          label: d,
                        }));
                        const amounts = computeOrderAmounts(order);
                        const items = order.items ?? [];

                        return (
                          <Card
                            key={order.id}
                            data-testid={`eva-order-card-${order.id}`}
                            className="overflow-hidden border-slate-200 dark:border-slate-700 dark:bg-slate-800"
                          >
                            <CardContent className="p-5 space-y-4">
                              {/* Cabecera con checkbox de selección */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <Checkbox
                                    checked={row.selected}
                                    onCheckedChange={(checked) =>
                                      updateRow(order.id, {
                                        selected: checked === true,
                                      })
                                    }
                                    className="mt-1"
                                  />
                                  <div>
                                    <h4 className="font-bold text-base text-slate-800 dark:text-slate-100">
                                      #{order.orderNumber}
                                    </h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                      {order.customer?.fullName}
                                      {(order.customer?.district ||
                                        order.customer?.city) && (
                                        <span>
                                          {" "}
                                          —{" "}
                                          {order.customer.district ||
                                            order.customer.city}
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                {row.selected && !valid ? (
                                  <AlertCircle
                                    className="h-5 w-5 text-amber-500 shrink-0"
                                    aria-label="Fila con datos incompletos o inválidos"
                                  />
                                ) : row.selected ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-slate-300 dark:text-slate-600 shrink-0" />
                                )}
                              </div>

                              {/* Datos del cliente — solo lectura */}
                              <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900 space-y-1.5">
                                <p className="text-[9px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wide">
                                  Datos del pedido
                                </p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                                  <span className="text-slate-500 dark:text-slate-400">
                                    DNI:{" "}
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                      {order.customer?.dni || "—"}
                                    </span>
                                  </span>
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Tel:{" "}
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                      {order.customer?.phoneNumber || "—"}
                                    </span>
                                  </span>
                                </div>
                                {order.customer?.address && (
                                  <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium leading-tight">
                                    {order.customer.address}
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-3">
                                  {order.customer?.district && (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                      Dist:{" "}
                                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                                        {order.customer.district}
                                      </span>
                                    </span>
                                  )}
                                  {(order.customer?.city ||
                                    order.customer?.province) && (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                      Prov:{" "}
                                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                                        {order.customer.city ||
                                          order.customer.province}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Productos — solo lectura */}
                              {items.length > 0 && (
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Productos
                                  </p>
                                  {items.map((item, index) => (
                                    <div
                                      key={`${order.id}-${item.sku}-${index}`}
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
                                        {typeof item.unitPrice === "number" && (
                                          <span className="font-medium text-slate-700 dark:text-slate-300">
                                            S/ {item.unitPrice.toFixed(2)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Monto del pedido — solo lectura */}
                              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                  Monto del pedido
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100">
                                    S/ {amounts.total.toFixed(2)}
                                  </span>
                                  {amounts.pending > 0 && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 uppercase">
                                      Pendiente S/ {amounts.pending.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Campos editables EVA */}
                              <div className="border-t dark:border-slate-700 pt-4 space-y-3">
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                  Datos para el envío EVA
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <Label
                                      htmlFor={`eva-guide-${order.id}-recipientName`}
                                      className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                                    >
                                      Destinatario
                                    </Label>
                                    <Input
                                      id={`eva-guide-${order.id}-recipientName`}
                                      value={row.recipientName}
                                      onChange={(e) =>
                                        updateRow(order.id, {
                                          recipientName: e.target.value,
                                        })
                                      }
                                      className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 dark:text-slate-100 text-xs"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <Label
                                      htmlFor={`eva-guide-${order.id}-recipientPhone`}
                                      className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                                    >
                                      Teléfono
                                    </Label>
                                    <Input
                                      id={`eva-guide-${order.id}-recipientPhone`}
                                      value={row.recipientPhone}
                                      onChange={(e) =>
                                        updateRow(order.id, {
                                          recipientPhone: e.target.value,
                                        })
                                      }
                                      className={`h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 dark:text-slate-100 text-xs ${
                                        row.recipientPhone.trim() &&
                                        !isValidEvaPhone(row.recipientPhone)
                                          ? "border-red-400"
                                          : ""
                                      }`}
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                                      Distrito
                                    </Label>
                                    <Combobox
                                      value={row.district}
                                      onValueChange={(value) =>
                                        updateRow(order.id, {
                                          district: value,
                                          districtMismatch: false,
                                        })
                                      }
                                      options={districtOptions}
                                      placeholder="Seleccionar"
                                      searchPlaceholder="Buscar distrito..."
                                      emptyMessage="No se encontraron distritos."
                                      className={`h-9 text-xs w-full ${
                                        !row.district ? "border-red-400" : ""
                                      }`}
                                    />
                                    {row.districtMismatch && !row.district && (
                                      <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-0.5">
                                        No coincide con cobertura EVA
                                      </p>
                                    )}
                                  </div>

                                  <div className="space-y-1 sm:col-span-2">
                                    <Label
                                      htmlFor={`eva-guide-${order.id}-address`}
                                      className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                                    >
                                      Dirección
                                    </Label>
                                    <Input
                                      id={`eva-guide-${order.id}-address`}
                                      value={row.address}
                                      onChange={(e) =>
                                        updateRow(order.id, {
                                          address: e.target.value,
                                        })
                                      }
                                      className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 dark:text-slate-100 text-xs"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <Label
                                      htmlFor={`eva-guide-${order.id}-amount`}
                                      className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                                    >
                                      Monto (S/)
                                    </Label>
                                    <Input
                                      id={`eva-guide-${order.id}-amount`}
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={row.amount}
                                      onChange={(e) =>
                                        updateRow(order.id, {
                                          amount: e.target.value,
                                        })
                                      }
                                      className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 dark:text-slate-100 text-xs"
                                    />
                                  </div>

                                  {credential.clientType === "RECOJO" ? (
                                    <>
                                      <div className="space-y-1 sm:col-span-2">
                                        <Label
                                          htmlFor={`eva-guide-${order.id}-product`}
                                          className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                                        >
                                          Producto
                                        </Label>
                                        <Input
                                          id={`eva-guide-${order.id}-product`}
                                          value={row.product}
                                          onChange={(e) =>
                                            updateRow(order.id, {
                                              product: e.target.value,
                                            })
                                          }
                                          className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 dark:text-slate-100 text-xs"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label
                                          htmlFor={`eva-guide-${order.id}-packages`}
                                          className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                                        >
                                          Bultos
                                        </Label>
                                        <Input
                                          id={`eva-guide-${order.id}-packages`}
                                          type="number"
                                          min={1}
                                          value={row.packages}
                                          onChange={(e) =>
                                            updateRow(order.id, {
                                              packages: e.target.value,
                                            })
                                          }
                                          className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 dark:text-slate-100 text-xs"
                                        />
                                      </div>
                                    </>
                                  ) : (
                                    <div className="space-y-1 sm:col-span-2">
                                      <Label
                                        htmlFor={`eva-guide-${order.id}-sku`}
                                        className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                                      >
                                        SKU(s)
                                      </Label>
                                      <Input
                                        id={`eva-guide-${order.id}-sku`}
                                        value={row.sku}
                                        onChange={(e) =>
                                          updateRow(order.id, {
                                            sku: e.target.value,
                                          })
                                        }
                                        placeholder="CODIGO(cant),CODIGO(cant)"
                                        className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 dark:text-slate-100 text-xs"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Resumen y botón de envío */}
                    <div className="pt-2 border-t dark:border-slate-700 space-y-3">
                      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-300 font-medium">
                          Pedidos a enviar
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {selectedValidOrders.length} de {orders.length}
                        </span>
                      </div>

                      <Button
                        onClick={handleSendAll}
                        disabled={!canSubmit}
                        className="w-full h-12 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold"
                      >
                        {sending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Enviando guía...
                          </>
                        ) : (
                          `Enviar guía a EVA (${selectedValidOrders.length})`
                        )}
                      </Button>
                    </div>
                  </>
                )
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
