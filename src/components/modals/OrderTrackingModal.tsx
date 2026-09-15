"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Check,
  Lock,
  DollarSign,
  FileText,
  Zap,
  ArrowRight,
  Pencil,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { WhatsAppIcon } from "@/components/shared/WhatsAppIcon";
import { OrderHeader } from "@/interfaces/IOrder";
import { hasPaymentProof, getPendingPayment } from "@/app/centro-envios/components/shipmentUtils";
import { isShalomCourier } from "@/utils/courierNormalizer";
import { trackShalomGuide } from "@/services/shalomService";
import { useAuth } from "@/contexts/AuthContext";
import { SHALOM_STEPS } from "@/components/tracking/useShalomLiveStatus";
import { getOrderCourierStatus } from "@/components/tracking/CourierStatusBadge";
import { useQRCode } from "@/hooks/useQrCode";
import PaymentVerificationModal from "./PaymentVerificationModal";
import GuideDetailsModal from "./GuideDetailsModal";

/**
 * Calca el mockup "Seguimiento Courier" pedido por el cliente: pedido +
 * línea de tiempo a la izquierda, tarjeta de courier + clave de recojo +
 * comprobante + acciones a la derecha. Todo con datos reales — no se
 * inventa historial ni se expone la clave bloqueada en ningún texto (eso
 * ya se corrigió a pedido del cliente en un fix anterior).
 */

interface ShippingGuideData {
  id: string;
  guideNumber: string;
  courierName?: string | null;
  status: string;
  deliveryZone?: string | null;
  deliveryType?: string | null;
  deliveryAddress?: string | null;
  trackingUrl?: string | null;
  shippingKey?: string | null;
  shippingCode?: string | null;
  shippingOffice?: string | null;
  shippingProofUrl?: string | null;
  created_at: string;
}

interface ShalomStatusesData {
  [key: string]: { fecha?: string } | undefined;
}

const STATUS_PILL: Record<string, string> = {
  "En tránsito": "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  "En destino": "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400",
  Entregado: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  Fallido: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  Cancelado: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  Devuelto: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "-";
  try {
    return format(new Date(iso), "dd/MM · HH:mm", { locale: es });
  } catch {
    return "-";
  }
}

interface TimelineStep {
  key: string;
  label: string;
  time?: string;
  detail: string;
  status: "done" | "current" | "pending";
}

