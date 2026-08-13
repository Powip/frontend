"use client";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { toast } from "sonner";
import {
  Phone,
  PhoneOff,
  DollarSign,
  Pencil,
  Plus,
  MoreVertical,
  Check,
  Printer,
  Clock,
  User,
  Settings,
  Send,
  Copy,
  Truck,
  Package,
  Loader2,
  Lock,
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Repeat,
  Download,
  RefreshCw,
  Unlink,
  ArrowRightLeft,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/shared/WhatsAppIcon";
import { Textarea } from "../ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import CancellationModal, { CancellationReason } from "./CancellationModal";
import AddProductsModal from "./AddProductsModal";
import PaymentVerificationModal from "./PaymentVerificationModal";
import GuideDetailsModal from "./GuideDetailsModal";
import ReassignDeliveryModal from "@/app/centro-envios/components/ReassignDeliveryModal";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { useAuth } from "@/contexts/AuthContext";
import ScheduledDeliverySection from "./ScheduledDeliverySection";
import { trackShalomGuide } from "@/services/shalomService";
import { DatosIncompletosBlock } from "@/components/atencion-cliente/cc-v2/DatosIncompletosBlock";
import { CcGestionPanel } from "@/components/atencion-cliente/cc-v2/CcGestionPanel";
import { CcScriptPanel } from "@/components/atencion-cliente/cc-v2/CcScriptPanel";
import { OrderHeader, OrderStatus, SubEstadoCc } from "@/interfaces/IOrder";
import { getAvailableStatuses, getStatusLabel } from "@/utils/domain/orders-status-flow";
import { isJunkDni } from "@/utils/junk-document.util";
import {
  printOrderLabel,
  PRINT_DELIVERY_TYPE_LABEL,
  type OrderReceipt,
} from "@/utils/printOrderLabel";

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
  CREATE_ORDER_WITH_ITEMS: "Orden con items creada",
  ADD_ORDER_ITEM: "Item agregado",
  REMOVE_ORDER_ITEM: "Item eliminado",
  UPDATE: "Actualización",
  REVERSE_PAYMENT: "Pago reversado",
  HARDDELETED: "Eliminado",
  REACTIVATE: "Reactivado",
  INACTIVATE: "Inactivado",
  COURIER_ASSIGNED: "Courier asignado",
  COMMENT: "Comentario",
};

/** Shipping Guide data for tracking view */
export interface ShippingGuideData {
  id: string;
  guideNumber: string;
  courierName?: string | null;
  status: string;
  chargeType?: string | null;
  amountToCollect?: number | null;
  scheduledDate?: string | null;
  deliveryZone: string;
  deliveryType: string;
  deliveryAddress?: string | null;
  notes?: string | null;
  trackingUrl?: string | null;
  shippingKey?: string | null;
  shippingCode?: string | null;
  shippingOffice?: string | null;
  shippingProofUrl?: string | null;
  created_at: string;
  daysSinceCreated?: number;
}

interface Props {
  open: boolean;
  orderId: string;
  onClose: () => void;
  onOrderUpdated?: () => void;
  /** Hide call management section for non-customer-service views */
  hideCallManagement?: boolean;
  /** Optional shipping guide data to display in the modal */
  shippingGuide?: ShippingGuideData | null;
  /** Mostrar campos de tracking editables */
  showTracking?: boolean;
  /** Modo Operaciones: libera el botón CONFIRMA ENTREGA y muestra Anular siempre */
  isOperaciones?: boolean;
  /** Si se pasa, habilita "Cambiar courier" en la pestaña Seguimiento (libera de la guía
   *  actual y delega la creación de una nueva al caller — hoy solo lo usa Ventas). */
  onOpenCreateGuide?: (order: OrderHeader) => void;
}

/** Color del badge de estado en el comprobante PDF — por estado real (no agrupado como en la etiqueta). */
const PDF_STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  PENDIENTE: { bg: "#fef3c7", color: "#92400e" },
  PREPARADO: { bg: "#e0e7ff", color: "#3730a3" },
  LLAMADO: { bg: "#ede9fe", color: "#5b21b6" },
  ASIGNADO_A_GUIA: { bg: "#e0e7ff", color: "#3730a3" },
  EN_ENVIO: { bg: "#cffafe", color: "#155e75" },
  ENTREGADO: { bg: "#dcfce7", color: "#166534" },
  ANULADO: { bg: "#fee2e2", color: "#991b1b" },
  PAGADO: { bg: "#ccfbf1", color: "#115e59" },
};

