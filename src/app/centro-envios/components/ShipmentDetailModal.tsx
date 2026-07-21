"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  MessageCircle,
  Printer,
  Copy,
  Eye,
  EyeOff,
  Truck,
  Package,
  CreditCard,
  Repeat,
  History,
  AlertTriangle,
  CheckCircle2,
  Circle,
  ExternalLink,
  RefreshCw,
  Unlink,
  ArrowRightLeft,
} from "lucide-react";

import { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import { useAuth } from "@/contexts/AuthContext";
import { getAvailableStatuses } from "@/utils/domain/orders-status-flow";
import { useQRCode } from "@/hooks/useQrCode";
import { printReceipts, ReceiptData } from "@/utils/bulk-receipt-printer";
import { trackShalomGuide } from "@/services/shalomService";
import CancellationModal, {
  type CancellationReason,
} from "@/components/modals/CancellationModal";
import {
  ShipmentBadge,
  PaymentBadge,
  IntegrationBadge,
  getPendingPayment,
  getPaidAmount,
  isFailedDelivery,
  trackingUrlFor,
} from "./shipmentUtils";

interface LogEntry {
  id: number;
  orderId: string;
  comentarios: string | null;
  operacion: string;
  timestamp: string;
  userId: string | null;
  userName?: string | null;
  isSystemGenerated?: boolean;
}

const OPERACION_LABELS: Record<string, string> = {
  CREATE: "Creación",
  CREATE_ORDER_HEADER: "Orden creada",
  UPDATE: "Actualización",
  REVERSE_PAYMENT: "Pago reversado",
  COURIER_ASSIGNED: "Courier asignado",
  COMMENT: "Comentario",
};

interface ShipmentDetailModalProps {
  open: boolean;
  order: OrderHeader | null;
  onClose: () => void;
  onOrderUpdated: () => void;
  onOpenGuideDetails: (orderId: string) => void;
  onOpenReassign: (order: OrderHeader) => void;
  onOpenPayment: (orderId: string, orderNumber: string) => void;
  onOpenCreateGuide: (order: OrderHeader) => void;
}

function buildReceiptData(order: OrderHeader): ReceiptData {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    salesChannel: order.salesChannel,
    customer: {
      fullName: order.customer.fullName,
      phoneNumber: order.customer.phoneNumber,
      dni: order.customer.documentNumber || undefined,
      address: order.customer.address,
      district: order.customer.district,
      city: order.customer.city,
      province: order.customer.province,
      reference: order.customer.reference || undefined,
    },
    items: order.items.map((i) => ({
      productName: i.productName,
      sku: i.sku,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      subtotal: Number(i.subtotal),
      discountAmount: Number(i.discountAmount),
      attributes: i.attributes,
    })),
    totals: {
      productsTotal: Number(order.subtotal),
      taxTotal: Number(order.taxTotal),
      shippingTotal: Number(order.shippingTotal),
      discountTotal: Number(order.discountTotal),
      grandTotal: Number(order.grandTotal),
      totalPaid: getPaidAmount(order),
      pendingAmount: getPendingPayment(order),
    },
  };
}

function formatLogDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ShipmentDetailModal({
  open,
  order,
  onClose,
  onOrderUpdated,
  onOpenGuideDetails,
  onOpenReassign,
  onOpenPayment,
  onOpenCreateGuide,
}: ShipmentDetailModalProps) {
  const { auth } = useAuth();
  const [tab, setTab] = useState("resumen");
  const [statusSaving, setStatusSaving] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [claveVisible, setClaveVisible] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [syncingTracking, setSyncingTracking] = useState(false);
  const [releasingGuide, setReleasingGuide] = useState(false);

  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingKey, setShippingKey] = useState("");
  const [shippingCode, setShippingCode] = useState("");
  const [shippingOffice, setShippingOffice] = useState("");
  const [savingTracking, setSavingTracking] = useState(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const trackingUrl = order ? trackingUrlFor(order) : "";
  const qrUrl = useQRCode(trackingUrl);

  useEffect(() => {
    if (!order) return;
    setTab("resumen");
    setClaveVisible(false);
    setTrackingNumber(order.externalTrackingNumber || "");
    setShippingKey(order.shippingKey || "");
    setShippingCode(order.shippingCode || "");
    setShippingOffice(order.shippingOffice || "");
  }, [order?.id]);

  const fetchLogs = useCallback(async () => {
    if (!order) return;
    setLogsLoading(true);
    try {
      const res = await axios.get<LogEntry[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/log-ventas/${order.id}`,
      );
      setLogs(res.data);
    } catch (error) {
      console.error("Error cargando historial", error);
    } finally {
      setLogsLoading(false);
    }
  }, [order?.id]);

  useEffect(() => {
    if (open) fetchLogs();
  }, [open, fetchLogs]);

  if (!order) return null;

  const getUserInfo = () => ({
    userId: auth?.user?.id,
    sellerName:
      [auth?.user?.name, auth?.user?.surname].filter(Boolean).join(" ") ||
      undefined,
  });

  const handleChangeStatus = async (
    newStatus: OrderStatus,
    cancellationReason?: CancellationReason,
    cancellationNotes?: string,
  ) => {
    if (newStatus === order.status) return;
    if (newStatus === "EN_ENVIO" && !order.courier) {
      toast.error("Asigna un courier antes de pasar a EN_ENVIO");
      return;
    }
    // Anular requiere motivo — lo pedimos antes de mandar el PATCH.
    if (newStatus === "ANULADO" && !cancellationReason) {
      setCancelModalOpen(true);
      return;
    }
    setStatusSaving(true);
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${order.id}`,
        {
          status: newStatus,
          ...(cancellationReason ? { cancellationReason } : {}),
          ...(cancellationNotes ? { notes: cancellationNotes } : {}),
          ...getUserInfo(),
        },
      );
      toast.success(`Estado actualizado a ${newStatus}`);
      setCancelModalOpen(false);
      onOrderUpdated();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "No se pudo actualizar el estado",
      );
    } finally {
      setStatusSaving(false);
    }
  };

  const handleSaveTracking = async () => {
    setSavingTracking(true);
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${order.id}`,
        {
          externalTrackingNumber: trackingNumber || null,
          shippingKey: shippingKey || null,
          shippingCode: shippingCode || null,
          shippingOffice: shippingOffice || null,
          ...(!order.guideNumber && trackingNumber
            ? { status: "ASIGNADO_A_GUIA" as OrderStatus }
            : {}),
          ...getUserInfo(),
        },
      );
      toast.success("Datos de tracking guardados");
      onOrderUpdated();
    } catch {
      toast.error("No se pudo guardar el tracking");
    } finally {
      setSavingTracking(false);
    }
  };

  const handleForceSync = async () => {
    if (!auth?.accessToken) return;
    setSyncingTracking(true);
    try {
      const guideRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${order.id}`,
      );
      await trackShalomGuide(auth.accessToken, guideRes.data.id);
      toast.success("Sincronizado con Shalom");
      onOrderUpdated();
    } catch {
      toast.error("No se pudo sincronizar con Shalom");
    } finally {
      setSyncingTracking(false);
    }
  };

  // Desvincula el pedido de su guía actual en ms-courier y lo devuelve a
  // PREPARADO en ms-ventas (mismo endpoint que usa GuideDetailsModal para
  // "desvincular pedido", + el reset explícito de status/guideNumber).
  const releaseFromGuide = async () => {
    const guideRes = await axios.get(
      `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${order.id}`,
    );
    const guideId = guideRes.data.id;
    await axios.patch(
      `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guideId}/orders/remove`,
      { orderIds: [order.id] },
    );
    await axios.patch(
      `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${order.id}`,
      { guideNumber: null, status: "PREPARADO", ...getUserInfo() },
    );
  };

  const handleReleaseFromGuide = async () => {
    if (!confirm("¿Liberar este pedido de su guía actual? Vuelve a Preparado."))
      return;
    setReleasingGuide(true);
    try {
      await releaseFromGuide();
      toast.success("Pedido liberado · vuelve a Preparado");
      onOrderUpdated();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "No se pudo liberar el pedido de la guía",
      );
    } finally {
      setReleasingGuide(false);
    }
  };

  const handleChangeCourier = async () => {
    if (
      !confirm(
        "Cambiar de courier invalida el registro actual (ej. Shalom) y libera el pedido de su guía. ¿Continuar?",
      )
    )
      return;
    setReleasingGuide(true);
    try {
      await releaseFromGuide();
      onOrderUpdated();
      onOpenCreateGuide(order);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "No se pudo cambiar el courier",
      );
    } finally {
      setReleasingGuide(false);
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    setSendingComment(true);
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_VENTAS}/log-ventas`, {
        orderId: order.id,
        comentarios: newComment.trim(),
        operacion: "COMMENT",
        userId: auth?.user?.id ?? null,
        userName: auth?.user?.email ?? null,
        data: {},
        isSystemGenerated: false,
      });
      setNewComment("");
      fetchLogs();
    } catch {
      toast.error("Error al enviar el comentario");
    } finally {
      setSendingComment(false);
    }
  };

  const handleWhatsApp = () => {
    let cleanPhone = (order.customer.phoneNumber || "").replace(/\D/g, "");
    if (!cleanPhone.startsWith("51")) {
      if (cleanPhone.startsWith("0")) cleanPhone = cleanPhone.substring(1);
      cleanPhone = `51${cleanPhone}`;
    }
    const message = `Hola ${order.customer.fullName}! Puedes rastrear tu pedido ${order.orderNumber} aquí: ${trackingUrl}`;
    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(trackingUrl);
    toast.success("Link copiado");
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await printReceipts([buildReceiptData(order)]);
    } catch {
      toast.error("No se pudo generar el comprobante");
    } finally {
      setPrinting(false);
    }
  };

  const pending = getPendingPayment(order);
  const paid = getPaidAmount(order);

  // Etapa de envío calculada a partir de los campos reales disponibles
  // (no existe todavía un endpoint de eventos/timeline por guía).
  let stage = 0;
  if (order.status === "ENTREGADO" || order.shalomStatus === "ENTREGADO") stage = 4;
  else if (order.status === "EN_ENVIO" && order.shalomStatus === "EN_DESTINO") stage = 3;
  else if (order.status === "EN_ENVIO") stage = 2;
  else if (order.guideNumber) stage = 1;

  const steps = [
    { label: "Guía asignada", done: stage >= 1 },
    { label: "En tránsito", done: stage >= 2 },
    { label: "En agencia / destino", done: stage >= 3 },
    { label: "Entregado", done: stage >= 4 },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3 flex-wrap">
            <div>
              <DialogTitle className="text-lg">
                Pedido {order.orderNumber} · {order.customer.fullName}
              </DialogTitle>
              <div className="text-sm text-muted-foreground mt-1">
                {order.customer.district} · {order.courier || "sin courier"}
                {order.guideNumber ? ` · Guía ${order.guideNumber}` : ""} ·
                Total S/{Number(order.grandTotal).toFixed(2)}
              </div>
            </div>
            <div className="flex-1" />
            <select
              value={order.status}
              disabled={statusSaving}
              onChange={(e) => handleChangeStatus(e.target.value as OrderStatus)}
              className="border rounded-md px-3 py-2 text-sm font-semibold bg-background"
            >
              {getAvailableStatuses(order.status).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 text-green-600"
              title="WhatsApp"
              onClick={handleWhatsApp}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9"
              title="Comprobante"
              onClick={() => setReceiptPreviewOpen(true)}
            >
              <Printer className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap pt-1.5">
            <ShipmentBadge order={order} />
            <PaymentBadge order={order} />
            <IntegrationBadge order={order} />
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="w-max min-w-full sm:w-fit">
              <TabsTrigger value="resumen" className="whitespace-nowrap">
                <Package className="h-4 w-4 mr-1.5" /> Resumen
              </TabsTrigger>
              <TabsTrigger value="tracking" className="whitespace-nowrap">
                <Truck className="h-4 w-4 mr-1.5" /> Tracking
              </TabsTrigger>
              <TabsTrigger value="pagos" className="whitespace-nowrap">
                <CreditCard className="h-4 w-4 mr-1.5" /> Pagos
              </TabsTrigger>
              <TabsTrigger value="reasignacion" className="whitespace-nowrap">
                <Repeat className="h-4 w-4 mr-1.5" /> Reasignación
              </TabsTrigger>
              <TabsTrigger value="historial" className="whitespace-nowrap">
                <History className="h-4 w-4 mr-1.5" /> Historial
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ---------- RESUMEN ---------- */}
          <TabsContent value="resumen" className="space-y-4 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="text-sm font-bold mb-2.5">📦 Productos</div>
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 py-2 border-b last:border-0 border-dashed text-sm"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-muted-foreground text-xs">
                          SKU {item.sku} · x{item.quantity}
                        </div>
                      </div>
                      <div className="text-right font-semibold">
                        S/{Number(item.subtotal).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border rounded-lg p-4">
                  <div className="text-sm font-bold mb-2.5">🤝 Cliente</div>
                  <div className="text-sm space-y-1.5">
                    <div>
                      <span className="text-muted-foreground">Teléfono: </span>
                      {order.customer.phoneNumber || "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Documento: </span>
                      {order.customer.documentNumber || "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Dirección: </span>
                      {order.customer.address}, {order.customer.district}
                    </div>
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="text-sm font-bold">💬 Comentarios</div>
                    <button
                      className="text-xs text-primary font-semibold"
                      onClick={() => setTab("historial")}
                    >
                      Ver todos →
                    </button>
                  </div>
                  {logsLoading && (
                    <div className="text-sm text-muted-foreground">Cargando…</div>
                  )}
                  {!logsLoading && logs.filter((l) => l.comentarios).length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      Sin comentarios
                    </div>
                  )}
                  {logs
                    .filter((l) => l.comentarios)
                    .slice(0, 2)
                    .map((c) => (
                      <div
                        key={c.id}
                        className="text-sm py-2 border-b last:border-0 border-dashed"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {c.userName || "Sistema"}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {formatLogDate(c.timestamp)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-muted-foreground">
                          {c.comentarios}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="text-sm font-bold mb-2.5">💰 Resumen de pago</div>
                  <div className="text-sm space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Productos</span>
                      <span>S/{Number(order.subtotal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Descuentos</span>
                      <span className="text-green-600">
                        -S/{Number(order.discountTotal).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pagado</span>
                      <span>S/{paid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base pt-2 border-t">
                      <span>Por cobrar</span>
                      <span className="text-primary">S/{pending.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="text-sm font-bold mb-2.5 flex items-center gap-1.5">
                    🔗 Link de seguimiento del cliente
                  </div>
                  <div className="flex items-center gap-4">
                    {qrUrl && (
                      <img
                        src={qrUrl}
                        alt="QR de seguimiento"
                        className="h-20 w-20 rounded border bg-white p-1 flex-shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-blue-600 truncate block hover:underline"
                      >
                        {trackingUrl}
                      </a>
                      <div className="flex gap-2 mt-2.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={handleCopyLink}
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-green-600"
                          onClick={handleWhatsApp}
                        >
                          <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ---------- TRACKING ---------- */}
          <TabsContent value="tracking" className="space-y-4 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="border rounded-lg p-4">
                <div className="text-sm font-bold mb-3">📍 Progreso del envío</div>
                <div className="space-y-3.5">
                  {order.shalomStatus === "DEVUELTO" ? (
                    <div className="flex items-center gap-2 text-red-600 text-sm font-semibold">
                      <AlertTriangle className="h-4 w-4" /> Paquete devuelto por
                      el courier
                    </div>
                  ) : (
                    steps.map((s) => (
                      <div key={s.label} className="flex items-center gap-2.5 text-sm">
                        {s.done ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                        <span className={s.done ? "font-medium" : "text-muted-foreground"}>
                          {s.label}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-3.5 pt-2.5 border-t">
                  Última actualización: {new Date(order.updated_at).toLocaleString("es-PE")}
                </div>
                {order.guideNumber && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-3.5 text-sm"
                    onClick={() => onOpenGuideDetails(order.id)}
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" /> Ver guía
                    completa
                  </Button>
                )}
              </div>

              <div className="border rounded-lg p-4">
                <div className="text-sm font-bold mb-1.5">🔧 Tracking manual (override)</div>
                <p className="text-xs text-muted-foreground mb-3.5">
                  Úsalo cuando el pedido se registró fuera de POWIP o el courier
                  no permitió el registro automático.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">N° tracking</Label>
                    <Input
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Código</Label>
                    <Input
                      value={shippingCode}
                      onChange={(e) => setShippingCode(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Clave de seguridad</Label>
                    <div className="flex gap-1.5">
                      <Input
                        type={claveVisible ? "text" : "password"}
                        value={shippingKey}
                        onChange={(e) => setShippingKey(e.target.value)}
                        className="h-9 text-sm"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 flex-shrink-0"
                        onClick={() => setClaveVisible((v) => !v)}
                      >
                        {claveVisible ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Oficina destino</Label>
                    <Input
                      value={shippingOffice}
                      onChange={(e) => setShippingOffice(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full mt-3.5 text-sm"
                  disabled={savingTracking}
                  onClick={handleSaveTracking}
                >
                  Guardar tracking
                </Button>
              </div>
            </div>

            {order.guideNumber && (
              <div className="border rounded-lg p-4">
                <div className="text-sm font-bold mb-2.5">
                  ⚡ Acciones logísticas
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {order.courier === "Shalom" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-sm justify-start"
                      disabled={syncingTracking}
                      onClick={handleForceSync}
                    >
                      <RefreshCw
                        className={`h-4 w-4 mr-1.5 ${syncingTracking ? "animate-spin" : ""}`}
                      />
                      Forzar sync de tracking
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-sm justify-start"
                    disabled={releasingGuide}
                    onClick={handleReleaseFromGuide}
                  >
                    <Unlink className="h-4 w-4 mr-1.5" />
                    Liberar de guía actual
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-sm justify-start"
                    disabled={releasingGuide}
                    onClick={handleChangeCourier}
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-1.5" />
                    Cambiar courier
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ---------- PAGOS ---------- */}
          <TabsContent value="pagos" className="space-y-4 pt-3">
            <div className="grid grid-cols-3 gap-3.5">
              <div className="border rounded-lg p-4 text-center">
                <div className="text-base sm:text-xl font-black">
                  S/{Number(order.grandTotal).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <div className="text-base sm:text-xl font-black text-green-600">
                  S/{paid.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">Pagado</div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <div className="text-base sm:text-xl font-black text-amber-600">
                  S/{pending.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">Saldo</div>
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm font-bold mb-2.5">💳 Pagos registrados</div>
              {order.payments.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  Sin pagos registrados
                </div>
              )}
              {order.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-sm py-2 border-b last:border-0 border-dashed"
                >
                  <div>
                    <div className="font-medium">{p.paymentMethod}</div>
                    <div className="text-muted-foreground text-xs">
                      {new Date(p.paymentDate).toLocaleDateString("es-PE")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      S/{Number(p.amount).toFixed(2)}
                    </div>
                    <div
                      className={
                        p.status === "PAID"
                          ? "text-green-600 text-xs"
                          : p.status === "PENDING"
                            ? "text-amber-600 text-xs"
                            : "text-red-600 text-xs"
                      }
                    >
                      {p.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              className="w-full text-sm"
              onClick={() => onOpenPayment(order.id, order.orderNumber)}
            >
              Gestionar pagos
            </Button>
          </TabsContent>

          {/* ---------- REASIGNACIÓN ---------- */}
          <TabsContent value="reasignacion" className="space-y-3.5 pt-3">
            {isFailedDelivery(order) ? (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-4">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-bold text-sm">
                  <AlertTriangle className="h-4 w-4" /> Entrega fallida — el
                  paquete está en retorno
                </div>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1.5">
                  El cliente no recibió el pedido. Puedes reprogramar un nuevo
                  intento o anular la entrega.
                </p>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground border rounded-lg p-4">
                Este pedido no está marcado como fallido. Si el cliente no
                recogió o rechazó la entrega, inicia el flujo para
                reprogramar un nuevo intento o anular.
              </div>
            )}
            <Button
              className="w-full text-sm"
              variant={isFailedDelivery(order) ? "default" : "outline"}
              onClick={() => onOpenReassign(order)}
            >
              <Repeat className="h-4 w-4 mr-1.5" />
              {isFailedDelivery(order)
                ? "Reprogramar o anular"
                : "Reprogramar / anular"}
            </Button>
          </TabsContent>

          {/* ---------- HISTORIAL ---------- */}
          <TabsContent value="historial" className="space-y-3.5 pt-3">
            <div className="border rounded-lg p-4">
              {logsLoading && (
                <div className="text-sm text-muted-foreground">Cargando…</div>
              )}
              {!logsLoading && logs.length === 0 && (
                <div className="text-sm text-muted-foreground">Sin registros</div>
              )}
              <div className="space-y-2.5 max-h-80 overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="text-sm border-b last:border-0 border-dashed pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {OPERACION_LABELS[log.operacion] || log.operacion}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatLogDate(log.timestamp)}
                      </span>
                    </div>
                    {log.userName && (
                      <div className="text-muted-foreground text-xs">{log.userName}</div>
                    )}
                    {log.comentarios && <p className="mt-1">{log.comentarios}</p>}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3.5 pt-3 border-t">
                <Textarea
                  placeholder="Agregar un comentario…"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={1}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  disabled={sendingComment || !newComment.trim()}
                  onClick={handleSendComment}
                >
                  Enviar
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      <CancellationModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        orderNumber={order.orderNumber}
        isLoading={statusSaving}
        onConfirm={(reason, notes) =>
          handleChangeStatus("ANULADO", reason, notes)
        }
      />

      <Dialog open={receiptPreviewOpen} onOpenChange={setReceiptPreviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Vista previa · Comprobante
            </DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg p-5 text-sm bg-white text-black">
            <div className="flex gap-3.5 items-center border-b border-dashed pb-3 mb-3">
              {qrUrl && (
                <img
                  src={qrUrl}
                  alt="QR de seguimiento"
                  className="h-20 w-20 flex-shrink-0"
                />
              )}
              <div>
                <div className="font-extrabold">COMPROBANTE DE PEDIDO</div>
                <div className="font-mono text-sm">Orden {order.orderNumber}</div>
                <div className="font-bold mt-1">
                  Total: S/{Number(order.grandTotal).toFixed(2)}
                </div>
              </div>
            </div>
            <div className="rounded-md p-2.5 mb-3 text-center bg-primary/10">
              <div className="font-extrabold text-primary">
                📱 Escanea para hacer seguimiento
              </div>
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs mt-1 break-all block hover:underline text-inherit"
              >
                {trackingUrl}
              </a>
            </div>
            <div className="border-b border-dashed pb-2.5 mb-2.5 text-gray-600">
              Nombre: {order.customer.fullName} · Tel:{" "}
              {order.customer.phoneNumber || "—"}
              <br />
              Dirección: {order.customer.address}, {order.customer.district}
            </div>
            <div className="border-b border-dashed pb-2.5 mb-2.5 space-y-1.5">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span>
                    {item.quantity} {item.productName}
                  </span>
                  <span>S/{Number(item.subtotal).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span>Total</span>
                <b>S/{Number(order.grandTotal).toFixed(2)}</b>
              </div>
              <div className="flex justify-between">
                <span>Adelanto</span>
                <span>S/{paid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-primary">
                <span>Por Cobrar</span>
                <span>S/{pending.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 text-green-600"
              onClick={handleWhatsApp}
            >
              <MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp
            </Button>
            <Button
              className="flex-1"
              disabled={printing}
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4 mr-1.5" /> Imprimir / PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