export default function OrderTrackingModal({
  open,
  orderId,
  onClose,
  onOrderUpdated,
}: {
  open: boolean;
  orderId: string;
  onClose: () => void;
  onOrderUpdated?: () => void;
}) {
  const { auth } = useAuth();
  const [orderHeader, setOrderHeader] = useState<OrderHeader | null>(null);
  const [shippingGuide, setShippingGuide] = useState<ShippingGuideData | null>(null);
  const [statusesData, setStatusesData] = useState<ShalomStatusesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const [orderRes, guideRes] = await Promise.allSettled([
        axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`),
        axios.get(`${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${orderId}`),
      ]);

      const order: OrderHeader | null =
        orderRes.status === "fulfilled" ? orderRes.value.data : null;
      setOrderHeader(order);

      const guide = guideRes.status === "fulfilled" ? guideRes.value.data : null;
      setShippingGuide(guide);

      if (
        guide &&
        order &&
        auth?.accessToken &&
        (isShalomCourier(order.courier) || isShalomCourier(order.shippingOffice))
      ) {
        try {
          const result = await trackShalomGuide(auth.accessToken, guide.id);
          const data = (result?.statuses as { data?: ShalomStatusesData } | undefined)?.data;
          setStatusesData(data || null);
        } catch {
          setStatusesData(null);
        }
      } else {
        setStatusesData(null);
      }
    } catch {
      toast.error("No se pudo cargar el seguimiento del pedido");
    } finally {
      setLoading(false);
    }
  }, [orderId, auth?.accessToken]);

  useEffect(() => {
    if (open) fetchAll();
  }, [open, fetchAll]);

  const trackingQrUrl = useQRCode(shippingGuide?.trackingUrl || "");

  const canEdit = orderHeader ? hasPaymentProof(orderHeader) : false;
  const pending = orderHeader ? getPendingPayment(orderHeader) : 0;
  const proofPaymentMethod = orderHeader?.payments?.find((p) => !!p.paymentProofUrl)?.paymentMethod;
  const courierInfo = orderHeader ? getOrderCourierStatus(orderHeader) : null;
  const isShalom = isShalomCourier(orderHeader?.courier) || isShalomCourier(orderHeader?.shippingOffice);
  const delivered = courierInfo?.label === "Entregado";

  const handleForceSync = async () => {
    if (!orderHeader) return;
    setSyncing(true);
    try {
      await fetchAll();
      toast.success("Sincronizado con " + (shippingGuide?.courierName || "el courier"));
    } catch {
      toast.error("No se pudo sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const handleWhatsApp = () => {
    if (!orderHeader) return;
    const phone = orderHeader.customer?.phoneNumber?.replace(/\D/g, "") || "";
    const cleanPhone = phone.startsWith("51") ? phone : `51${phone}`;
    const trackingUrl = `${process.env.NEXT_PUBLIC_LANDING_URL}/rastreo/${orderHeader.orderNumber}`;
    const message = `Hola ${orderHeader.customer?.fullName}! Te contactamos por tu pedido ${orderHeader.orderNumber}.\n\nPuedes rastrear tu pedido aquí: ${trackingUrl}`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  // Línea de tiempo — solo pasos con respaldo real: creación del pedido,
  // registro en el courier, avances reales de Shalom (si aplica) y el
  // estado de cobranza que ya bloquea/habilita la clave en el resto de la
  // app. Nada de historial inventado.
  const steps: TimelineStep[] = [];
  if (orderHeader) {
    steps.push({
      key: "powip",
      label: "Pedido registrado en POWIP",
      time: fmtDateTime(orderHeader.created_at),
      detail: shippingGuide
        ? `Asignado a la guía ${shippingGuide.guideNumber}${shippingGuide.courierName ? ` · courier ${shippingGuide.courierName}` : ""}.`
        : "Pendiente de asignar a una guía de envío.",
      status: "done",
    });
    if (shippingGuide) {
      steps.push({
        key: "guia",
        label: `Registrado en ${shippingGuide.courierName || "el courier"}`,
        time: fmtDateTime(shippingGuide.created_at),
        detail: orderHeader.shalomSerie
          ? `N° de orden ${orderHeader.shalomSerie} generado.`
          : "Guía de envío generada.",
        status: "done",
      });
    }
    if (isShalom && statusesData) {
      // "registrado" ya está cubierto por el paso "Registrado en {courier}"
      // de arriba, y "entregado" se cubre con el paso final más abajo (que
      // usa el estado real del pedido, no solo la fecha de Shalom) — se
      // excluyen acá para no duplicar la key ni el paso.
      for (const step of SHALOM_STEPS) {
        if (step.key === "registrado" || step.key === "entregado") continue;
        const data = statusesData[step.key];
        steps.push({
          key: step.key,
          label: step.label,
          time: data?.fecha ? fmtDateTime(data.fecha) : undefined,
          detail: data?.fecha ? `Actualizado por ${shippingGuide?.courierName || "el courier"}.` : "Pendiente.",
          status: data?.fecha ? "done" : "pending",
        });
      }
    }
    if (shippingGuide?.shippingKey) {
      steps.push({
        key: "cobro",
        label: canEdit
          ? "Cobranza validada — clave habilitada"
          : "Pendiente de cobro — clave bloqueada",
        time: canEdit ? "validado" : "ahora",
        detail: canEdit
          ? `Pago validado${proofPaymentMethod ? ` (${proofPaymentMethod})` : ""}. Clave liberada al cliente.`
          : `Para habilitar la clave de recojo, el cliente debe pagar el saldo${
              pending ? ` (S/ ${pending.toFixed(2)})` : ""
            }.`,
        status: canEdit ? "done" : "current",
      });
    }
    steps.push({
      key: "entregado",
      label: "Entregado",
      time: delivered ? fmtDateTime(orderHeader.updated_at) : undefined,
      detail: delivered
        ? "El cliente recogió/recibió el pedido."
        : "Pendiente de recojo o entrega al cliente.",
      status: delivered ? "done" : "pending",
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Seguimiento del pedido {orderHeader?.orderNumber || ""}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando seguimiento...
          </div>
        ) : !orderHeader ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No se pudo cargar este pedido.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4 items-start">
            {/* ============ LEFT: pedido + línea de tiempo ============ */}
            <div className="flex flex-col gap-4 min-w-0">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xl font-extrabold tracking-tight">
                      {orderHeader.orderNumber}
                    </div>
                    {shippingGuide && (
                      <div className="text-muted-foreground text-[13px] mt-0.5">
                        Guía {shippingGuide.guideNumber} · generada{" "}
                        {fmtDateTime(shippingGuide.created_at)}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {courierInfo && (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold ${
                          STATUS_PILL[courierInfo.label] ||
                          "bg-muted text-muted-foreground"
                        }`}
                      >
                        {courierInfo.label}
                      </span>
                    )}
                    {shippingGuide?.shippingKey && (
                      <span
                        className={`ml-1.5 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12.5px] font-bold ${
                          canEdit
                            ? "bg-[#E7F8F1] text-[#047857]"
                            : "bg-[#FEF3E2] text-[#B45309]"
                        }`}
                      >
                        {canEdit ? "✓ Cobrado" : "🔒 Por cobrar"}
                      </span>
                    )}
                    {orderHeader.updated_at && (
                      <div className="mt-2 flex items-center justify-end gap-1.5 text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-400">
                        <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-600">
                          <span className="absolute inset-[-3px] rounded-full border-2 border-emerald-600 opacity-50 animate-ping" />
                        </span>
                        Actualizado{" "}
                        {formatDistanceToNow(new Date(orderHeader.updated_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 mt-4 text-[13px]">
                  <dt className="text-muted-foreground font-medium">Cliente</dt>
                  <dd className="text-right font-bold">
                    {orderHeader.customer?.fullName || "-"}
                  </dd>
                  <dt className="text-muted-foreground font-medium">Teléfono</dt>
                  <dd className="text-right font-bold font-mono">
                    {orderHeader.customer?.phoneNumber || "-"}
                  </dd>
                  <dt className="text-muted-foreground font-medium">Destino</dt>
                  <dd className="text-right font-bold">
                    {[orderHeader.customer?.district, orderHeader.customer?.city]
                      .filter(Boolean)
                      .join(" · ") || "-"}
                  </dd>
                  {orderHeader.customer?.address && (
                    <>
                      <dt className="text-muted-foreground font-medium">
                        Dirección / referencia
                      </dt>
                      <dd className="text-right font-bold max-w-[260px] ml-auto">
                        {orderHeader.customer.address}
                      </dd>
                    </>
                  )}
                  {shippingGuide?.deliveryType && (
                    <>
                      <dt className="text-muted-foreground font-medium">Modalidad</dt>
                      <dd className="text-right font-bold">
                        {shippingGuide.deliveryType}
                        {shippingGuide.shippingKey ? " · Recojo en agencia" : ""}
                      </dd>
                    </>
                  )}
                </dl>
              </div>

              {steps.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground mb-3">
                    Línea de tiempo
                    {shippingGuide?.courierName ? ` · estados de ${shippingGuide.courierName}` : ""}
                  </div>
                  <div className="pl-1">
                    {steps.map((step, i) => (
                      <div key={step.key} className="relative pl-[30px] pb-5 last:pb-0">
                        {i !== steps.length - 1 && (
                          <div
                            className={`absolute left-[8px] top-5 bottom-[-2px] w-0.5 ${
                              step.status === "done" ? "bg-emerald-500" : "bg-border"
                            }`}
                          />
                        )}
                        <div
                          className={`absolute left-0 top-[1px] h-[18px] w-[18px] rounded-full grid place-items-center border-2 ${
                            step.status === "done"
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : step.status === "current"
                                ? "bg-primary border-primary shadow-[0_0_0_4px_var(--primary-soft,rgba(79,70,229,.15))]"
                                : "bg-card border-border"
                          }`}
                        >
                          {step.status === "done" && <Check className="h-2.5 w-2.5" />}
                          {step.status === "current" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span
                            className={`font-extrabold text-[14px] ${
                              step.status === "current"
                                ? "text-primary"
                                : step.status === "pending"
                                  ? "text-muted-foreground"
                                  : ""
                            }`}
                          >
                            {step.label}
                          </span>
                          {step.time && (
                            <span className="ml-auto text-[12px] font-semibold text-muted-foreground">
                              {step.time}
                            </span>
                          )}
                        </div>
                        <div className="text-[12.5px] text-muted-foreground mt-0.5 leading-relaxed">
                          {step.detail}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ============ RIGHT: courier + clave + comprobante + acciones ============ */}
            <div className="flex flex-col gap-4 min-w-0">
              {shippingGuide && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border flex-wrap">
                    {isShalomCourier(shippingGuide.courierName) ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1 text-[15px] font-black tracking-wide text-white">
                        <span className="grid h-4 w-4 place-items-center rounded-[4px] bg-white text-[11px] font-black text-red-600">
                          S
                        </span>
                        {shippingGuide.courierName?.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-[15px] font-black">
                        {shippingGuide.courierName || "Courier"}
                      </span>
                    )}
                    {shippingGuide.deliveryType && (
                      <span className="rounded-md bg-muted px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground">
                        {shippingGuide.deliveryType}
                        {courierInfo ? ` · ${courierInfo.label}` : ""}
                      </span>
                    )}
                  </div>

                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px] mb-3">
                    {orderHeader.shalomSerie && (
                      <>
                        <dt className="text-muted-foreground font-medium">N° de orden</dt>
                        <dd className="text-right font-bold font-mono">
                          {orderHeader.shalomSerie}
                        </dd>
                      </>
                    )}
                    {shippingGuide.shippingCode && (
                      <>
                        <dt className="text-muted-foreground font-medium">Código</dt>
                        <dd className="text-right font-bold font-mono">
                          {canEdit ? (
                            shippingGuide.shippingCode
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400">
                              🔒 bloqueada
                            </span>
                          )}
                        </dd>
                      </>
                    )}
                    {shippingGuide.shippingOffice && (
                      <>
                        <dt className="text-muted-foreground font-medium">Agencia destino</dt>
                        <dd className="text-right font-bold">{shippingGuide.shippingOffice}</dd>
                      </>
                    )}
                    {shippingGuide.shippingKey && (
                      <>
                        <dt className="text-muted-foreground font-medium">Clave</dt>
                        <dd className="text-right font-bold font-mono tracking-widest">
                          {canEdit ? shippingGuide.shippingKey : "••••"}
                        </dd>
                      </>
                    )}
                  </dl>

                  {shippingGuide.shippingKey && (
                    <div
                      className={`rounded-xl border p-[13px] ${
                        canEdit
                          ? "border-[#A7E3CE] bg-[#E7F8F1] dark:border-green-800 dark:bg-green-950/30"
                          : "border-[#F3D9A8] bg-[#FEF3E2] dark:border-amber-800 dark:bg-amber-950/30"
                      }`}
                    >
                      <div className="flex items-center gap-[11px]">
                        <div
                          className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 ${
                            canEdit
                              ? "bg-[#047857] text-white"
                              : "bg-white dark:bg-amber-900 text-[#B45309] dark:text-amber-300"
                          }`}
                        >
                          {canEdit ? <Check className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`font-extrabold text-[13.5px] ${
                              canEdit
                                ? "text-[#047857] dark:text-green-400"
                                : "text-[#92400E] dark:text-amber-400"
                            }`}
                          >
                            {canEdit ? "Clave habilitada" : "Clave de recojo bloqueada"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {canEdit
                              ? proofPaymentMethod
                                ? `Cobrado (${proofPaymentMethod}) · validado`
                                : "Comprobante de pago cargado"
                              : `Pendiente de cobro${pending ? ` · S/ ${pending.toFixed(2)}` : ""}`}
                          </div>
                        </div>
                        <div
                          className={`font-mono font-black tracking-[0.24em] text-xl ${
                            canEdit
                              ? "text-[#047857] dark:text-green-400"
                              : "text-[#C29B54] dark:text-amber-400"
                          }`}
                        >
                          {canEdit ? shippingGuide.shippingKey : "••••"}
                        </div>
                      </div>
                      {!canEdit && (
                        <>
                          <Button
                            size="sm"
                            className="w-full mt-[11px] bg-[#B45309] hover:bg-[#92400E] text-white"
                            onClick={() => setPaymentModalOpen(true)}
                          >
                            <DollarSign className="h-4 w-4 mr-1.5" />
                            Registrar cobranza
                          </Button>
                          <p className="text-[11px] text-muted-foreground mt-2 leading-[1.45]">
                            La clave se habilita al validar el comprobante de
                            pago cargado para este pedido.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {shippingGuide?.shippingProofUrl && (
                <a
                  href={shippingGuide.shippingProofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-2xl border border-border overflow-hidden hover:border-primary/40 hover:shadow-sm transition-colors"
                >
                  <div className="flex items-center gap-2.5 px-[13px] py-[11px] bg-muted/30 border-b border-border">
                    <div className="h-[30px] w-[30px] rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 grid place-items-center shrink-0">
                      <FileText className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold leading-tight">
                        Comprobante del courier
                      </div>
                      <span className="text-[11.5px] text-muted-foreground">
                        Boleta / comprobante de envío
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-[13px] py-[13px]">
                    {trackingQrUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={trackingQrUrl}
                        alt="QR de seguimiento"
                        className="h-11 w-11 shrink-0 rounded"
                      />
                    )}
                    <div className="text-[11.5px] text-muted-foreground leading-tight min-w-0">
                      <b className="text-foreground font-bold">
                        {shippingGuide.guideNumber}
                      </b>{" "}
                      · {shippingGuide.courierName || "Courier"}
                    </div>
                    <span className="ml-auto shrink-0 text-primary font-bold text-[12.5px] flex items-center gap-1">
                      Ver <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </a>
              )}

              {isShalom && (
                <div className="flex items-start gap-2.5 rounded-[11px] bg-[#EEF0FF] dark:bg-indigo-950/30 px-[13px] py-[11px] text-[12.5px] leading-[1.45] text-[#3730A3] dark:text-indigo-300">
                  <Zap className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    <b>Tiempo real:</b> POWIP sincroniza el estado por
                    webhook de Shalom. Cuando el cliente recoge en agencia,
                    el estado pasa a <b>Entregado</b> automáticamente.
                  </span>
                </div>
              )}

              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground mb-3">
                  Acciones
                </div>
                <div className="flex flex-col gap-2">
                  {shippingGuide && (
                    <button
                      type="button"
                      onClick={() => setGuideModalOpen(true)}
                      className="flex items-center gap-2.5 rounded-lg border border-border px-[15px] py-[9px] text-[13px] font-semibold hover:bg-accent transition-colors"
                    >
                      <FileText className="h-4 w-4" />
                      Ver comprobante / rótulo
                      {isShalomCourier(shippingGuide.courierName) ? " Shalom" : ""}
                    </button>
                  )}
                  {shippingGuide?.shippingKey && (
                    <button
                      type="button"
                      disabled={!canEdit}
                      title={
                        canEdit
                          ? undefined
                          : "Debes cargar el comprobante de pago antes de copiar la clave"
                      }
                      onClick={() => {
                        if (!shippingGuide.shippingKey) return;
                        navigator.clipboard.writeText(shippingGuide.shippingKey);
                        toast.success("Código de recojo copiado");
                      }}
                      className="flex items-center gap-2.5 rounded-lg border border-border px-[15px] py-[9px] text-[13px] font-semibold hover:bg-accent transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                    >
                      <Pencil className="h-4 w-4" />
                      Copiar código de recojo
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleWhatsApp}
                    className="flex items-center gap-2.5 rounded-lg border border-border px-[15px] py-[9px] text-[13px] font-semibold hover:bg-accent transition-colors"
                  >
                    <WhatsAppIcon className="h-4 w-4" />
                    Enviar seguimiento por WhatsApp
                  </button>
                  {isShalom && (
                    <button
                      type="button"
                      disabled={syncing}
                      onClick={handleForceSync}
                      className="flex items-center gap-2.5 rounded-lg border border-border px-[15px] py-[9px] text-[13px] font-semibold hover:bg-accent transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                      Forzar sincronización con Shalom
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      <PaymentVerificationModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        orderId={orderId}
        orderNumber={orderHeader?.orderNumber || ""}
        onPaymentUpdated={() => {
          fetchAll();
          onOrderUpdated?.();
        }}
        canApprove={true}
      />

      <GuideDetailsModal
        open={guideModalOpen}
        onClose={() => setGuideModalOpen(false)}
        orderId={orderId}
        onGuideUpdated={() => {
          fetchAll();
          onOrderUpdated?.();
        }}
      />
    </Dialog>
  );
}