/** "META_ADS" → "Meta Ads" — para no mostrar el enum crudo en canal/método de pago. */
function toTitleCase(value?: string | null): string {
  if (!value) return "-";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function CustomerServiceModal({
  open,
  orderId,
  onClose,
  onOrderUpdated,
  hideCallManagement = false,
  shippingGuide: shippingGuideProp,
  showTracking = false,
  isOperaciones = false,
  onOpenCreateGuide,
}: Props) {
  const router = useRouter();
  const { auth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [addProductsModalOpen, setAddProductsModalOpen] = useState(false);
  const [guideDetailsModalOpen, setGuideDetailsModalOpen] = useState(false);

  // Comments timeline states
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isSendingComment, setIsSendingComment] = useState(false);

  // Notes states
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Print confirmation state
  const [printConfirmOpen, setPrintConfirmOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Scheduling states
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    undefined,
  );
  const [isScheduling, setIsScheduling] = useState(false);

  // Pestañas del modal unificado + estado crudo de la orden (para Vendedor,
  // selector de estado, y como `order` de ReassignDeliveryModal).
  const [tab, setTab] = useState("resumen");
  const [orderHeader, setOrderHeader] = useState<OrderHeader | null>(null);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [syncingTracking, setSyncingTracking] = useState(false);
  const [releasingGuide, setReleasingGuide] = useState(false);
  const [shippingGuideData, setShippingGuideData] = useState<ShippingGuideData | null>(null);
  // Si el caller pasa `shippingGuide` explícitamente (aunque sea null), se respeta ese valor
  // controlado; si no lo pasa (undefined), el modal busca la guía por su cuenta.
  const shippingGuide =
    shippingGuideProp !== undefined ? shippingGuideProp : shippingGuideData;

  // CC v2 — datos incompletos y gestión
  const [datosCompletos, setDatosCompletos] = useState<boolean>(true);
  const [dniCliente, setDniCliente] = useState<string | null>(null);
  const [referenciaEntrega, setReferenciaEntrega] = useState<string | null>(null);
  const [canalOrigen, setCanalOrigen] = useState<string | null>(null);
  const [subEstadoCc, setSubEstadoCc] = useState<SubEstadoCc | null>(null);

  // Aliclik
  const [aliclikDispatchStatus, setAliclikDispatchStatus] = useState<string | null>(null);
  const [aliclikSyncedAt, setAliclikSyncedAt] = useState<string | null>(null);

  // EVA
  const [evaStatus, setEvaStatus] = useState<string | null>(null);
  const [evaSyncedAt, setEvaSyncedAt] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!orderId) return;
    setLogsLoading(true);
    try {
      const res = await axios.get<LogEntry[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/log-ventas/${orderId}`,
      );
      setLogs(res.data);
    } catch (error) {
      console.error("Error cargando historial", error);
    } finally {
      setLogsLoading(false);
    }
  }, [orderId]);

  const handleSendComment = async () => {
    if (!newComment.trim() || !orderId) return;
    setIsSendingComment(true);
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_VENTAS}/log-ventas`, {
        orderId,
        comentarios: newComment.trim(),
        operacion: "COMMENT",
        userId: auth?.user?.id ?? null,
        userName: auth?.user?.email ?? null,
        data: {},
        isSystemGenerated: false,
      });
      setNewComment("");
      fetchLogs();
    } catch (error) {
      console.error("Error enviando comentario", error);
      toast.error("Error al enviar el comentario");
    } finally {
      setIsSendingComment(false);
    }
  };

  const formatLogDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const fetchReceipt = useCallback(async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}/receipt`,
      );
      setReceipt(res.data);

      const orderRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
      );
      setOrderHeader(orderRes.data);
      setNotes(orderRes.data.notes || "");
      // CC v2: cargar campos de datos incompletos + sub-estado
      setDatosCompletos(orderRes.data.datosCompletos ?? true);
      setDniCliente(orderRes.data.dniCliente ?? null);
      setReferenciaEntrega(orderRes.data.referenciaEntrega ?? null);
      setCanalOrigen(orderRes.data.canalOrigen ?? null);
      setSubEstadoCc(orderRes.data.subEstadoCc ?? null);
      setAliclikDispatchStatus(orderRes.data.aliclikDispatchStatus ?? null);
      setAliclikSyncedAt(orderRes.data.aliclikSyncedAt ?? null);
      setEvaStatus(orderRes.data.evaStatus ?? null);
      setEvaSyncedAt(orderRes.data.evaSyncedAt ?? null);
    } catch (err) {
      console.error("Error fetching receipt", err);
      toast.error("Error al cargar el pedido");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const fetchShippingGuide = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${orderId}`,
      );
      const guide = res.data;
      let daysSinceCreated = 0;
      if (guide?.created_at) {
        daysSinceCreated = Math.ceil(
          Math.abs(Date.now() - new Date(guide.created_at).getTime()) / (1000 * 60 * 60 * 24),
        );
      }
      setShippingGuideData({
        id: guide.id,
        guideNumber: guide.guideNumber,
        courierName: guide.courierName,
        status: guide.status,
        chargeType: guide.chargeType,
        amountToCollect: guide.amountToCollect,
        scheduledDate: guide.scheduledDate?.toString() || null,
        deliveryZone: guide.deliveryZone,
        deliveryType: guide.deliveryType,
        deliveryAddress: guide.deliveryAddress,
        notes: guide.notes,
        trackingUrl: guide.trackingUrl,
        shippingKey: guide.shippingKey,
        shippingOffice: guide.shippingOffice,
        shippingProofUrl: guide.shippingProofUrl,
        created_at: guide.created_at,
        daysSinceCreated,
      });
    } catch {
      setShippingGuideData(null);
    }
  }, [orderId]);

  useEffect(() => {
    if (!open || !orderId) return;
    setOriginalTracking(null);
    fetchReceipt();
    fetchLogs();
    if (shippingGuideProp === undefined) {
      setShippingGuideData(null);
      fetchShippingGuide();
    }
  }, [open, orderId, fetchReceipt, fetchLogs, fetchShippingGuide, shippingGuideProp]);

  const handleUpdateCallStatus = async (
    callStatus: "CONFIRMED" | "NO_ANSWER",
  ) => {
    try {
      const payload: { callStatus: string; status?: string } = { callStatus };

      if (callStatus === "CONFIRMED") {
        payload.status = "LLAMADO";
        if (isOperaciones && isJunkDni(receipt?.customer?.dni)) {
          toast.warning("DNI vacío o inválido, pero la entrega fue confirmada");
        }
      }

      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        payload,
      );

      toast.success(
        callStatus === "CONFIRMED"
          ? "Entrega confirmada"
          : "Registrado como no contesta",
      );
      fetchReceipt();
      onOrderUpdated?.();
    } catch (error) {
      console.error("Error updating call status", error);
      toast.error("Error al actualizar el estado");
    }
  };

  const handleScheduleCallback = async () => {
    if (!scheduledDate || !orderId) return;

    try {
      setIsScheduling(true);

      // Ajustar a formato ISO para el backend
      const callbackAt = scheduledDate.toISOString();

      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        {
          callStatus: "SCHEDULED",
          callbackAt,
          userId: auth?.user?.id,
          sellerName: auth?.user?.email,
        },
      );

      // Registrar log de programación
      await axios.post(`${process.env.NEXT_PUBLIC_API_VENTAS}/log-ventas`, {
        orderId,
        comentarios: `Llamada programada para el ${format(scheduledDate, "PPPPp", { locale: es })}`,
        operacion: "SCHEDULE_CALLBACK",
        userId: auth?.user?.id ?? null,
        userName: auth?.user?.email ?? null,
        data: { callbackAt },
        isSystemGenerated: false,
      });

      toast.success(
        `Llamada programada para ${format(scheduledDate, "dd/MM HH:mm")}`,
      );
      setScheduledDate(undefined);
      fetchReceipt();
      fetchLogs();
      onOrderUpdated?.();
    } catch (error) {
      console.error("Error scheduling callback", error);
      toast.error("Error al programar la llamada");
    } finally {
      setIsScheduling(false);
    }
  };

  const handleSaveNotes = async () => {
    try {
      setSavingNotes(true);
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        { notes },
      );
      toast.success("Notas guardadas correctamente");
    } catch (error) {
      console.error("Error saving notes", error);
      toast.error("Error al guardar las notas");
    } finally {
      setSavingNotes(false);
    }
  };

  const [savingTracking, setSavingTracking] = useState(false);
  const [revealKey, setRevealKey] = useState(false);
  const [originalTracking, setOriginalTracking] = useState<any>(null);

  useEffect(() => {
    if (receipt && !originalTracking) {
      setOriginalTracking({
        externalTrackingNumber: receipt.externalTrackingNumber || "",
        shippingCode: receipt.shippingCode || "",
        shippingKey: receipt.shippingKey || "",
        shippingOffice: receipt.shippingOffice || "",
      });
    }
  }, [receipt, originalTracking]);

  const handleSaveTracking = async () => {
    if (!receipt || !orderId || !originalTracking) return;

    // Detect if there are actual changes
    const hasChanges =
      (receipt.externalTrackingNumber || "") !==
        originalTracking.externalTrackingNumber ||
      (receipt.shippingCode || "") !== originalTracking.shippingCode ||
      (receipt.shippingKey || "") !== originalTracking.shippingKey ||
      (receipt.shippingOffice || "") !== originalTracking.shippingOffice;

    if (!hasChanges) return;

    try {
      setSavingTracking(true);
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        {
          externalTrackingNumber: receipt.externalTrackingNumber,
          shippingCode: receipt.shippingCode,
          shippingKey: receipt.shippingKey,
          shippingOffice: receipt.shippingOffice,
        },
      );
      toast.success("Tracking actualizado");
      // Update original tracking to match new saved state
      setOriginalTracking({
        externalTrackingNumber: receipt.externalTrackingNumber || "",
        shippingCode: receipt.shippingCode || "",
        shippingKey: receipt.shippingKey || "",
        shippingOffice: receipt.shippingOffice || "",
      });
      onOrderUpdated?.();
    } catch (error) {
      console.error("Error saving tracking:", error);
      toast.error("Error al actualizar tracking");
    } finally {
      setSavingTracking(false);
    }
  };

  const updateTrackingField = (field: keyof OrderReceipt, value: string) => {
    if (!receipt) return;
    setReceipt({ ...receipt, [field]: value });
  };

  const handleWhatsApp = () => {
    if (!receipt) return;
    const phone = receipt.customer.phoneNumber?.replace(/\D/g, "") || "";
    const cleanPhone = phone.startsWith("51") ? phone : `51${phone}`;

    const trackingUrl = `${process.env.NEXT_PUBLIC_LANDING_URL}/rastreo/${receipt.orderNumber}`;
    const message = `Hola ${receipt.customer.fullName}! Te contactamos por tu pedido ${receipt.orderNumber}.\n\nPuedes rastrear tu pedido aquí: ${trackingUrl}`;

    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
  };

  const copyField = async (value: string | undefined, fieldName: string) => {
    if (!value || value === "-") {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error("Error copiando", error);
    }
  };

  const generateQR = async (text: string) => {
    try {
      return await QRCode.toDataURL(text, { width: 120 });
    } catch (err) {
      console.error("Error generating QR", err);
      return "";
    }
  };

  const handleDownloadPdf = async () => {
    if (!receipt) return;

    // Mismo link público de rastreo que la etiqueta — consistente en vez de
    // codificar el orderId crudo (que al escanearlo no llevaba a nada útil).
    const trackingUrlForQr = `${process.env.NEXT_PUBLIC_LANDING_URL}/rastreo/${receipt.orderNumber}`;
    const qrDataUrl = await generateQR(trackingUrlForQr);

    const totalPaid = receipt.totals.totalPaid || 0;
    const pendingAmount = receipt.totals.pendingAmount || 0;

    const rawStatus = orderHeader?.status ?? receipt.status;
    const statusColor = PDF_STATUS_COLOR[rawStatus] ?? { bg: "#f1f5f9", color: "#334155" };
    const statusLabel = getStatusLabel(rawStatus as OrderStatus).toUpperCase();
    const deliveryLabel =
      PRINT_DELIVERY_TYPE_LABEL[orderHeader?.deliveryType ?? ""] ??
      orderHeader?.deliveryType ??
      "-";
    const paymentMethods =
      Array.from(new Set(receipt.payments.map((p) => toTitleCase(p.paymentMethod)))).join(" / ") ||
      "-";
    const emitido = format(new Date(receipt.createdAt), "dd/MM/yyyy · HH:mm");
    const direccion = [
      receipt.customer.address,
      receipt.customer.district,
      receipt.customer.province ? `${receipt.customer.city || ""} - ${receipt.customer.province}` : receipt.customer.city,
    ]
      .filter(Boolean)
      .join(" · ");

    const pdfHtml = `
      <div id="pdf-comprobante-root">
        <style>
          #pdf-comprobante-root { font-family: Arial, sans-serif; color: #111; padding: 32px; background: #fff; }
          #pdf-comprobante-root .head-row { display: flex; justify-content: space-between; align-items: flex-start; }
          #pdf-comprobante-root .company { display: flex; gap: 14px; align-items: center; }
          #pdf-comprobante-root .logo-box {
            width: 56px; height: 56px; border-radius: 10px; background: #0f766e; color: #fff;
            display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; overflow: hidden;
          }
          #pdf-comprobante-root .logo-box img { width: 100%; height: 100%; object-fit: contain; }
          #pdf-comprobante-root .company-name { font-size: 22px; font-weight: bold; }
          #pdf-comprobante-root .company-meta { font-size: 11px; color: #666; margin-top: 3px; }
          #pdf-comprobante-root .doc-info { text-align: right; }
          #pdf-comprobante-root .doc-badge {
            display: inline-block; background: #d1fae5; color: #065f46; font-size: 10px; font-weight: bold;
            letter-spacing: 0.5px; padding: 4px 10px; border-radius: 4px;
          }
          #pdf-comprobante-root .doc-title { font-size: 22px; font-weight: bold; margin-top: 6px; }
          #pdf-comprobante-root .doc-order { font-size: 12px; color: #555; margin-top: 2px; }
          #pdf-comprobante-root .divider { height: 3px; background: #0f766e; margin: 18px 0; border-radius: 2px; }
          #pdf-comprobante-root .summary-row { display: flex; gap: 26px; align-items: flex-start; margin-bottom: 22px; }
          #pdf-comprobante-root .summary-qr { width: 96px; height: 96px; flex-shrink: 0; }
          #pdf-comprobante-root .summary-grid { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 20px; }
          #pdf-comprobante-root .summary-label { font-size: 9.5px; font-weight: bold; color: #888; letter-spacing: 0.4px; margin-bottom: 3px; }
          #pdf-comprobante-root .summary-value { font-size: 13px; font-weight: 600; }
          #pdf-comprobante-root .status-badge {
            display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: bold;
            background: ${statusColor.bg}; color: ${statusColor.color};
          }
          #pdf-comprobante-root .customer-box { background: #f8fafc; border-radius: 8px; padding: 16px 18px; margin-bottom: 20px; }
          #pdf-comprobante-root .customer-title { font-size: 11px; font-weight: bold; color: #0f766e; letter-spacing: 0.5px; margin-bottom: 10px; }
          #pdf-comprobante-root .customer-grid { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 12px 20px; }
          #pdf-comprobante-root .customer-grid .full { grid-column: 1 / -1; }
          #pdf-comprobante-root table.items { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          #pdf-comprobante-root table.items thead tr { background: #111827; color: #fff; }
          #pdf-comprobante-root table.items th { text-align: left; font-size: 10px; letter-spacing: 0.4px; padding: 9px 10px; }
          #pdf-comprobante-root table.items th.num, #pdf-comprobante-root table.items td.num { text-align: right; }
          #pdf-comprobante-root table.items td { padding: 10px; font-size: 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
          #pdf-comprobante-root .attr-pill {
            display: inline-block; background: #f1f5f9; color: #475569; font-size: 9.5px; font-weight: 600;
            padding: 2px 8px; border-radius: 4px; margin: 2px 4px 0 0;
          }
          #pdf-comprobante-root .totals { width: 320px; margin-left: auto; }
          #pdf-comprobante-root .totals-line { display: flex; justify-content: space-between; font-size: 12px; color: #444; padding: 3px 0; }
          #pdf-comprobante-root .totals-line b { color: #111; font-weight: 600; }
          #pdf-comprobante-root .total-main {
            display: flex; justify-content: space-between; align-items: baseline; border-top: 2px solid #111;
            margin-top: 8px; padding-top: 10px;
          }
          #pdf-comprobante-root .total-main .label { font-size: 16px; font-weight: bold; }
          #pdf-comprobante-root .total-main .value { font-size: 24px; font-weight: bold; }
          #pdf-comprobante-root .advance-line { display: flex; justify-content: space-between; font-size: 12px; color: #555; margin-top: 6px; }
          #pdf-comprobante-root .due-box {
            display: flex; justify-content: space-between; align-items: center; margin-top: 14px;
            padding: 12px 16px; border-radius: 8px; background: #fef3c7; color: #92400e;
          }
          #pdf-comprobante-root .due-box.paid { background: #dcfce7; color: #166534; }
          #pdf-comprobante-root .due-box .label { font-size: 12px; font-weight: bold; letter-spacing: 0.5px; }
          #pdf-comprobante-root .due-box .value { font-size: 20px; font-weight: bold; }
          #pdf-comprobante-root .footer { text-align: center; font-size: 10px; color: #888; margin-top: 30px; line-height: 1.6; }
        </style>

        <div class="head-row">
          <div class="company">
            <div class="logo-box">${auth?.company?.logoUrl ? `<img src="${auth.company.logoUrl}" alt="Logo">` : "LOGO"}</div>
            <div>
              <div class="company-name">${auth?.company?.name ?? "-"}</div>
              <div class="company-meta">${[
                auth?.company?.cuit ? `RUC ${auth.company.cuit}` : null,
                auth?.company?.billingAddress || null,
              ]
                .filter(Boolean)
                .join(" · ")}</div>
            </div>
          </div>
          <div class="doc-info">
            <span class="doc-badge">COMPROBANTE · ${(receipt.receiptType || "BOLETA").toUpperCase()}</span>
            <div class="doc-title">Nota de venta</div>
            <div class="doc-order">N° Orden: ${receipt.orderNumber}</div>
          </div>
        </div>

        <div class="divider"></div>

        <div class="summary-row">
          ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" class="summary-qr">` : ""}
          <div class="summary-grid">
            <div>
              <div class="summary-label">ESTADO</div>
              <span class="status-badge">${statusLabel}</span>
            </div>
            <div>
              <div class="summary-label">FECHA DE EMISIÓN</div>
              <div class="summary-value">${emitido}</div>
            </div>
            <div>
              <div class="summary-label">CANAL</div>
              <div class="summary-value">${toTitleCase(receipt.salesChannel)}</div>
            </div>
            <div>
              <div class="summary-label">TIPO DE ENTREGA</div>
              <div class="summary-value">${deliveryLabel}</div>
            </div>
            <div>
              <div class="summary-label">COURIER</div>
              <div class="summary-value">${orderHeader?.courier || "-"}</div>
            </div>
            <div>
              <div class="summary-label">MÉTODO DE PAGO</div>
              <div class="summary-value">${paymentMethods}</div>
            </div>
          </div>
        </div>

        <div class="customer-box">
          <div class="customer-title">DATOS DEL CLIENTE</div>
          <div class="customer-grid">
            <div>
              <div class="summary-label">NOMBRE</div>
              <div class="summary-value">${receipt.customer.fullName}</div>
            </div>
            <div>
              <div class="summary-label">TELÉFONO</div>
              <div class="summary-value">${receipt.customer.phoneNumber || "-"}</div>
            </div>
            <div>
              <div class="summary-label">DNI</div>
              <div class="summary-value">${receipt.customer.dni || "-"}</div>
            </div>
            <div class="full">
              <div class="summary-label">DIRECCIÓN</div>
              <div class="summary-value">${direccion || "-"}</div>
            </div>
          </div>
        </div>

        <table class="items">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Variantes</th>
              <th class="num">Cantidad</th>
              <th class="num">P. Unitario</th>
              <th class="num">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${receipt.items
              .map(
                (item: any) => `
              <tr>
                <td><b>${item.productName}</b></td>
                <td>${
                  item.attributes
                    ? Object.entries(item.attributes)
                        .map(([k, v]) => `<span class="attr-pill">${k}: ${v}</span>`)
                        .join("")
                    : "-"
                }</td>
                <td class="num">${item.quantity}</td>
                <td class="num">S/ ${Number(item.unitPrice).toFixed(2)}</td>
                <td class="num">S/ ${Number(item.subtotal).toFixed(2)}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-line"><span>Productos</span><b>S/ ${receipt.totals.productsTotal.toFixed(2)}</b></div>
          <div class="totals-line"><span>IGV 18%</span><b>S/ ${receipt.totals.taxTotal.toFixed(2)}</b></div>
          <div class="totals-line"><span>Envío</span><b>S/ ${receipt.totals.shippingTotal.toFixed(2)}</b></div>
          <div class="totals-line"><span>Descuentos</span><b>S/ ${receipt.totals.discountTotal.toFixed(2)}</b></div>
          <div class="total-main"><span class="label">Total</span><span class="value">S/ ${receipt.totals.grandTotal.toFixed(2)}</span></div>
          ${
            totalPaid > 0
              ? `<div class="advance-line"><span>Adelanto pagado</span><span>– S/ ${totalPaid.toFixed(2)}</span></div>`
              : ""
          }
          ${
            pendingAmount > 0
              ? `<div class="due-box"><span class="label">POR COBRAR</span><span class="value">S/ ${pendingAmount.toFixed(2)}</span></div>`
              : `<div class="due-box paid"><span class="label">PAGADO</span><span class="value">S/ ${receipt.totals.grandTotal.toFixed(2)}</span></div>`
          }
        </div>

        <div class="footer">
          Documento interno de venta generado por POWIP · No constituye comprobante electrónico SUNAT.<br>
          Gracias por tu compra.
        </div>
      </div>
    `;

    // Se renderiza en un <iframe> con su propio documento en blanco, NO como
    // hijo directo de document.body: esta app usa Tailwind 4, cuyas
    // variables de color (--background, --foreground, etc.) están en
    // oklch() — html2canvas (motor de html2pdf.js) no sabe parsear oklch()
    // y tira error apenas intenta leer los estilos heredados de <body>/<html>
    // de la página real. Un iframe aislado no carga ese CSS, así que nunca
    // lo pisa.
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-10000px";
    iframe.style.top = "0";
    iframe.style.width = "800px";
    iframe.style.height = "1200px";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    try {
      const idoc = iframe.contentDocument;
      if (!idoc) throw new Error("No se pudo preparar el documento del comprobante");
      idoc.open();
      idoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;">${pdfHtml}</body></html>`);
      idoc.close();

      // Da tiempo a que el iframe termine de montar el DOM/las imágenes
      // (data: URIs, cargan casi instantáneo, pero no son síncronas).
      await new Promise((resolve) => setTimeout(resolve, 50));
      const target = idoc.getElementById("pdf-comprobante-root") ?? idoc.body;

      // html2pdf.js (que envuelve html2canvas + jsPDF) usa una versión de
      // html2canvas que no sabe parsear colores lab()/oklch() — Chrome
      // devuelve colores en esos formatos desde getComputedStyle() aunque
      // el CSS original use hex, así que tiraba "Attempting to parse an
      // unsupported color function" incluso ya aislado en el iframe.
      // html2canvas-pro es un fork que sí los soporta — se orquesta acá a
      // mano en vez de con html2pdf.js (que trae su propio html2canvas
      // interno, no reemplazable).
      const canvas = await html2canvas(target as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.98);

      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, imgHeight);
      pdf.save(`Comprobante_${receipt.orderNumber}.pdf`);
    } catch (err) {
      console.error("Error generando comprobante PDF", err);
      toast.error("No se pudo generar el comprobante");
    } finally {
      document.body.removeChild(iframe);
    }
  };

  const handlePrint = async () => {
    if (!receipt) return;
    await printOrderLabel(receipt, orderHeader, auth?.company);

    // Si el pedido está en PENDIENTE, mostrar confirmación para pasar a PREPARADO
    if (receipt.status === "PENDIENTE") {
      setPrintConfirmOpen(true);
    }
  };

  const handleConfirmPrintStatus = async () => {
    try {
      setIsUpdatingStatus(true);
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        { status: "PREPARADO" },
      );
      toast.success("Pedido actualizado a PREPARADO");
      fetchReceipt();
      onOrderUpdated?.();
      setPrintConfirmOpen(false);
    } catch (error) {
      console.error("Error updating status to PREPARADO", error);
      toast.error("No se pudo actualizar el estado del pedido");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handlePrintShippingReceipt = async () => {
    if (!receipt || !shippingGuide) return;

    // Datos de la company desde el auth context
    const company = auth?.company;
    const companyName = company?.name || "MI EMPRESA";
    const companyCuit = company?.cuit || "";
    const companyAddress = company?.billingAddress || "";
    const companyPhone = company?.phone || "";
    const companyLogo = company?.logoUrl;

    const printWindow = window.open("", "_blank", "width=500,height=700");
    if (!printWindow) {
      toast.error("No se pudo abrir la ventana de impresión");
      return;
    }

    // Construir dirección completa del consignado con formato courier
    const courierName = shippingGuide.courierName || "COURIER";
    const customerAddress = shippingGuide.shippingOffice
      ? `${courierName} ${shippingGuide.shippingOffice}`
      : receipt.customer.address || "-";

    // Logo: usar imagen si existe, sino texto del nombre de la empresa
    const logoElement = companyLogo
      ? `<img src="${companyLogo}" alt="${companyName}" class="brand-logo">`
      : `<div class="brand-name">${companyName}</div>`;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Comprobante de Envío - ${receipt.orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            padding: 20px;
            max-width: 400px;
            margin: 0 auto;
          }
          .container {
            border: 2px solid #000;
            padding: 20px;
          }
          .row {
            display: flex;
            margin-bottom: 15px;
          }
          .col-left {
            width: 45%;
            font-size: 10px;
            line-height: 1.4;
          }
          .col-right {
            width: 55%;
            text-align: right;
            display: flex;
            align-items: center;
            justify-content: flex-end;
          }
          .section-title {
            font-weight: bold;
            font-size: 10px;
            margin-bottom: 2px;
          }
          .brand-logo {
            max-height: 40px;
            max-width: 120px;
            object-fit: contain;
          }
          .brand-name {
            font-size: 20px;
            font-weight: bold;
            letter-spacing: 1px;
          }
          .label {
            font-size: 9px;
            color: #666;
          }
          .consignado-title {
            font-size: 10px;
            font-weight: bold;
            margin-bottom: 4px;
          }
          .customer-name {
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 6px;
          }
          .dni-row {
            margin-bottom: 4px;
            font-size: 10px;
          }
          .dni-label {
            font-weight: bold;
          }
          .info-value {
            font-size: 11px;
          }
          .location {
            font-size: 11px;
            margin-bottom: 4px;
            text-transform: uppercase;
          }
          .address-line {
            font-size: 10px;
            text-transform: uppercase;
          }
          .courier-box {
            margin-top: 15px;
            padding-top: 12px;
            border-top: 1px solid #ccc;
          }
          .courier-name {
            font-size: 24px;
            font-weight: bold;
            letter-spacing: 1px;
          }
          .order-footer {
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px dashed #999;
            font-size: 10px;
            text-align: center;
            color: #666;
          }
          @media print {
            body { padding: 10px; }
            @page { margin: 5mm; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="row">
            <!-- REMITENTE (lado izquierdo) -->
            <div class="col-left">
              <div class="section-title">REMITENTE</div>
              <div>${companyName}</div>
              ${companyCuit ? `<div>${companyCuit}</div>` : ""}
              ${companyAddress ? `<div>${companyAddress}</div>` : ""}
              ${companyPhone ? `<div>${companyPhone}</div>` : ""}
            </div>
            
            <!-- MARCA/LOGO (lado derecho) -->
            <div class="col-right">
              ${logoElement}
            </div>
          </div>

          <!-- CONSIGNADO -->
          <div style="text-align: right; margin-top: 10px;">
            <div class="consignado-title">CONSIGNADO</div>
            <div class="customer-name">${receipt.customer.fullName}</div>
            
            <div class="dni-row">
              <span class="dni-label">DNI</span> 
              <span class="info-value">${receipt.customer.dni || "-"}</span>
            </div>
            
            <div class="dni-row">
              <span class="dni-label">TELEFONO</span> 
              <span class="info-value">${receipt.customer.phoneNumber || "-"}</span>
            </div>
            
            <div class="location">
              ${receipt.customer.province || "-"} - ${receipt.customer.city || receipt.customer.province || "-"} - ${receipt.customer.district || "-"}
            </div>
            
            <div class="address-line">
              ${customerAddress}
            </div>
          </div>

          <!-- COURIER -->
          <div class="courier-box">
            <div class="courier-name">${courierName.toUpperCase()}</div>
          </div>

        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };

  const handleConfirmCancellation = async (
    reason: CancellationReason,
    reasonNotes?: string,
  ) => {
    setIsCancelling(true);
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        {
          status: "ANULADO",
          cancellationReason: reason,
          notes: reasonNotes,
        },
      );
      toast.success("Venta anulada");
      setCancellationModalOpen(false);
      onClose();
      onOrderUpdated?.();
    } catch (error) {
      console.error("Error cancelling order", error);
      toast.error("No se pudo anular la venta");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleChangeStatus = async (newStatus: OrderStatus) => {
    if (!receipt || newStatus === receipt.status) return;
    if (newStatus === "ANULADO") {
      setCancellationModalOpen(true);
      return;
    }
    if (newStatus === "EN_ENVIO" && !orderHeader?.courier) {
      toast.error("Asigna un courier antes de pasar a EN_ENVIO");
      return;
    }
    setChangingStatus(true);
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        { status: newStatus },
      );
      toast.success(`Estado actualizado a ${newStatus}`);
      fetchReceipt();
      onOrderUpdated?.();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "No se pudo actualizar el estado",
      );
    } finally {
      setChangingStatus(false);
    }
  };

  const handleReprogramDelivery = async (targetId: string, callbackAt: Date) => {
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${targetId}`,
        { callStatus: "SCHEDULED", callbackAt: callbackAt.toISOString() },
      );
      toast.success("Pedido reprogramado");
      setReassignModalOpen(false);
      fetchReceipt();
      onOrderUpdated?.();
    } catch {
      toast.error("No se pudo reprogramar el pedido");
    }
  };

  const handleForceSyncTracking = async () => {
    if (!auth?.accessToken || !orderHeader) return;
    setSyncingTracking(true);
    try {
      const guideRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${orderHeader.id}`,
      );
      await trackShalomGuide(auth.accessToken, guideRes.data.id);
      toast.success("Sincronizado con Shalom");
      fetchReceipt();
      onOrderUpdated?.();
    } catch {
      toast.error("No se pudo sincronizar con Shalom");
    } finally {
      setSyncingTracking(false);
    }
  };

  // Desvincula el pedido de su guía actual en ms-courier y lo devuelve a
  // PREPARADO en ms-ventas (mismo patrón que usaba ShipmentDetailModal).
  const releaseFromGuide = async () => {
    if (!orderHeader) return;
    const guideRes = await axios.get(
      `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${orderHeader.id}`,
    );
    const guideId = guideRes.data.id;
    await axios.patch(
      `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guideId}/orders/remove`,
      { orderIds: [orderHeader.id] },
    );
    await axios.patch(
      `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderHeader.id}`,
      { guideNumber: null, status: "PREPARADO" },
    );
  };

  const handleReleaseFromGuide = async () => {
    if (!confirm("¿Liberar este pedido de su guía actual? Vuelve a Preparado."))
      return;
    setReleasingGuide(true);
    try {
      await releaseFromGuide();
      toast.success("Pedido liberado · vuelve a Preparado");
      fetchReceipt();
      onOrderUpdated?.();
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
    if (!orderHeader || !onOpenCreateGuide) return;
    if (
      !confirm(
        "Cambiar de courier invalida el registro actual (ej. Shalom) y libera el pedido de su guía. ¿Continuar?",
      )
    )
      return;
    setReleasingGuide(true);
    try {
      await releaseFromGuide();
      onOrderUpdated?.();
      onOpenCreateGuide(orderHeader);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "No se pudo cambiar el courier",
      );
    } finally {
      setReleasingGuide(false);
    }
  };

  const isConfirmed = receipt?.status === "LLAMADO";
  const isScheduledDelivery =
    !!receipt?.externalSource && receipt?.callStatus === "SCHEDULED";

  if (!receipt && !loading) return null;

  // Si no hay nada que mostrar en la columna de gestión (llamada/upsell/aliclik/script),
  // el historial de comentarios pasa a ocupar el ancho completo en vez de dejar un hueco vacío.
  const hasGestionColumn =
    !hideCallManagement ||
    !!receipt?.upsellOffered ||
    !!receipt?.upsellAccepted ||
    !!aliclikDispatchStatus ||
    !!aliclikSyncedAt ||
    !!subEstadoCc;

  // Más reciente primero
  const displayLogs = [...logs].reverse();

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
          {(loading || !receipt) && (
            <DialogTitle className="sr-only">Detalle del Pedido</DialogTitle>
          )}
          {loading ? (
            <div className="p-8 text-center">Cargando...</div>
          ) : (
            receipt && (
              <div className="space-y-4">
                <DialogHeader>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <DialogTitle className="text-lg">
                        Pedido {receipt.orderNumber} · {receipt.customer.fullName}
                      </DialogTitle>
                      <div className="text-sm text-muted-foreground mt-1">
                        Vendedor: {orderHeader?.sellerName || "—"}
                      </div>
                    </div>
                    <Select
                      value={receipt.status}
                      onValueChange={(v) => handleChangeStatus(v as OrderStatus)}
                      disabled={changingStatus}
                    >
                      <SelectTrigger className="w-[190px] h-9 text-sm font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableStatuses(receipt.status as OrderStatus).map(
                          (s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </DialogHeader>

                <Tabs value={tab} onValueChange={setTab}>
                  <div className="overflow-x-auto -mx-1 px-1">
                    <TabsList className="w-max min-w-full sm:w-fit">
                      <TabsTrigger value="resumen" className="whitespace-nowrap">
                        <Package className="h-4 w-4 mr-1.5" /> Resumen
                      </TabsTrigger>
                      <TabsTrigger value="seguimiento" className="whitespace-nowrap">
                        <Truck className="h-4 w-4 mr-1.5" /> Seguimiento
                      </TabsTrigger>
                      <TabsTrigger value="pagos" className="whitespace-nowrap">
                        <DollarSign className="h-4 w-4 mr-1.5" /> Pagos
                      </TabsTrigger>
                      <TabsTrigger value="reasignacion" className="whitespace-nowrap">
                        <Repeat className="h-4 w-4 mr-1.5" /> Reasignación
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="resumen" className="pt-3 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ================================== */}
                {/* SECCIÓN IZQUIERDA */}
                {/* ================================== */}
                <div className="space-y-4">
                  {/* Productos */}
                  <div className="border border-border rounded-lg p-4">
                    <h3 className="font-semibold mb-3 text-lg">Productos</h3>
                    <div className="space-y-3 max-h-[250px] overflow-y-auto">
                      {receipt.items.map((item, i) => (
                        <div
                          key={i}
                          className="border border-border rounded-md p-3 bg-muted"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="font-medium text-base">
                              {item.productName}
                            </p>
                            {item.isPromoItem && (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">
                                Promo del Día
                              </span>
                            )}
                          </div>
                          {item.attributes &&
                            Object.keys(item.attributes).length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {Object.entries(item.attributes).map(
                                  ([k, v]) => (
                                    <span
                                      key={k}
                                      className="mr-2 bg-secondary px-1 rounded"
                                    >
                                      {k}: {String(v)}
                                    </span>
                                  ),
                                )}
                              </div>
                            )}
                          <div className="flex justify-between text-sm mt-2">
                            <span>
                              Cantidad: <strong>{item.quantity}</strong>
                            </span>
                            <span>
                              Valor Und:{" "}
                              <strong>S/{item.unitPrice.toFixed(2)}</strong>
                            </span>
                          </div>
                          <div className="flex justify-between text-sm font-medium mt-1 pt-1 border-t border-border">
                            <span>Sub Total:</span>
                            <span className="text-primary">
                              S/{item.subtotal.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Resumen de Pagos */}
                  <div className="border border-border rounded-lg p-4 bg-muted">
                    <h3 className="font-semibold mb-3 text-lg">
                      Resumen de Pagos
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Productos:</span>
                        <span>S/{receipt.totals.productsTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IGV 18%:</span>
                        <span>S/{receipt.totals.taxTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Envío:</span>
                        <span>S/{receipt.totals.shippingTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                        <span>Total:</span>
                        <span>S/{receipt.totals.grandTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Descuentos:</span>
                        <span>S/{receipt.totals.discountTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-green-600 font-medium">
                        <span>Adelanto:</span>
                        <span>S/{receipt.totals.totalPaid.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-red-600 font-bold text-base">
                        <span>Por Cobrar:</span>
                        <span>S/{receipt.totals.pendingAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ================================== */}
                {/* SECCIÓN DERECHA */}
                {/* ================================== */}
                <div className="flex flex-col">
                  {/* Cliente — misma altura que Productos + Resumen de Pagos */}
                  <div className="border border-border rounded-lg p-5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg">Cliente</h3>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900"
                          onClick={handleWhatsApp}
                          title="WhatsApp"
                        >
                          <WhatsAppIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900"
                          onClick={() => {
                            const trackingUrl = `${process.env.NEXT_PUBLIC_LANDING_URL}/rastreo/${receipt.orderNumber}`;
                            window.open(trackingUrl, "_blank");
                          }}
                          title="Rastreo"
                        >
                          <Truck className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="relative h-9 w-9 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900"
                          onClick={() => setPaymentModalOpen(true)}
                          title={
                            receipt.payments.some((p) => p.status === "PENDING")
                              ? "Pagos pendientes de aprobación"
                              : "Gestionar Pagos"
                          }
                        >
                          <DollarSign className="h-4 w-4" />
                          {receipt.payments.some(
                            (p) => p.status === "PENDING",
                          ) && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900"
                          onClick={handlePrint}
                          title="Imprimir"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900"
                          onClick={handleDownloadPdf}
                          title="Descargar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>

                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9"
                          onClick={() =>
                            router.push(`/registrar-venta?orderId=${orderId}`)
                          }
                          title="Editar Pedido"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Nombre: </span>
                        <span className="font-medium">
                          {receipt.customer.fullName}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            copyField(receipt.customer.fullName, "Nombre")
                          }
                          title="Copiar nombre"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">
                          Distrito:{" "}
                        </span>
                        <span className="font-medium">
                          {receipt.customer.district || "-"}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            copyField(receipt.customer.district, "Distrito")
                          }
                          title="Copiar distrito"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">
                          Teléfono:{" "}
                        </span>
                        <span className="font-medium">
                          {receipt.customer.phoneNumber || "-"}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            copyField(receipt.customer.phoneNumber, "Teléfono")
                          }
                          title="Copiar teléfono"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tipo: </span>
                        <span className="font-medium">
                          {receipt.customer.clientType || "-"}
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center gap-1">
                        <span className="text-muted-foreground">
                          Dirección:{" "}
                        </span>
                        <span className="font-medium">
                          {receipt.customer.address || "-"}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            copyField(receipt.customer.address, "Dirección")
                          }
                          title="Copiar dirección"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">
                          Departamento:{" "}
                        </span>
                        <span className="font-medium">
                          {receipt.customer.city || "-"}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            copyField(receipt.customer.city, "Departamento")
                          }
                          title="Copiar departamento"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Canal Venta:{" "}
                        </span>
                        <span className="font-medium">
                          {receipt.salesChannel || "-"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">
                          Provincia:{" "}
                        </span>
                        <span className="font-medium">
                          {receipt.customer.province || "-"}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            copyField(receipt.customer.province, "Provincia")
                          }
                          title="Copiar provincia"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Canal Cierre:{" "}
                        </span>
                        <span className="font-medium">
                          {receipt.closingChannel || "-"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">DNI: </span>
                        <span className="font-medium">
                          {receipt.customer.dni || "-"}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 text-muted-foreground hover:text-foreground"
                          onClick={() => copyField(receipt.customer.dni, "DNI")}
                          title="Copiar DNI"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Referencia:{" "}
                        </span>
                        <span className="font-medium">
                          {receipt.customer.reference || "-"}
                        </span>
                      </div>

                      {/* New Tracking Info Section in Modal */}
                      {showTracking && receipt && (
                        <div className="col-span-2 mt-4 pt-4 border-t border-dashed border-muted-foreground/30">
                          <label className="text-xs font-bold text-muted-foreground mb-3 block uppercase tracking-wider">
                            Información de Seguimiento
                          </label>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-muted-foreground block text-[10px] uppercase mb-1">
                                Nro Tracking
                              </span>
                              <div className="flex items-center gap-1">
                                <Input
                                  size={1}
                                  className="h-8 text-xs"
                                  placeholder="Nro Tracking..."
                                  value={receipt.externalTrackingNumber || ""}
                                  onChange={(
                                    e: React.ChangeEvent<HTMLInputElement>,
                                  ) =>
                                    updateTrackingField(
                                      "externalTrackingNumber",
                                      e.target.value,
                                    )
                                  }
                                  onBlur={handleSaveTracking}
                                />
                                {receipt.externalTrackingNumber && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                                    onClick={() =>
                                      copyField(
                                        receipt.externalTrackingNumber || "",
                                        "Tracking",
                                      )
                                    }
                                    title="Copiar Tracking"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px] uppercase mb-1">
                                Oficina
                              </span>
                              <Input
                                className="h-8 text-xs"
                                placeholder="Oficina..."
                                value={receipt.shippingOffice || ""}
                                onChange={(
                                  e: React.ChangeEvent<HTMLInputElement>,
                                ) =>
                                  updateTrackingField(
                                    "shippingOffice",
                                    e.target.value,
                                  )
                                }
                                onBlur={handleSaveTracking}
                              />
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px] uppercase mb-1">
                                Código
                              </span>
                              <Input
                                className="h-8 text-xs"
                                placeholder="Código..."
                                value={receipt.shippingCode || ""}
                                onChange={(
                                  e: React.ChangeEvent<HTMLInputElement>,
                                ) =>
                                  updateTrackingField(
                                    "shippingCode",
                                    e.target.value,
                                  )
                                }
                                onBlur={handleSaveTracking}
                              />
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px] uppercase mb-1">
                                Clave
                              </span>
                              <div className="relative">
                                <Input
                                  type={
                                    receipt.totals.pendingAmount > 0 &&
                                    !revealKey
                                      ? "password"
                                      : "text"
                                  }
                                  className={`h-8 text-xs pr-8 ${
                                    receipt.totals.pendingAmount > 0
                                      ? "border-red-300 focus:border-red-500 bg-red-50/30 font-mono"
                                      : "focus:border-orange-500"
                                  }`}
                                  placeholder="Clave..."
                                  value={receipt.shippingKey || ""}
                                  onChange={(
                                    e: React.ChangeEvent<HTMLInputElement>,
                                  ) =>
                                    updateTrackingField(
                                      "shippingKey",
                                      e.target.value,
                                    )
                                  }
                                  onBlur={handleSaveTracking}
                                />
                                {receipt.totals.pendingAmount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setRevealKey(!revealKey)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 focus:outline-none"
                                    title={
                                      revealKey
                                        ? "Ocultar clave"
                                        : "Revelar clave"
                                    }
                                  >
                                    {revealKey ? (
                                      <EyeOff className="h-3.5 w-3.5" />
                                    ) : (
                                      <Eye className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          {savingTracking && (
                            <div className="mt-2 flex items-center gap-2 text-[10px] text-orange-500 animate-pulse">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Guardando cambios...
                            </div>
                          )}
                        </div>
                      )}

                      {!showTracking &&
                        (receipt.externalTrackingNumber ||
                          receipt.shippingCode ||
                          receipt.shippingKey ||
                          receipt.shippingOffice) && (
                          <div className="col-span-2 mt-4 pt-4 border-t border-dashed border-muted-foreground/30">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-muted-foreground block text-xs underline mb-1">
                                  Nro Tracking
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-semibold truncate">
                                    {receipt.externalTrackingNumber || "-"}
                                  </span>
                                  {receipt.externalTrackingNumber && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                      onClick={() =>
                                        copyField(
                                          receipt.externalTrackingNumber || "",
                                          "Tracking",
                                        )
                                      }
                                      title="Copiar Tracking"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-xs underline mb-1">
                                  Oficina
                                </span>
                                <span className="text-sm font-semibold truncate">
                                  {receipt.shippingOffice || "-"}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-xs underline mb-1">
                                  Código
                                </span>
                                <span className="text-sm font-semibold">
                                  {receipt.shippingCode || "-"}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-xs underline mb-1">
                                  Clave
                                </span>
                                <span className="text-sm font-semibold">
                                  {receipt.shippingKey || "-"}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>
                  <div
                    className={
                      hasGestionColumn
                        ? "grid grid-cols-1 lg:grid-cols-2 gap-4 items-start"
                        : "space-y-3"
                    }
                  >
                  {/* ================================== */}
                  {/* COLUMNA IZQUIERDA: gestión del pedido */}
                  {/* ================================== */}
                  {hasGestionColumn && (
                  <div className="space-y-3">
                  {/* Promo del día - only shown in customer service view */}
                  {!hideCallManagement && (
                    <div className="flex items-center justify-between gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                      <p className="text-sm text-red-700 dark:text-red-400 truncate">
                        <span className="font-semibold">Promo del día</span>
                        <span className="text-red-600 dark:text-red-400 hidden sm:inline">
                          {" "}
                          — agregar más productos a la venta
                        </span>
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0 text-red-600 dark:text-red-400"
                        onClick={() => setAddProductsModalOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar
                      </Button>
                    </div>
                  )}

                  {/* CC v2: bloque datos incompletos (visible cuando el pedido tiene sub_estado_cc activo) */}
                  {!hideCallManagement && subEstadoCc && (
                    <DatosIncompletosBlock
                      orderId={orderId}
                      dniCliente={dniCliente}
                      customer={receipt?.customer ?? null}
                      onDatosCompletos={() => {
                        setDatosCompletos(true);
                        onOrderUpdated?.();
                        fetchReceipt();
                      }}
                    />
                  )}

                  {/* Gestión de Llamada / Entrega — según origen del pedido */}
                  {!hideCallManagement && (
                    subEstadoCc ? (
                      <CcGestionPanel
                        orderId={orderId}
                        subEstadoCc={subEstadoCc}
                        callAttempts={receipt.callAttempts ?? 0}
                        datosCompletos={datosCompletos}
                        aliclikDispatchStatus={aliclikDispatchStatus}
                        aliclikSyncedAt={aliclikSyncedAt}
                        evaStatus={evaStatus}
                        evaSyncedAt={evaSyncedAt}
                        onUpdated={() => {
                          fetchReceipt();
                          fetchLogs();
                          onOrderUpdated?.();
                        }}
                      />
                    ) : isScheduledDelivery ? (
                      <ScheduledDeliverySection
                        orderId={orderId}
                        callbackAt={receipt.callbackAt}
                        callStatus={receipt.callStatus}
                        onUpdated={() => {
                          fetchReceipt();
                          onOrderUpdated?.();
                        }}
                      />
                    ) : (
                    <div className="border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">Gestión de llamada</h3>
                        <span
                          className={`text-sm font-medium px-2 py-1 rounded ${
                            (receipt.callAttempts || 0) >= 3
                              ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400"
                              : (receipt.callAttempts || 0) >= 2
                                ? "bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400"
                                : "bg-muted text-foreground"
                          }`}
                        >
                          Intentos: {receipt.callAttempts || 0}/3
                        </span>
                      </div>

                      {isConfirmed ? (
                        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                          <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
                            <Check className="h-5 w-5" />
                            <span className="font-semibold">
                              VENTA CONFIRMADA
                            </span>
                          </div>
                          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                            El cliente confirmó la entrega del pedido
                          </p>
                        </div>
                      ) : (receipt.callAttempts || 0) >= 3 ? (
                        <div className="space-y-3">
                          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                            <div className="flex items-center justify-center gap-2 text-red-700 dark:text-red-400">
                              <PhoneOff className="h-5 w-5" />
                              <span className="font-semibold">
                                LÍMITE DE INTENTOS ALCANZADO
                              </span>
                            </div>
                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                              Se han realizado 3 intentos de llamada sin
                              respuesta.
                              <br />
                              Se recomienda anular la venta.
                            </p>
                          </div>
                          <div className="flex gap-3">
                            <Button
                              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                              disabled={!isOperaciones && !datosCompletos}
                              title={!isOperaciones && !datosCompletos ? "Completá los datos requeridos antes de confirmar" : undefined}
                              onClick={() =>
                                handleUpdateCallStatus("CONFIRMED")
                              }
                            >
                              <Phone className="h-4 w-4 mr-2" />
                              CONFIRMA ENTREGA
                            </Button>
                            <Button
                              variant="destructive"
                              className="flex-1"
                              onClick={() => setCancellationModalOpen(true)}
                            >
                              ANULAR VENTA
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(receipt.callAttempts || 0) >= 2 && (
                            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-2 text-center">
                              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                ⚠️ Último intento antes de sugerir anulación
                              </p>
                            </div>
                          )}
                          <div className="flex gap-3">
                            <Button
                              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                              disabled={!isOperaciones && !datosCompletos}
                              title={!isOperaciones && !datosCompletos ? "Completá los datos requeridos antes de confirmar" : undefined}
                              onClick={() =>
                                handleUpdateCallStatus("CONFIRMED")
                              }
                            >
                              <Phone className="h-4 w-4 mr-2" />
                              CONFIRMA ENTREGA
                            </Button>
                            <Button
                              variant="outline"
                              className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                              onClick={() =>
                                handleUpdateCallStatus("NO_ANSWER")
                              }
                            >
                              <PhoneOff className="h-4 w-4 mr-2" />
                              NO CONTESTA ({(receipt.callAttempts || 0) + 1}/3)
                            </Button>
                          </div>
                          {isOperaciones && (
                            <div className="pt-2 border-t border-dashed border-muted-foreground/20">
                              <Button
                                variant="outline"
                                className="w-full border-red-300 text-red-600 hover:bg-red-50"
                                onClick={() => setCancellationModalOpen(true)}
                              >
                                Anular Pedido
                              </Button>
                            </div>
                          )}

                          <div className="pt-2 border-t border-dashed border-muted-foreground/20">
                            <label className="text-xs font-medium text-muted-foreground mb-2 block">
                              ¿Programar rellamada?
                            </label>
                            <div className="flex gap-2">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "flex-1 justify-start text-left font-normal h-9",
                                      !scheduledDate && "text-muted-foreground",
                                    )}
                                  >
                                    <Clock className="mr-2 h-4 w-4" />
                                    {scheduledDate ? (
                                      format(
                                        scheduledDate,
                                        "dd/MM/yyyy HH:mm",
                                        { locale: es },
                                      )
                                    ) : (
                                      <span>Seleccionar fecha y hora</span>
                                    )}
                                  </Button>
                                </PopoverTrigger>
                                  <PopoverContent
                                    className="w-auto p-0"
                                    align="start"
                                  >
                                    <div className="p-1">
                                      <Calendar
                                        mode="single"
                                        selected={scheduledDate}
                                        onSelect={(date) => {
                                          if (date) {
                                            const current =
                                              scheduledDate || new Date();
                                            date.setHours(current.getHours());
                                            date.setMinutes(
                                              current.getMinutes(),
                                            );
                                            setScheduledDate(date);
                                          }
                                        }}
                                        initialFocus
                                        locale={es}
                                      />
                                    </div>
                                    <div className="p-3 border-t border-border">
                                      <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold uppercase text-muted-foreground">
                                          Hora de rellamada
                                        </label>
                                        <Input
                                          type="time"
                                          className="h-9 text-sm"
                                          value={
                                            scheduledDate
                                              ? format(scheduledDate, "HH:mm")
                                              : ""
                                          }
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val) {
                                              const [hours, minutes] = val
                                                .split(":")
                                                .map(Number);
                                              const next = new Date(
                                                scheduledDate || new Date(),
                                              );
                                              next.setHours(hours);
                                              next.setMinutes(minutes);
                                              setScheduledDate(next);
                                            }
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </PopoverContent>
                              </Popover>
                              <Button
                                onClick={handleScheduleCallback}
                                disabled={!scheduledDate || isScheduling}
                                className="bg-amber-600 hover:bg-amber-700 h-9"
                              >
                                {isScheduling ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Agendar"
                                )}
                              </Button>
                            </div>
                            {receipt?.callStatus === "SCHEDULED" &&
                              receipt.callbackAt && (
                                <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Programada:{" "}
                                  {format(
                                    new Date(receipt.callbackAt),
                                    "dd/MM HH:mm",
                                  )}
                                </p>
                              )}
                          </div>
                        </div>
                      )}
                    </div>
                    )
                  )}

                  {/* Upsell Tracking */}
                  {(receipt.upsellOffered || receipt.upsellAccepted) && (
                    <div className={`border rounded-lg p-4 ${
                      receipt.upsellAccepted
                        ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30"
                        : "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30"
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-green-700 dark:text-green-400">
                          {receipt.upsellAccepted ? "✓ Upsell Aceptado" : "Upsell Ofrecido"}
                        </h3>
                      </div>
                      {receipt.upsellDetails && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {receipt.upsellDetails}
                        </p>
                      )}
                      {!receipt.upsellDetails && receipt.upsellOffered && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Se ofreció un producto complementario al cliente
                        </p>
                      )}
                    </div>
                  )}

                  {/* Estado Aliclik */}
                  {(aliclikDispatchStatus || aliclikSyncedAt) && (
                    <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-4 bg-purple-50/50 dark:bg-purple-950/30">
                      <h3 className="font-semibold text-purple-700 dark:text-purple-400 text-sm mb-3">
                        Aliclik — Estado de despacho
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground block underline mb-1">
                            Estado
                          </span>
                          <span className="font-semibold">
                            {aliclikDispatchStatus || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block underline mb-1">
                            Última sincronización
                          </span>
                          <span className="font-semibold">
                            {aliclikSyncedAt
                              ? new Date(aliclikSyncedAt).toLocaleString("es-PE", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Script sugerido CC */}
                  {subEstadoCc && (
                    <CcScriptPanel
                      subEstadoCc={subEstadoCc}
                      clienteName={receipt.customer.fullName}
                      orderNumber={receipt.orderNumber}
                    />
                  )}
                  </div>
                  )}

                  {/* ================================== */}
                  {/* COLUMNA DERECHA: historial y comentarios */}
                  {/* ================================== */}
                  {/* Comentarios Timeline */}
                  <div className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Historial / Comentarios</h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            Más acciones
                            <MoreVertical className="h-4 w-4 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setCancellationModalOpen(true)}
                          >
                            Anular Venta
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Historial — más reciente arriba; scrollea de a un comentario por vez */}
                    <div className="h-[92px] overflow-y-auto mb-3 pr-1 snap-y snap-mandatory">
                      {logsLoading ? (
                        <div className="text-center text-muted-foreground py-4">
                          Cargando historial...
                        </div>
                      ) : displayLogs.length === 0 ? (
                        <div className="text-center text-muted-foreground py-4">
                          No hay registros en el historial
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {displayLogs.map((log) => (
                            <div
                              key={log.id}
                              className={`snap-start rounded-md p-2 ${log.isSystemGenerated ? "bg-muted/30 border border-muted" : "bg-primary/10 border border-primary/20"}`}
                            >
                              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-3 w-3" />
                                  <span>{formatLogDate(log.timestamp)}</span>
                                  <span
                                    className={`px-1 py-0.5 rounded text-xs ${log.isSystemGenerated ? "bg-muted" : "bg-primary/20 text-primary"}`}
                                  >
                                    {log.isSystemGenerated ? (
                                      <>
                                        <Settings className="h-2 w-2 inline mr-0.5" />{" "}
                                        Sistema
                                      </>
                                    ) : (
                                      OPERACION_LABELS[log.operacion] ||
                                      log.operacion
                                    )}
                                  </span>
                                </div>
                                {log.userName && (
                                  <div className="flex items-center gap-1 text-xs font-medium">
                                    <User className="h-3 w-3" />
                                    <span>{log.userName}</span>
                                  </div>
                                )}
                              </div>
                              {log.comentarios && (
                                <p className="text-sm whitespace-pre-wrap">
                                  {log.comentarios}
                                </p>
                              )}
                              {!log.comentarios && log.isSystemGenerated && (
                                <p className="text-xs text-muted-foreground italic">
                                  Acción automática
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Input para nuevo comentario */}
                    <div className="border-t pt-3">
                      <div className="flex gap-2">
                        <Textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Escribe un comentario..."
                          rows={2}
                          className="flex-1 resize-none text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendComment();
                            }
                          }}
                        />
                        <Button
                          onClick={handleSendComment}
                          disabled={!newComment.trim() || isSendingComment}
                          size="sm"
                          className="self-end"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Enter para enviar
                      </p>
                    </div>
                  </div>
                  </div>
                  </TabsContent>

                  <TabsContent value="seguimiento" className="pt-3 space-y-4">
                  {/* Shipping Guide Section - only shown when shippingGuide data is provided */}
                  {!shippingGuide && (
                    <p className="text-sm text-muted-foreground border border-border rounded-lg p-4">
                      Sin guía de envío asociada a este pedido todavía.
                    </p>
                  )}
                  {shippingGuide && (
                    <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-950/30">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          Guía de Envío
                        </h3>
                        <div className="flex gap-1 items-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900"
                            onClick={() => setGuideDetailsModalOpen(true)}
                            title="Ver Guía Completa"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Ver Guía
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                            onClick={handlePrintShippingReceipt}
                            title="Imprimir Comprobante de Envío"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              shippingGuide.status === "ENTREGADA"
                                ? "bg-green-100 text-green-800"
                                : shippingGuide.status === "EN_RUTA"
                                  ? "bg-amber-100 text-amber-800"
                                  : shippingGuide.status === "APROBADA"
                                    ? "bg-teal-100 text-teal-800"
                                    : shippingGuide.status === "ASIGNADA"
                                      ? "bg-blue-100 text-blue-800"
                                      : shippingGuide.status === "FALLIDA" ||
                                          shippingGuide.status === "CANCELADA"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {shippingGuide.status}
                          </span>
                          {receipt?.totals.pendingAmount != null &&
                            receipt.totals.pendingAmount > 0 && (
                              <span
                                className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800 flex items-center gap-1"
                                title="Pago pendiente"
                              >
                                <AlertCircle className="h-3 w-3" />
                                Pago Pendiente
                              </span>
                            )}
                          {shippingGuide.daysSinceCreated !== undefined &&
                            shippingGuide.daysSinceCreated >= 25 && (
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  shippingGuide.daysSinceCreated >= 30
                                    ? "bg-red-600 text-white"
                                    : "bg-amber-500 text-white"
                                }`}
                              >
                                {shippingGuide.daysSinceCreated >= 30
                                  ? "VENCIDO"
                                  : "PRÓXIMO"}
                              </span>
                            )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">
                            N° Guía:{" "}
                          </span>
                          <span className="font-medium">
                            {shippingGuide.guideNumber}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Courier:{" "}
                          </span>
                          <span className="font-medium">
                            {shippingGuide.courierName || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Zona: </span>
                          <span className="font-medium">
                            {shippingGuide.deliveryZone}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Tipo Envío:{" "}
                          </span>
                          <span className="font-medium">
                            {shippingGuide.deliveryType}
                          </span>
                        </div>
                        {shippingGuide.shippingKey && (
                          <div>
                            <span className="text-muted-foreground">
                              Clave Envío:{" "}
                            </span>
                            <span className="font-medium">
                              {shippingGuide.shippingKey}
                            </span>
                          </div>
                        )}
                        {shippingGuide.shippingOffice && (
                          <div>
                            <span className="text-muted-foreground">
                              Oficina:{" "}
                            </span>
                            <span className="font-medium">
                              {shippingGuide.shippingOffice}
                            </span>
                          </div>
                        )}
                        {shippingGuide.chargeType && (
                          <div>
                            <span className="text-muted-foreground">
                              Tipo Cobro:{" "}
                            </span>
                            <span className="font-medium">
                              {shippingGuide.chargeType}
                            </span>
                          </div>
                        )}

                        <div>
                          <span className="text-muted-foreground">
                            Días en tránsito:{" "}
                          </span>
                          <span
                            className={`font-medium ${
                              (shippingGuide.daysSinceCreated || 0) >= 30
                                ? "text-red-600"
                                : (shippingGuide.daysSinceCreated || 0) >= 25
                                  ? "text-amber-600"
                                  : ""
                            }`}
                          >
                            {shippingGuide.daysSinceCreated || 0} días
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Fecha Creación:{" "}
                          </span>
                          <span className="font-medium">
                            {new Date(
                              shippingGuide.created_at,
                            ).toLocaleDateString("es-PE")}
                          </span>
                        </div>
                        {shippingGuide.trackingUrl && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">
                              Tracking:{" "}
                            </span>
                            <a
                              href={shippingGuide.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-blue-600 hover:underline"
                            >
                              Ver seguimiento →
                            </a>
                          </div>
                        )}
                        {shippingGuide.deliveryAddress && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">
                              Dirección Envío:{" "}
                            </span>
                            <span className="font-medium">
                              {shippingGuide.deliveryAddress}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {orderHeader?.guideNumber && (
                    <div className="border rounded-lg p-4">
                      <div className="text-sm font-bold mb-2.5">
                        ⚡ Acciones logísticas
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {orderHeader.courier === "Shalom" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-sm justify-start"
                            disabled={syncingTracking}
                            onClick={handleForceSyncTracking}
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
                        {onOpenCreateGuide && (
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
                        )}
                      </div>
                    </div>
                  )}
                  </TabsContent>

                  <TabsContent value="pagos" className="pt-3 space-y-4">
                    <div className="grid grid-cols-3 gap-3.5">
                      <div className="border rounded-lg p-4 text-center">
                        <div className="text-base sm:text-xl font-black">
                          S/{receipt.totals.grandTotal.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                      <div className="border rounded-lg p-4 text-center">
                        <div className="text-base sm:text-xl font-black text-green-600">
                          S/{receipt.totals.totalPaid.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">Pagado</div>
                      </div>
                      <div className="border rounded-lg p-4 text-center">
                        <div className="text-base sm:text-xl font-black text-amber-600">
                          S/{receipt.totals.pendingAmount.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">Saldo</div>
                      </div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="text-sm font-bold mb-2.5">💳 Pagos registrados</div>
                      {receipt.payments.length === 0 && (
                        <div className="text-sm text-muted-foreground">
                          Sin pagos registrados
                        </div>
                      )}
                      {receipt.payments.map((p) => (
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
                      onClick={() => setPaymentModalOpen(true)}
                    >
                      Gestionar pagos
                    </Button>
                  </TabsContent>

                  <TabsContent value="reasignacion" className="pt-3 space-y-3.5">
                    {orderHeader?.status === "EN_ENVIO" &&
                    orderHeader?.shalomStatus === "DEVUELTO" ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-4">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-bold text-sm">
                          <AlertTriangle className="h-4 w-4" /> Entrega fallida —
                          el paquete está en retorno
                        </div>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1.5">
                          El cliente no recibió el pedido. Puedes reprogramar un
                          nuevo intento o anular la entrega.
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground border rounded-lg p-4">
                        Este pedido no está marcado como fallido. Si el cliente
                        no recogió o rechazó la entrega, inicia el flujo para
                        reprogramar un nuevo intento o anular.
                      </div>
                    )}
                    <Button
                      className="w-full text-sm"
                      variant={
                        orderHeader?.status === "EN_ENVIO" &&
                        orderHeader?.shalomStatus === "DEVUELTO"
                          ? "default"
                          : "outline"
                      }
                      onClick={() => setReassignModalOpen(true)}
                    >
                      <Repeat className="h-4 w-4 mr-1.5" />
                      Reprogramar / anular
                    </Button>
                  </TabsContent>

                </Tabs>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de impresión */}
      <AlertDialog open={printConfirmOpen} onOpenChange={setPrintConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Se imprimió correctamente el recibo?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-muted-foreground text-sm">
                <span className="block">
                  Confirma que el recibo de la orden{" "}
                  <strong>{receipt?.orderNumber}</strong> se imprimió
                  correctamente:
                </span>
                <span className="block text-amber-600 font-medium">
                  Al confirmar, el estado cambiará a <strong>PREPARADO</strong>.
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingStatus}>
              No, cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmPrintStatus}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? "Actualizando..." : "Sí, confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Cancelación */}
      <CancellationModal
        open={cancellationModalOpen}
        onClose={() => setCancellationModalOpen(false)}
        orderNumber={receipt?.orderNumber || ""}
        onConfirm={handleConfirmCancellation}
        isLoading={isCancelling}
      />

      {/* Modal de Reasignación (reprogramar / anular entrega) */}
      <ReassignDeliveryModal
        open={reassignModalOpen}
        onClose={() => setReassignModalOpen(false)}
        order={orderHeader}
        candidates={[]}
        onReprogram={handleReprogramDelivery}
        onCancelOrder={(_id, reason, notes) =>
          handleConfirmCancellation(reason, notes)
        }
        onReassign={() => {}}
      />

      {/* Modal de Pagos */}
      <PaymentVerificationModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        orderId={orderId}
        orderNumber={receipt?.orderNumber || ""}
        onPaymentUpdated={() => {
          fetchReceipt();
          onOrderUpdated?.();
        }}
        canApprove={true}
      />

      {/* Modal de agregar productos (Promo del día) */}
      <AddProductsModal
        open={addProductsModalOpen}
        orderId={orderId}
        onClose={() => setAddProductsModalOpen(false)}
        onProductsAdded={() => {
          fetchReceipt();
          onOrderUpdated?.();
        }}
      />

      {/* Guide Details Modal */}
      {shippingGuide && (
        <GuideDetailsModal
          open={guideDetailsModalOpen}
          onClose={() => setGuideDetailsModalOpen(false)}
          guideId={shippingGuide.id}
        />
      )}
    </>
  );
}
