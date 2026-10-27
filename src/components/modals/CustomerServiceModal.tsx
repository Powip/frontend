"use client";
import { canCompleteCustomerServicePurchaseData, canManageCustomerServiceOrder, isCustomerServicePurchasePending } from "@/utils/customerServiceOrderAccess";
import { useCcPurchaseConfirmationAccess } from "@/hooks/useCcPurchaseConfirmationAccess";
import axios from "@/lib/axiosAuth";
import { canPrepareDeferredManualOrder, canShipCommercialOrder, isCommercialLeadOrder, salesStatusBlockReason, salesPhysicalOperationBlockReason, commercialLeadHref } from "@/utils/commercialOrders";
import { formatSalesMoney } from "@/utils/salesMoney";
import { deliveryPaymentBlockReason, operationalStatus, receiptFinancialState } from "@/utils/orderState";
import { FinancialStatusBadge } from "@/components/shared/FinancialStatusBadge";
import { buildPendingOrderDetail } from "./customerServiceOrderDetail";
import { CcSaleConfirmationPanel } from "@/components/atencion-cliente/cc-v2/CcSaleConfirmationPanel";
import { useSaleLifecycleRouting } from "@/hooks/useSaleLifecycleRouting";
import { useReceiptPrintScope } from "@/hooks/useReceiptPrintScope";
import { printCustomerShippingLabel } from "@/utils/printCustomerShippingLabel";
import SaleUnitLifecycleModal from "@/components/registrar-venta/SaleUnitLifecycleModal";
import { SaleUnitLifecycleButtons } from "@/components/registrar-venta/SaleUnitLifecycleActions";
import { UnitAssignmentNotice } from "@/components/registrar-venta/SaleUnitSelection";
import { type SaleUnitLifecycleAction } from "@/services/saleUnitLifecycleService";
import { assignmentBlockReason, requiresAuthenticatedSaleMutation, saleMutationUrl, saleReceiptUrl } from "@/services/saleTrackingService";
import { useCallback, useEffect, useRef, useState } from "react";
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
  Repeat,
  Download,
  RefreshCw,
  Unlink,
  ArrowRightLeft,
  FileText,
  Zap,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/shared/WhatsAppIcon";
import { ShalomStatusBadge } from "@/components/tracking/ShalomStatusBadge";
import { SHALOM_STEPS, SHALOM_STEP_ICONS } from "@/components/tracking/useShalomLiveStatus";
import AliclikStatusBadge from "@/components/aliclik/AliclikStatusBadge";
import EvaStatusBadge from "@/components/eva/EvaStatusBadge";
import { isShalomCourier, isAliclikCourier, isEvaCourier } from "@/utils/courierNormalizer";
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
import { ShalomDocumentCard } from "./ShalomDocumentModal";
import { useQRCode } from "@/hooks/useQrCode";
import ReassignDeliveryModal from "@/app/centro-envios/components/ReassignDeliveryModal";
import { hasPaymentProof, trackingUrlFor } from "@/app/centro-envios/components/shipmentUtils";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ScheduledDeliverySection from "./ScheduledDeliverySection";
import { trackShalomGuide } from "@/services/shalomService";
import { DatosIncompletosBlock } from "@/components/atencion-cliente/cc-v2/DatosIncompletosBlock";
import { CcGestionPanel } from "@/components/atencion-cliente/cc-v2/CcGestionPanel";
import { CcScriptPanel } from "@/components/atencion-cliente/cc-v2/CcScriptPanel";
import { OrderHeader, OrderStatus, SubEstadoCc } from "@/interfaces/IOrder";
import { getAvailableStatuses, getStatusChainSteps, getStatusLabel } from "@/utils/domain/orders-status-flow";
import { isJunkDni } from "@/utils/junk-document.util";
import { printOrderLabel, type OrderReceipt } from "@/utils/printOrderLabel";
import { downloadNotaVentaPdf } from "@/utils/downloadNotaVentaPdf";
import { GoogleMapsUrlField } from "@/components/shared/GoogleMapsUrlField";
import { OrderEvidenceSection } from "@/components/orders/OrderEvidenceSection";

type CustomerServiceReceipt = Omit<OrderReceipt, "items"> & {
  items: (OrderReceipt["items"][number] & {
    units?: { id: string; code: string; status: string }[];
  })[];
};

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

// Labels legibles para shippingGuide.status — mismos valores que ya
// coloreaba el badge de "Guía de Envío", solo para el chip compacto del
// header (courier + modalidad · estado).
// Definición única de columnas para las filas de 2 cards del Resumen
// (Productos/Cliente, Evidencia/Promo, Gestión/Historial): mismo ancho de
// columna y mismo gap, así los bordes de todas las filas quedan alineados.
const RESUMEN_ROW_GRID = "grid grid-cols-1 lg:grid-cols-2 gap-4";

const STATUS_LABEL: Record<string, string> = {
  GENERADA: "Generada",
  ASIGNADA: "Asignada",
  APROBADA: "Aprobada",
  EN_RUTA: "En ruta",
  ENTREGADA: "Entregada",
  FALLIDA: "Fallida",
  CANCELADA: "Cancelada",
};

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
  /** Return to the editor when this detail is already open from the order form. */
  onEditOrder?: () => void;
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
  /** Pestaña con la que abre el modal (por defecto "resumen"). Úsalo para abrir
   *  directo en "seguimiento" desde vistas centradas en tracking/courier. */
  initialTab?: "resumen" | "seguimiento" | "pagos" | "reasignacion";
}

export default function CustomerServiceModal({
  open,
  orderId,
  onClose,
  onOrderUpdated,
  onEditOrder,
  hideCallManagement = false,
  shippingGuide: shippingGuideProp,
  showTracking = false,
  isOperaciones = false,
  onOpenCreateGuide,
  initialTab,
}: Props) {
  const router = useRouter();
  const { auth, hasPermission } = useAuth();
  const routeSaleLifecycle = useSaleLifecycleRouting();
  const [loading, setLoading] = useState(false);
  const receiptKey = `${auth?.company?.id ?? ""}:${auth?.user?.id ?? ""}:${orderId}`;
  const [receiptRevision, setReceiptRevision] = useState(0);
  const beginPrint = useReceiptPrintScope(`${receiptKey}:${receiptRevision}`, Boolean(open && orderId && auth?.company?.id && auth?.user?.id));
  const activeReceiptKey = useRef(receiptKey);
  activeReceiptKey.current = receiptKey;
  const receiptReadSequence = useRef(0);
  const [loadedReceipt, setReceipt] = useState<CustomerServiceReceipt | null>(null);
  const [loadedReceiptKey, setLoadedReceiptKey] = useState("");
  const receipt = loadedReceiptKey === receiptKey ? loadedReceipt : null;
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
  const [printConfirmation, setPrintConfirmation] = useState<{
    key: string; orderId: string; stockVersion?: number; status: string;
  } | null>(null);
  const printConfirmOpen = Boolean(open && receipt && printConfirmation?.key === receiptKey &&
    printConfirmation.orderId === receipt.orderId && printConfirmation.stockVersion === receipt.stockVersion &&
    printConfirmation.status === receipt.status);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  useEffect(() => { setPrintConfirmation(null); setIsUpdatingStatus(false); }, [open, receiptKey]);

  // Scheduling states
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    undefined,
  );
  const [isScheduling, setIsScheduling] = useState(false);

  // Pestañas del modal unificado + estado crudo de la orden (para Vendedor,
  // selector de estado, y como `order` de ReassignDeliveryModal).
  const [tab, setTab] = useState("resumen");
  const [orderHeader, setOrderHeader] = useState<OrderHeader | null>(null);
  const canManageCc = canManageCustomerServiceOrder(hasPermission, orderHeader?.canalOrigen);
  const canEditOrder = hasPermission("EDIT_SALE");
  const isPendingPurchase = isCommercialLeadOrder(orderHeader ?? {}) ||
    (!hideCallManagement && isCustomerServicePurchasePending(orderHeader ?? {}));
  const [lifecycleAction, setLifecycleAction] = useState<SaleUnitLifecycleAction | null>(null);
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
    const sequence = ++receiptReadSequence.current;
    const isCurrent = () => sequence === receiptReadSequence.current && receiptKey === activeReceiptKey.current;
    try {
      setReceipt(null);
      setOrderHeader(null);
      setLoadedReceiptKey("");
      setPrintConfirmation(null);
      setReceiptRevision((revision) => revision + 1);
      setLoading(true);
      const orderRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
      );
      if (!isCurrent()) return;
      if (orderRes.data?.id !== orderId) throw new Error("El pedido no corresponde a la consulta.");
      setOrderHeader({ ...orderRes.data, status: operationalStatus(orderRes.data.status) });
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
      if (isCommercialLeadOrder(orderRes.data) || (!hideCallManagement && isCustomerServicePurchasePending(orderRes.data))) {
        // Pending purchases share the order layout without issuing a sales receipt.
        setReceipt(buildPendingOrderDetail(orderRes.data));
        setLoadedReceiptKey(receiptKey);
        setTab((current) => current === "seguimiento" || current === "reasignacion" ? "resumen" : current);
        return;
      }
      const res = await axios.get(
        saleReceiptUrl(process.env.NEXT_PUBLIC_API_VENTAS || "", orderId, orderRes.data),
      );
      if (!isCurrent()) return;
      if (res.data?.orderId !== orderId) throw new Error("El comprobante no corresponde al pedido solicitado.");
      setReceipt({ ...res.data, status: operationalStatus(res.data.status), totals: { ...res.data.totals, pendingAmount: receiptFinancialState(res.data).pendingAmount } });
      setLoadedReceiptKey(receiptKey);
      setOrderHeader({ ...orderRes.data, status: operationalStatus(orderRes.data.status) });
    } catch (err) {
      if (!isCurrent()) return;
      console.error("Error fetching receipt", err);
      toast.error("Error al cargar el pedido");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [orderId, receiptKey, hideCallManagement]);

  const patchOrder = async (data: Record<string, unknown>, targetId = orderId): Promise<boolean> => {
    if (!orderHeader || orderHeader.id !== targetId) {
      throw new Error("Vuelve a cargar el pedido antes de actualizarlo.");
    }
    const targetStatus = typeof data.status === "string" ? data.status : "";
    const blocked = salesStatusBlockReason(orderHeader, targetStatus) || assignmentBlockReason(orderHeader, targetStatus) || deliveryPaymentBlockReason(receipt ? receiptFinancialState(receipt).pendingAmount : Number.NaN, targetStatus);
    if (blocked) {
      toast.error(blocked);
      return false;
    }
    const response = await axios.patch<OrderHeader>(
      saleMutationUrl(process.env.NEXT_PUBLIC_API_VENTAS || "", targetId, orderHeader),
      data,
    );
    if (targetStatus && requiresAuthenticatedSaleMutation(orderHeader) && (
      response.data?.status !== targetStatus || assignmentBlockReason(response.data, targetStatus)
    )) {
      toast.warning("La operación está pendiente de confirmación de IMEI/series. Consulta la venta antes de cambiar nuevamente su estado.");
      await fetchReceipt();
      onOrderUpdated?.();
      return false;
    }
    return true;
  };

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
    setTab(initialTab ?? "resumen");
    setOriginalTracking(null);
    setShalomTrackResult(null);
    fetchReceipt();
    fetchLogs();
    if (shippingGuideProp === undefined) {
      setShippingGuideData(null);
      fetchShippingGuide();
    }
    return () => { receiptReadSequence.current += 1; };
  }, [open, orderId, fetchReceipt, fetchLogs, fetchShippingGuide, shippingGuideProp, initialTab]);

  const handleUpdateCallStatus = async (
    callStatus: "CONFIRMED" | "NO_ANSWER",
  ) => {
    try {
      if (callStatus === "CONFIRMED") {
        if (isOperaciones && isJunkDni(receipt?.customer?.dni)) {
          toast.warning("DNI vacío o inválido, pero la entrega fue confirmada");
        }
        // El backend solo valida saltos de un paso (ver ORDER_STATUS_FLOW):
        // un pedido en PAGADO (o cualquier estado no adyacente a LLAMADO)
        // rechazaba el PATCH directo a status: "LLAMADO" — se encadenan acá
        // los pasos intermedios, igual que handleChangeStatus en Pedidos.
        const steps = receipt
          ? getStatusChainSteps(receipt.status as OrderStatus, "LLAMADO")
          : ["LLAMADO" as OrderStatus];
        if (steps.length > 0) {
          for (const step of steps) {
            if (!(await patchOrder({ status: step, ...(step === "LLAMADO" && { callStatus }) }))) return;
          }
        } else {
          // Ya está en LLAMADO o más adelante — solo confirmar la llamada.
          await patchOrder({ callStatus });
        }
      } else {
        await patchOrder({ callStatus });
      }

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

      await patchOrder({
        callStatus: "SCHEDULED",
        callbackAt,
        userId: auth?.user?.id,
        sellerName: auth?.user?.email,
      });

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
      await patchOrder({ notes });
      toast.success("Notas guardadas correctamente");
    } catch (error) {
      console.error("Error saving notes", error);
      toast.error("Error al guardar las notas");
    } finally {
      setSavingNotes(false);
    }
  };

  const [savingTracking, setSavingTracking] = useState(false);
  const [newShippingKey, setNewShippingKey] = useState("");
  useEffect(() => setNewShippingKey(""), [receiptKey, open]);
  // QR del link público de rastreo — fallback genérico para couriers sin
  // documento propio descargable por API (Aliclik/EVA hoy); Shalom usa
  // ShalomDocumentCard (PDF real) en vez de esto.
  const trackingQrUrl = useQRCode(
    orderHeader ? trackingUrlFor(orderHeader) : "",
  );
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

  // Los 4 campos de tracking manual (N° tracking, código, oficina, clave)
  // solo deben poder cargarse una vez que el pedido tiene un comprobante de
  // pago adjunto — antes se podían editar libremente y se generaban claves
  // de recojo sin respaldo de pago.
  const canEditCourierFields = orderHeader ? hasPaymentProof(orderHeader) : false;
  // Método del pago que aportó el comprobante que habilita la clave — mismo
  // criterio que hasPaymentProof, para mostrar "Cobrado (Yape) · validado"
  // sin inventar un dato que no exista.
  const proofPaymentMethod = orderHeader?.payments?.find(
    (p) => !!p.paymentProofUrl,
  )?.paymentMethod;
  // La Clave de recojo (a diferencia del resto de campos de courier) se
  // revela solo cuando el pedido queda libre de deuda, no con solo tener un
  // comprobante cargado — puede haber comprobante de un pago parcial y
  // seguir habiendo saldo pendiente.
  const financialState = receipt ? receiptFinancialState(receipt) : null;
  const isDebtFree = financialState?.isPaid === true;

  const handleSaveTracking = async () => {
    if (!receipt || !orderId || !originalTracking) return;
    // La clave sigue protegida por su propio `disabled` mientras no haya
    // comprobante — acá no se bloquea el guardado entero, para no impedir
    // guardar tracking/código/oficina (que ya no dependen del comprobante).

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
      await patchOrder({
        externalTrackingNumber: receipt.externalTrackingNumber,
        shippingCode: receipt.shippingCode,
        ...(receipt.shippingKey || isDebtFree ? { shippingKey: receipt.shippingKey } : {}),
        shippingOffice: receipt.shippingOffice,
      });
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
    const greeting = `Hola ${receipt.customer.fullName}! Te contactamos por tu pedido ${receipt.orderNumber}.`;
    const message = isPendingPurchase ? greeting : `${greeting}\n\nPuedes rastrear tu pedido aquí: ${trackingUrl}`;

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

  const handleDownloadPdf = async () => {
    if (!receipt || isPendingPurchase) return;
    const operation = beginPrint();
    try {
      await downloadNotaVentaPdf(receipt, orderHeader, auth?.company, operation);
    } finally { operation.release(); }
  };

  const handlePrint = async () => {
    if (!receipt || isPendingPurchase) return;
    if (orderHeader && canPrepareDeferredManualOrder(orderHeader)) {
      toast.error(salesPhysicalOperationBlockReason(orderHeader));
      return;
    }
    const operation = beginPrint();
    try {
      await printOrderLabel(receipt, orderHeader, auth?.company, operation);
      if (!operation.isCurrent?.()) return;

      // El cobro completo todavía no equivale a la preparación del paquete.
      if ((receipt.status === "PENDIENTE" || receipt.status === "PAGADO") && !salesStatusBlockReason(orderHeader ?? {}, "PREPARADO")) {
        setPrintConfirmation({ key: receiptKey, orderId: receipt.orderId, stockVersion: receipt.stockVersion, status: receipt.status });
      }
    } finally { operation.release(); }
  };

  const handleConfirmPrintStatus = async () => {
    if (!printConfirmOpen || activeReceiptKey.current !== receiptKey) return;
    const operation = beginPrint();
    try {
      setIsUpdatingStatus(true);
      if (!(await patchOrder({ status: "PREPARADO" }))) return;
      if (!operation.isCurrent?.()) return;
      toast.success("Pedido actualizado a PREPARADO");
      fetchReceipt();
      onOrderUpdated?.();
      setPrintConfirmation(null);
    } catch (error) {
      if (!operation.isCurrent?.()) return;
      console.error("Error updating status to PREPARADO", error);
      toast.error("No se pudo actualizar el estado del pedido");
    } finally {
      if (operation.isCurrent?.()) setIsUpdatingStatus(false);
      operation.release();
    }
  };

  const handlePrintShippingReceipt = async () => {
    if (!receipt || !shippingGuide) return;
    const operation = beginPrint();
    try {
      await printCustomerShippingLabel(receipt, shippingGuide, auth?.company, operation);
    } finally { operation.release(); }
  };

  const handleConfirmCancellation = async (
    reason: CancellationReason,
    reasonNotes?: string,
  ) => {
    if (await routeSaleLifecycle(orderHeader, "ANULADO", (action) => {
      setCancellationModalOpen(false);
      setLifecycleAction(action);
    })) return;
    setIsCancelling(true);
    try {
      if (!(await patchOrder({
        status: "ANULADO",
        cancellationReason: reason,
        notes: reasonNotes,
      }))) return;
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
    if (!receipt || isPendingPurchase || newStatus === receipt.status) return;
    const blocked = salesStatusBlockReason(orderHeader ?? {}, newStatus);
    if (blocked) { toast.error(blocked); return; }
    if (await routeSaleLifecycle(orderHeader, newStatus, setLifecycleAction)) return;
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
      if (!(await patchOrder({ status: newStatus }))) return;
      toast.success(`Estado actualizado a ${newStatus}`);
      fetchReceipt();
      onOrderUpdated?.();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "No se pudo actualizar el estado",
      );
      if (orderHeader && canPrepareDeferredManualOrder(orderHeader)) {
        void fetchReceipt();
        onOrderUpdated?.();
      }
    } finally {
      setChangingStatus(false);
    }
  };

  const handleReprogramDelivery = async (targetId: string, callbackAt: Date) => {
    try {
      await patchOrder({ callStatus: "SCHEDULED", callbackAt: callbackAt.toISOString() }, targetId);
      toast.success("Pedido reprogramado");
      setReassignModalOpen(false);
      fetchReceipt();
      onOrderUpdated?.();
    } catch {
      toast.error("No se pudo reprogramar el pedido");
    }
  };

  // Respuesta cruda de trackShalomGuide — trae statuses.data con fecha por
  // paso (registrado/origen/transito/destino/reparto/entregado), la misma
  // forma que ya renderiza el modal "Tracking en Tiempo Real" de
  // CourierTrackingView.tsx. Se usa para pintar una línea de tiempo real
  // (no inventada) en la tab Seguimiento.
  const [shalomTrackResult, setShalomTrackResult] = useState<Record<
    string,
    unknown
  > | null>(null);

  const syncShalomTracking = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!auth?.accessToken || !orderHeader) return;
      if (!silent) setSyncingTracking(true);
      try {
        const guideRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${orderHeader.id}`,
        );
        const result = await trackShalomGuide(auth.accessToken, guideRes.data.id);
        setShalomTrackResult(result);
        if (!silent) toast.success("Sincronizado con Shalom");
        fetchReceipt();
        onOrderUpdated?.();
      } catch {
        if (!silent) toast.error("No se pudo sincronizar con Shalom");
      } finally {
        if (!silent) setSyncingTracking(false);
      }
    },
    [auth?.accessToken, orderHeader, fetchReceipt, onOrderUpdated],
  );

  const handleForceSyncTracking = () => syncShalomTracking();

  // Auto-sync silencioso al abrir el modal: el estado de orderHeader.shalomStatus
  // solo se actualiza vía webhook, así que al abrir "Seguimiento" puede mostrar
  // un estado viejo. Se consulta 1 sola guía (no lote) para no floodear a Shalom
  // (ver 2a51d6e). autoSyncedOrderIdRef evita repetir la consulta en cada
  // refetch de orderHeader dentro del mismo "open".
  const autoSyncedOrderIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      autoSyncedOrderIdRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !orderHeader?.id || !auth?.accessToken) return;
    if (autoSyncedOrderIdRef.current === orderHeader.id) return;
    if (
      !orderHeader.guideNumber ||
      (!isShalomCourier(orderHeader.courier) &&
        !isShalomCourier(orderHeader.shippingOffice))
    ) {
      return;
    }
    autoSyncedOrderIdRef.current = orderHeader.id;
    syncShalomTracking({ silent: true });
  }, [open, orderHeader, auth?.accessToken, syncShalomTracking]);

  // Desvincula el pedido de su guía actual en ms-courier y lo devuelve a
  // PREPARADO en ms-ventas (mismo patrón que usaba ShipmentDetailModal).
  const releaseFromGuide = async () => {
    if (!orderHeader) return;
    const blocked = salesStatusBlockReason(orderHeader, "PREPARADO") || assignmentBlockReason(orderHeader, "PREPARADO");
    if (blocked) throw new Error(blocked);
    if (!canShipCommercialOrder(orderHeader)) throw new Error("Esta venta no requiere una guía física.");
    const guideRes = await axios.get(
      `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${orderHeader.id}`,
    );
    const guideId = guideRes.data.id;
    await axios.patch(
      `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guideId}/orders/remove`,
      { orderIds: [orderHeader.id] },
    );
    if (!(await patchOrder({ guideNumber: null, status: "PREPARADO" }))) {
      throw new Error("El cambio de estado todavía no está confirmado.");
    }
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

  const confirmationAccess = useCcPurchaseConfirmationAccess(
    orderId,
    orderHeader?.canalOrigen,
    open && isPendingPurchase && !hideCallManagement,
  );
  const canEditCustomerData = hasPermission("MANAGE_CUSTOMER_SERVICE") || canEditOrder ||
    (canCompleteCustomerServicePurchaseData(orderHeader ?? {}) && confirmationAccess.canConfirm);
  const ccSubEstado = subEstadoCc ?? (canalOrigen === "shopify_cod" ? "por_confirmar" : null);
  const detailMoney = (value: number) => isPendingPurchase
    ? formatSalesMoney(value, orderHeader?.currency)
    : `S/${value.toFixed(2)}`;
  const isConfirmed = receipt?.status === "LLAMADO";
  const isScheduledDelivery =
    !!receipt?.externalSource && receipt?.callStatus === "SCHEDULED";
  const customerNotes = orderHeader?.customerNotes ?? receipt?.customerNotes;
  const internalNotes = orderHeader?.notes ?? receipt?.notes;
  const orderNotes = customerNotes ?? internalNotes;

  if (!receipt && !loading && (loadedReceiptKey !== receiptKey || !isPendingPurchase)) return null;

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

  const storeName = auth?.company?.stores?.find(
    (s) => s.id === orderHeader?.storeId,
  )?.name;

  const lockedKeyCard = (
    <div className="mt-3 rounded-xl border border-[#F3D9A8] bg-[#FEF3E2] dark:border-amber-800 dark:bg-amber-950/30 p-[13px]">
      <div className="flex items-center gap-[11px]">
        <div className="h-9 w-9 rounded-lg grid place-items-center shrink-0 bg-white dark:bg-amber-900 text-[#B45309] dark:text-amber-300">
          <Lock className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-[13.5px] text-[#92400E] dark:text-amber-400">
            Clave de recojo bloqueada
          </div>
          <div className="text-xs text-muted-foreground">
            {`Pendiente de cobro${
              receipt?.totals.pendingAmount
                ? ` · S/ ${receipt.totals.pendingAmount.toFixed(2)}`
                : ""
            }`}
          </div>
        </div>
        <div className="font-mono font-black tracking-[0.24em] text-xl text-[#C29B54] dark:text-amber-400">
          ••••
        </div>
      </div>
      <Button
        size="sm"
        className="w-full mt-[11px] bg-[#B45309] hover:bg-[#92400E] text-white"
        onClick={() => setPaymentModalOpen(true)}
      >
        <DollarSign className="h-4 w-4 mr-1.5" />
        Registrar cobranza
      </Button>
      <p className="text-[11px] text-muted-foreground mt-2 leading-[1.45]">
        La clave se habilita cuando el pedido queda libre
        de deuda.
      </p>
    </div>
  );

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
              <div className="min-w-0 space-y-4">
                <DialogHeader>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <DialogTitle className="text-lg">
                        Pedido {receipt.orderNumber} · {receipt.customer.fullName}
                      </DialogTitle>
                      <div className="text-sm text-muted-foreground mt-1">
                        Vendedor: {orderHeader?.sellerName || "—"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Origen: {(receipt.salesChannel || "—").replace(/_/g, " ")}
                        {storeName ? ` · ${storeName}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                    <FinancialStatusBadge pendingAmount={financialState?.pendingAmount ?? Number.NaN} />
                    <Select
                      value={receipt.status}
                      onValueChange={(v) => handleChangeStatus(v as OrderStatus)}
                      disabled={changingStatus || isPendingPurchase}
                    >
                      <SelectTrigger className="w-[190px] h-9 text-sm font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableStatuses(receipt.status as OrderStatus).filter((status) => status === receipt.status || !salesStatusBlockReason(orderHeader ?? {}, status)).map(
                          (s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    </div>
                  </div>
                </DialogHeader>
                {!isPendingPurchase && orderHeader && <UnitAssignmentNotice order={orderHeader} />}
                {orderHeader?.commercialStage === "SALE" && orderHeader.commercialStockState === "DEFERRED" && <p className="text-sm text-amber-700">{salesPhysicalOperationBlockReason(orderHeader)}{orderHeader.commercialLeadId && !canPrepareDeferredManualOrder(orderHeader) && <a className="ml-1 font-semibold underline" href={commercialLeadHref(orderHeader.commercialLeadId)}>Preparar reserva de stock</a>}</p>}
                {!isPendingPurchase && orderHeader && <SaleUnitLifecycleButtons order={orderHeader} onAction={setLifecycleAction} />}

                <Tabs value={tab} onValueChange={setTab}>
                  <div className="overflow-x-auto -mx-1 px-1">
                    <TabsList className="w-max min-w-full sm:w-fit">
                      <TabsTrigger value="resumen" className="whitespace-nowrap">
                        <Package className="h-4 w-4 mr-1.5" /> Resumen
                      </TabsTrigger>
                      <TabsTrigger disabled={isPendingPurchase} value="seguimiento" className="whitespace-nowrap">
                        <Truck className="h-4 w-4 mr-1.5" /> Seguimiento
                      </TabsTrigger>
                      <TabsTrigger value="pagos" className="whitespace-nowrap">
                        <DollarSign className="h-4 w-4 mr-1.5" /> Pagos
                      </TabsTrigger>
                      <TabsTrigger disabled={isPendingPurchase} value="reasignacion" className="whitespace-nowrap">
                        <Repeat className="h-4 w-4 mr-1.5" /> Reasignación
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="resumen" className="pt-3 space-y-4">
              <div className={RESUMEN_ROW_GRID}>
                {/* ================================== */}
                {/* SECCIÓN IZQUIERDA */}
                {/* ================================== */}
                {/* flex-col + Resumen de Pagos flex-1: el borde inferior queda
                    alineado con la card de Cliente (columna derecha). */}
                <div className="flex flex-col gap-4">
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
                          {item.units?.length ? (
                            <p className="text-xs font-mono break-all">
                              IMEI / series: {item.units.map((unit) => unit.code).join(", ")}
                            </p>
                          ) : null}
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
                              <strong>{detailMoney(item.unitPrice)}</strong>
                            </span>
                          </div>
                          <div className="flex justify-between text-sm font-medium mt-1 pt-1 border-t border-border">
                            <span>Sub Total:</span>
                            <span className="text-primary">
                              {detailMoney(item.subtotal)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {orderNotes?.trim() ? (
                    <section
                      aria-labelledby="order-notes-heading"
                      className="border border-border rounded-lg p-4"
                    >
                      <h3 id="order-notes-heading" className="font-semibold mb-2 text-lg">
                        Comentarios del pedido
                      </h3>
                      <span className="mb-2 block text-xs text-muted-foreground">
                        {customerNotes == null
                          ? "Solo visible para el equipo"
                          : "Visible para el cliente en Powip Link"}
                      </span>
                      <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {orderNotes}
                      </p>
                    </section>
                  ) : null}

                  {customerNotes != null && internalNotes?.trim() && internalNotes !== customerNotes ? (
                    <section
                      aria-labelledby="internal-notes-heading"
                      className="border border-border rounded-lg p-4"
                    >
                      <h3 id="internal-notes-heading" className="font-semibold mb-2 text-lg">
                        Observaciones internas
                      </h3>
                      <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {internalNotes}
                      </p>
                    </section>
                  ) : null}

                  {/* Resumen de Pagos */}
                  <div className="flex-1 border border-border rounded-lg p-4 bg-muted">
                    <h3 className="font-semibold mb-3 text-lg">
                      Resumen de Pagos
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Productos:</span>
                        <span>{detailMoney(receipt.totals.productsTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IGV 18%:</span>
                        <span>{detailMoney(receipt.totals.taxTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Envío:</span>
                        <span>{detailMoney(receipt.totals.shippingTotal)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                        <span>Total:</span>
                        <span>{detailMoney(receipt.totals.grandTotal)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Descuentos:</span>
                        <span>{detailMoney(receipt.totals.discountTotal)}</span>
                      </div>
                      <div className="flex justify-between text-green-600 font-medium">
                        <span>Adelanto:</span>
                        <span>{detailMoney(receipt.totals.totalPaid)}</span>
                      </div>
                      <div className="flex justify-between text-red-600 font-bold text-base">
                        <span>Por Cobrar:</span>
                        <span>{detailMoney(receipt.totals.pendingAmount)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ================================== */}
                {/* SECCIÓN DERECHA */}
                {/* ================================== */}
                <div className="flex min-w-0 flex-col">
                  {/* Cliente — misma altura que Productos + Resumen de Pagos */}
                  <div className="border border-border rounded-lg p-5 flex-1 flex flex-col">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <h3 className="font-semibold text-lg">Cliente</h3>
                      <div className="flex flex-wrap gap-1">
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
                          disabled={isPendingPurchase}
                          title="Rastreo"
                        >
                          <Truck className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="relative h-9 w-9 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900"
                          onClick={() => setPaymentModalOpen(true)}
                          aria-label={isPendingPurchase ? "Gestionar adelantos y comprobantes" : undefined}
                          title={
                            isPendingPurchase ? "Gestionar adelantos y comprobantes" : receipt.payments.some((p) => p.status === "PENDING")
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
                          disabled={isPendingPurchase}
                          title="Imprimir"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900"
                          onClick={handleDownloadPdf}
                          disabled={isPendingPurchase}
                          title="Descargar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>

                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9"
                          onClick={() => {
                            if (onEditOrder) onEditOrder();
                            else router.push(`/registrar-venta?orderId=${orderId}`);
                          }}
                          disabled={!canEditOrder}
                          title="Editar Pedido"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
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
                      <div className="col-span-full flex items-center gap-1">
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
                      <GoogleMapsUrlField
                        url={receipt.customer.googleMapsUrl}
                        className="col-span-full"
                      />
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

                      {/* Datos de tracking manual — para couriers sin
                          integración por API, el tracking/código/oficina/
                          clave se tipean a mano. */}
                      {!isPendingPurchase && showTracking && receipt && (
                        <div className="col-span-full mt-4 pt-4 border-t border-dashed border-muted-foreground/30">
                          <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground mb-3">
                            Datos de tracking
                          </div>
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
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateTrackingField("externalTrackingNumber", e.target.value)
                                  }
                                  onBlur={handleSaveTracking}
                                />
                                {receipt.externalTrackingNumber && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                                    onClick={() =>
                                      copyField(receipt.externalTrackingNumber || "", "Tracking")
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
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  updateTrackingField("shippingOffice", e.target.value)
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
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  updateTrackingField("shippingCode", e.target.value)
                                }
                                onBlur={handleSaveTracking}
                              />
                            </div>
                          </div>

                          {/* Clave — único campo que se bloquea mientras haya
                              deuda. Bloqueada: mismo bloque visual (icono,
                              título, CTA) que la card "Clave de recojo" de la
                              tab Seguimiento, sin exponer el valor real en
                              ningún texto. */}
                          {!isDebtFree ? (
                            <>
                              {receipt.shippingKey ? lockedKeyCard : null}
                              <Input type="password" className="mt-3 h-8 text-xs" placeholder="Registrar nueva clave (oculta)" value={newShippingKey} onChange={(event) => setNewShippingKey(event.target.value)} onBlur={async () => {
                                if (!newShippingKey.trim()) return;
                                try {
                                  if (await patchOrder({ shippingKey: newShippingKey })) { setNewShippingKey(""); void fetchReceipt(); onOrderUpdated?.(); }
                                } catch { toast.error("No se pudo guardar la clave de recojo"); }
                              }} />
                            </>
                          ) : (
                            <div className="mt-3">
                              <span className="text-muted-foreground block text-[10px] uppercase mb-1">
                                Clave
                              </span>
                              <div className="relative max-w-[calc(50%-8px)]">
                                <Input
                                  className="h-8 text-xs pr-8 font-mono"
                                  placeholder="Clave..."
                                  value={receipt.shippingKey || ""}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateTrackingField("shippingKey", e.target.value)
                                  }
                                  onBlur={handleSaveTracking}
                                />
                              </div>
                            </div>
                          )}
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
                          <div className="col-span-full mt-4 pt-4 border-t border-dashed border-muted-foreground/30">
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
                              {isDebtFree && (
                                <div>
                                  <span className="text-muted-foreground block text-xs underline mb-1">
                                    Clave
                                  </span>
                                  <span className="text-sm font-semibold">
                                    {receipt.shippingKey || "-"}
                                  </span>
                                </div>
                              )}
                            </div>
                            {!isDebtFree && !!receipt.shippingKey && lockedKeyCard}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>
                  <div
                    className={`${RESUMEN_ROW_GRID} items-start`}
                  >
                  {/* ================================== */}
                  {/* COLUMNA IZQUIERDA: gestión del pedido */}
                  {/* ================================== */}
                  <div className="space-y-3">
                  {/* Promo del día (solo vista de atención al cliente) y Evidencia de
                      despacho, arriba de la gestión — ocupan solo esta columna. */}
                  {!hideCallManagement && !isPendingPurchase && (
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
                  {!isPendingPurchase && <OrderEvidenceSection
                    orderId={orderId}
                    canUpload={isOperaciones && hasPermission("MANAGE_OPERATIONS")}
                    accessToken={auth?.accessToken}
                  />}
                  {hasGestionColumn && (
                  <>
                  {/* CC v2: bloque datos incompletos (visible cuando el pedido tiene sub_estado_cc activo) */}
                  {!hideCallManagement && canEditCustomerData && (ccSubEstado || isPendingPurchase) && (
                    <DatosIncompletosBlock
                      key={`datos-${orderId}`}
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
                  {!hideCallManagement && !canEditOrder && isPendingPurchase ? (
                    <p className="text-sm text-muted-foreground">
                      La edición completa del pedido requiere el permiso Editar ventas.
                    </p>
                  ) : null}

                  {/* Gestión de Llamada / Entrega — según origen del pedido */}
                  {!hideCallManagement && (
                    ccSubEstado ? (
                      <CcGestionPanel
                        key={`gestion-${orderId}`}
                        commercialStage={orderHeader?.commercialStage}
                        commercialLeadId={orderHeader?.commercialLeadId}
                        canalOrigen={orderHeader?.canalOrigen}
                        orderUpdatedAt={orderHeader?.updated_at}
                        commercialStockState={orderHeader?.commercialStockState}
                        pendingPurchase={isPendingPurchase}
                        orderId={orderId}
                        subEstadoCc={ccSubEstado}
                        callAttempts={receipt.callAttempts ?? 0}
                        datosCompletos={datosCompletos}
                        beforeCancellation={() => routeSaleLifecycle(orderHeader, "ANULADO", setLifecycleAction)}
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
                    ) : isPendingPurchase ? (
                      <CcSaleConfirmationPanel
                        key={`confirmar-${orderId}`}
                        orderId={orderId}
                        commercialLeadId={orderHeader?.commercialLeadId}
                        canalOrigen={orderHeader?.canalOrigen}
                        orderUpdatedAt={orderHeader?.updated_at}
                        datosCompletos={datosCompletos}
                        onUpdated={() => {
                          void fetchReceipt();
                          void fetchLogs();
                          onOrderUpdated?.();
                        }}
                      />
                    ) : isScheduledDelivery ? (
                      <ScheduledDeliverySection
                        orderId={orderId}
                        status={receipt.status as OrderStatus}
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
                              onClick={() => { void handleChangeStatus("ANULADO"); }}
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
                                onClick={() => { void handleChangeStatus("ANULADO"); }}
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
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-purple-700 dark:text-purple-400 text-sm">
                          Aliclik — Estado de despacho
                        </h3>
                        <AliclikStatusBadge
                          aliclikDispatchStatus={aliclikDispatchStatus}
                          aliclikSyncedAt={aliclikSyncedAt}
                        />
                      </div>
                      <div className="text-xs">
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
                  )}

                  {/* Estado EVA Courier — antes no existía ninguna tarjeta acá
                      (a diferencia de Shalom/Aliclik), pese a cargarse evaStatus
                      y evaSyncedAt del pedido. */}
                  {(evaStatus || evaSyncedAt) && (
                    <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-950/30">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-blue-700 dark:text-blue-400 text-sm">
                          EVA Courier — Estado de envío
                        </h3>
                        <EvaStatusBadge evaStatus={evaStatus} evaSyncedAt={evaSyncedAt} />
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground block underline mb-1">
                          Última sincronización
                        </span>
                        <span className="font-semibold">
                          {evaSyncedAt
                            ? new Date(evaSyncedAt).toLocaleString("es-PE", {
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
                  )}

                  {/* Script sugerido CC */}
                  {subEstadoCc && (
                    <CcScriptPanel
                      subEstadoCc={subEstadoCc}
                      clienteName={receipt.customer.fullName}
                      orderNumber={receipt.orderNumber}
                    />
                  )}
                  </>
                  )}
                  </div>

                  {/* ================================== */}
                  {/* COLUMNA DERECHA: historial y comentarios */}
                  {/* ================================== */}
                  {/* Comentarios Timeline */}
                  <div className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Historial / Comentarios</h3>
                      {!isPendingPurchase && <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            Más acciones
                            <MoreVertical className="h-4 w-4 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => { void handleChangeStatus("ANULADO"); }}
                          >
                            Anular Venta
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>}
                    </div>

                    {/* Historial — más reciente arriba; scrollea de a un comentario por vez.
                        Altura máxima (no fija): con pocos registros el formulario queda
                        justo debajo sin hueco vacío; con muchos, la lista scrollea a 280px
                        y el formulario sigue a la vista. */}
                    <div className="max-h-[280px] overflow-y-auto mb-3 pr-1 snap-y snap-mandatory">
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
                    {(!isPendingPurchase || canManageCc) && <div className="border-t pt-3">
                      <div className="flex gap-2">
                        <Textarea
                          aria-label="Comentario de Gestión CC"
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
                          aria-label="Guardar comentario"
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
                    </div>}
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
                          {isShalomCourier(shippingGuide.courierName) && (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-black tracking-wide text-white">
                              <span className="grid h-3.5 w-3.5 place-items-center rounded-[3px] bg-white text-[9px] font-black text-red-600">
                                S
                              </span>
                              SHALOM
                            </span>
                          )}
                          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {shippingGuide.deliveryType} · {STATUS_LABEL[shippingGuide.status] || shippingGuide.status}
                          </span>
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

                      {/* Resumen tipo "dl" — calca el layout del mockup de
                          seguimiento (label a la izq., valor en negrita a la
                          der.). N° de orden usa shalomSerie (equivalente real
                          a la "N° de orden" de Shalom); Código se bloquea sin
                          comprobante, Clave se bloquea mientras haya deuda
                          (ver isDebtFree). */}
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px] mb-3">
                        {orderHeader?.shalomSerie && (
                          <>
                            <dt className="text-muted-foreground font-medium">
                              N° de orden
                            </dt>
                            <dd className="text-right font-bold font-mono">
                              {orderHeader.shalomSerie}
                            </dd>
                          </>
                        )}
                        {shippingGuide.shippingCode && (
                          <>
                            <dt className="text-muted-foreground font-medium">
                              Código
                            </dt>
                            <dd className="text-right font-bold font-mono">
                              {canEditCourierFields ? (
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
                            <dt className="text-muted-foreground font-medium">
                              Agencia destino
                            </dt>
                            <dd className="text-right font-bold">
                              {shippingGuide.shippingOffice}
                            </dd>
                          </>
                        )}
                        {shippingGuide.shippingKey && (
                          <>
                            <dt className="text-muted-foreground font-medium">
                              Clave
                            </dt>
                            <dd className="text-right font-bold font-mono tracking-widest">
                              {isDebtFree
                                ? shippingGuide.shippingKey
                                : "••••"}
                            </dd>
                          </>
                        )}
                      </dl>

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

                  {/* Clave de recojo — gateada al saldo pendiente: la clave
                      real solo se muestra cuando el pedido queda libre de
                      deuda (no alcanza con tener un comprobante cargado, si
                      fue de un pago parcial sigue habiendo saldo). Mientras
                      haya deuda se ofrece un acceso directo a "Registrar
                      cobranza" (reusa PaymentVerificationModal, ya montado
                      más abajo vía paymentModalOpen). */}
                  {shippingGuide?.shippingKey && (
                    <div
                      className={`rounded-xl border p-[13px] ${
                        isDebtFree
                          ? "border-[#A7E3CE] bg-[#E7F8F1] dark:border-green-800 dark:bg-green-950/30"
                          : "border-[#F3D9A8] bg-[#FEF3E2] dark:border-amber-800 dark:bg-amber-950/30"
                      }`}
                    >
                      <div className="flex items-center gap-[11px]">
                        <div
                          className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 text-base ${
                            isDebtFree
                              ? "bg-[#047857] text-white"
                              : "bg-white dark:bg-amber-900 text-[#B45309] dark:text-amber-300"
                          }`}
                        >
                          {isDebtFree ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Lock className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`font-extrabold text-[13.5px] ${
                              isDebtFree
                                ? "text-[#047857] dark:text-green-400"
                                : "text-[#92400E] dark:text-amber-400"
                            }`}
                          >
                            {isDebtFree
                              ? "Clave habilitada"
                              : "Clave de recojo bloqueada"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isDebtFree
                              ? proofPaymentMethod
                                ? `Cobrado (${proofPaymentMethod}) · validado`
                                : "Pedido libre de deuda"
                              : `Pendiente de cobro${
                                  receipt?.totals.pendingAmount
                                    ? ` · S/ ${receipt.totals.pendingAmount.toFixed(2)}`
                                    : ""
                                }`}
                          </div>
                        </div>
                        <div
                          className={`font-mono font-black tracking-[0.24em] text-xl ${
                            isDebtFree
                              ? "text-[#047857] dark:text-green-400"
                              : "text-[#C29B54] dark:text-amber-400"
                          }`}
                        >
                          {isDebtFree
                            ? shippingGuide.shippingKey
                            : "••••"}
                        </div>
                      </div>
                      {!isDebtFree && (
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
                            La clave se habilita cuando el pedido queda libre
                            de deuda.
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  {isShalomCourier(orderHeader?.courier) && (
                    <div className="flex items-start gap-2.5 rounded-[11px] bg-[#EEF0FF] dark:bg-indigo-950/30 px-[13px] py-[11px] text-[12.5px] leading-[1.45] text-[#3730A3] dark:text-indigo-300">
                      <Zap className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        <b>Tiempo real:</b> POWIP sincroniza el estado por
                        webhook de Shalom. Cuando el cliente recoge en
                        agencia, el estado pasa a <b>Entregado</b>{" "}
                        automáticamente.
                      </span>
                    </div>
                  )}

                  {/* Columna izquierda: estado del courier (Shalom/Aliclik/EVA
                      según cuál tenga el pedido) + línea de tiempo (solo
                      Shalom, único con ese detalle granular). Columna
                      derecha: documento real del courier si existe API para
                      traerlo (hoy solo Shalom vía ShalomDocumentCard,
                      embebido directo en vez de requerir un botón "Ver" que
                      abra un modal aparte) — para Aliclik/EVA, que no
                      exponen un comprobante descargable, se muestra el link
                      público de rastreo (el mismo que ya recibe el cliente). */}
                  {(() => {
                    const isShalom =
                      isShalomCourier(orderHeader?.courier) ||
                      isShalomCourier(orderHeader?.shippingOffice);
                    const isAliclik = isAliclikCourier(orderHeader?.courier);
                    const isEva =
                      isEvaCourier(orderHeader?.courier) ||
                      isEvaCourier(orderHeader?.shippingOffice);
                    if (!isShalom && !isAliclik && !isEva) return null;

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                        <div className="flex flex-col gap-4 [&>*:last-child]:flex-1">
                          {isShalom ? (
                            <>
                              {/* Estado Shalom — lo que el webhook de Shalom guardó en
                                  el pedido (sin fetch en vivo, mismo dato que
                                  ShalomOrderTrackingView). courier se setea en el
                                  mismo PATCH que guideNumber al crear la guía, así
                                  que puede existir aunque shalomStatus todavía no se
                                  haya sincronizado (badge "Sin registrar" para ese
                                  caso). Remitente sale del tracking en vivo de
                                  Shalom (shalomTrackResult.search.data.remitente) —
                                  no hay campo persistido para quién envía, solo para
                                  el destinatario (shalomRecipientDoc/Phone). */}
                              <div className="border border-teal-200 dark:border-teal-800 rounded-lg p-4 bg-teal-50/50 dark:bg-teal-950/30">
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    Estado Shalom
                                  </h3>
                                  <ShalomStatusBadge
                                    status={orderHeader?.shalomStatus}
                                    error={orderHeader?.shalomError}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                  {(() => {
                                    const remitente = (
                                      shalomTrackResult?.search as
                                        | { data?: { remitente?: { nombre?: string; documento?: string } } }
                                        | undefined
                                    )?.data?.remitente;
                                    if (!remitente?.nombre) return null;
                                    return (
                                      <div className="col-span-2">
                                        <span className="text-muted-foreground">
                                          Remitente:{" "}
                                        </span>
                                        <span className="font-medium">
                                          {remitente.nombre}
                                          {remitente.documento
                                            ? ` · ${remitente.documento}`
                                            : ""}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                  {orderHeader?.shalomSerie && (
                                    <div>
                                      <span className="text-muted-foreground">
                                        N° Serie:{" "}
                                      </span>
                                      <span className="font-medium">
                                        {orderHeader.shalomSerie}
                                      </span>
                                    </div>
                                  )}
                                  {orderHeader?.shalomOriginAgency && (
                                    <div>
                                      <span className="text-muted-foreground">
                                        Agencia Origen:{" "}
                                      </span>
                                      <span className="font-medium">
                                        {orderHeader.shalomOriginAgency}
                                      </span>
                                    </div>
                                  )}
                                  {orderHeader?.shalomDestinationAgency && (
                                    <div>
                                      <span className="text-muted-foreground">
                                        Agencia Destino:{" "}
                                      </span>
                                      <span className="font-medium">
                                        {orderHeader.shalomDestinationAgency}
                                      </span>
                                    </div>
                                  )}
                                  {orderHeader?.shalomRecipientDoc && (
                                    <div>
                                      <span className="text-muted-foreground">
                                        Doc. Destinatario:{" "}
                                      </span>
                                      <span className="font-medium">
                                        {orderHeader.shalomRecipientDoc}
                                      </span>
                                    </div>
                                  )}
                                  {orderHeader?.shalomRecipientPhone && (
                                    <div>
                                      <span className="text-muted-foreground">
                                        Tel. Destinatario:{" "}
                                      </span>
                                      <span className="font-medium">
                                        {orderHeader.shalomRecipientPhone}
                                      </span>
                                    </div>
                                  )}
                                  {orderHeader?.shalomContent && (
                                    <div className="col-span-2">
                                      <span className="text-muted-foreground">
                                        Contenido declarado:{" "}
                                      </span>
                                      <span className="font-medium">
                                        {orderHeader.shalomContent}
                                      </span>
                                    </div>
                                  )}
                                  {orderHeader?.shalomError && (
                                    <div className="col-span-2">
                                      <span className="text-muted-foreground">
                                        Error Shalom:{" "}
                                      </span>
                                      <span className="font-medium text-red-600">
                                        {orderHeader.shalomError}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Línea de tiempo Shalom — datos reales de
                                  trackShalomGuide (mismo response que ya usa el
                                  modal "Tracking en Tiempo Real" de
                                  CourierTrackingView.tsx), no un historial
                                  inventado. Solo hay datos después de sincronizar
                                  (auto al abrir el modal, o "Forzar sync de
                                  tracking" más abajo). Aliclik/EVA no tienen un
                                  endpoint de tracking en vivo equivalente, así que
                                  no hay línea de tiempo para ellos todavía. */}
                              {(() => {
                                const statusesData = (
                                  shalomTrackResult?.statuses as
                                    | { data?: Record<string, { fecha?: string }> }
                                    | undefined
                                )?.data;
                                if (!statusesData) return null;
                                const reachedIdx = SHALOM_STEPS.reduce(
                                  (acc, step, idx) =>
                                    statusesData[step.key]?.fecha ? idx : acc,
                                  -1,
                                );
                                if (reachedIdx === -1) return null;
                                return (
                                  <div className="border rounded-lg p-4">
                                    <div className="text-sm font-bold mb-3">
                                      🕑 Línea de tiempo · estados de Shalom
                                    </div>
                                    <div className="space-y-0">
                                      {SHALOM_STEPS.map((step, idx) => {
                                        const stepData = statusesData[step.key];
                                        const done = !!stepData?.fecha;
                                        const isLast = idx === SHALOM_STEPS.length - 1;
                                        return (
                                          <div
                                            key={step.key}
                                            className="relative pl-7 pb-4 last:pb-0"
                                          >
                                            {!isLast && (
                                              <div
                                                className={`absolute left-[9px] top-4 bottom-0 w-0.5 ${
                                                  done ? "bg-teal-500" : "bg-muted"
                                                }`}
                                              />
                                            )}
                                            <div
                                              className={`absolute left-0 top-0.5 h-[18px] w-[18px] rounded-full border-2 flex items-center justify-center text-[9px] ${
                                                done
                                                  ? "bg-teal-500 border-teal-500 text-white"
                                                  : "bg-background border-muted-foreground/30"
                                              }`}
                                            >
                                              {done ? "✓" : ""}
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span
                                                className={`text-sm font-semibold ${
                                                  done
                                                    ? "text-foreground"
                                                    : "text-muted-foreground/50"
                                                }`}
                                              >
                                                {SHALOM_STEP_ICONS[step.label] ?? ""}{" "}
                                                {step.label}
                                              </span>
                                              {stepData?.fecha && (
                                                <span className="text-xs text-muted-foreground">
                                                  {stepData.fecha}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })()}
                            </>
                          ) : isAliclik ? (
                            <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-4 bg-purple-50/50 dark:bg-purple-950/30">
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-purple-700 dark:text-purple-400 text-sm">
                                  Aliclik — Estado de despacho
                                </h3>
                                <AliclikStatusBadge
                                  aliclikDispatchStatus={aliclikDispatchStatus}
                                  aliclikSyncedAt={aliclikSyncedAt}
                                />
                              </div>
                              <div className="text-xs">
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
                          ) : (
                            <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-950/30">
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-blue-700 dark:text-blue-400 text-sm">
                                  EVA Courier — Estado de envío
                                </h3>
                                <EvaStatusBadge evaStatus={evaStatus} evaSyncedAt={evaSyncedAt} />
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                {orderHeader?.evaTrackingId && (
                                  <div className="col-span-2">
                                    <span className="text-muted-foreground block underline mb-1">
                                      ID de seguimiento EVA
                                    </span>
                                    <span className="font-semibold">
                                      {orderHeader.evaTrackingId}
                                    </span>
                                  </div>
                                )}
                                <div className="col-span-2">
                                  <span className="text-muted-foreground block underline mb-1">
                                    Última sincronización
                                  </span>
                                  <span className="font-semibold">
                                    {evaSyncedAt
                                      ? new Date(evaSyncedAt).toLocaleString("es-PE", {
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
                        </div>

                        <div>
                          {isShalom &&
                          shippingGuide?.guideNumber &&
                          orderHeader?.externalTrackingNumber &&
                          orderHeader?.shippingCode ? (
                            <ShalomDocumentCard order={orderHeader} />
                          ) : orderHeader ? (
                            <div className="h-full rounded-xl border border-border p-4 flex flex-col items-center justify-center gap-3 text-center">
                              <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground">
                                Enlace de seguimiento
                              </div>
                              {trackingQrUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={trackingQrUrl}
                                  alt="QR de seguimiento"
                                  className="h-24 w-24"
                                />
                              )}
                              <a
                                href={trackingUrlFor(orderHeader)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-semibold text-primary underline underline-offset-2"
                              >
                                Ver seguimiento público →
                              </a>
                              <p className="text-[11px] text-muted-foreground leading-[1.45]">
                                {isShalom
                                  ? "Faltan tracking/código para traer el comprobante real de Shalom."
                                  : "Este courier no expone un comprobante descargable por API todavía — este es el mismo link público que ya recibe el cliente."}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Acciones — calca la lista de botones full-width del
                      mockup (icono + label, alineados a la izquierda). Cada
                      una reusa una acción real que ya existe en el modal;
                      ninguna es nueva funcionalidad inventada. */}
                  {shippingGuide && (
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground mb-3">
                        Acciones
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setGuideDetailsModalOpen(true)}
                          className="flex items-center gap-2.5 rounded-lg border border-border px-[15px] py-[9px] text-[13px] font-semibold hover:bg-accent transition-colors"
                        >
                          <FileText className="h-4 w-4" />
                          Ver comprobante / rótulo{" "}
                          {isShalomCourier(shippingGuide.courierName)
                            ? "Shalom"
                            : ""}
                        </button>
                        {shippingGuide.shippingKey && (
                          <button
                            type="button"
                            disabled={!isDebtFree}
                            title={
                              isDebtFree
                                ? undefined
                                : "El pedido debe quedar libre de deuda antes de copiar la clave"
                            }
                            onClick={() => {
                              if (!isDebtFree || !shippingGuide.shippingKey) return;
                              navigator.clipboard.writeText(shippingGuide.shippingKey);
                              toast.success("Código de recojo copiado");
                            }}
                            className="flex items-center gap-2.5 rounded-lg border border-border px-[15px] py-[9px] text-[13px] font-semibold hover:bg-accent transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                          >
                            <Pencil className="h-4 w-4" />
                            Copiar código de recojo
                          </button>
                        )}
                        {receipt && (
                          <button
                            type="button"
                            onClick={handleWhatsApp}
                            className="flex items-center gap-2.5 rounded-lg border border-border px-[15px] py-[9px] text-[13px] font-semibold hover:bg-accent transition-colors"
                          >
                            <WhatsAppIcon className="h-4 w-4" />
                            Enviar seguimiento por WhatsApp
                          </button>
                        )}
                        {isShalomCourier(orderHeader?.courier) && (
                          <button
                            type="button"
                            disabled={syncingTracking}
                            onClick={handleForceSyncTracking}
                            className="flex items-center gap-2.5 rounded-lg border border-border px-[15px] py-[9px] text-[13px] font-semibold hover:bg-accent transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <RefreshCw
                              className={`h-4 w-4 ${syncingTracking ? "animate-spin" : ""}`}
                            />
                            Forzar sincronización con Shalom
                          </button>
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div className="rounded-2xl border border-border p-5 text-center">
                        <div className="text-xl sm:text-2xl font-extrabold">
                          {detailMoney(receipt.totals.grandTotal)}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">Total</div>
                      </div>
                      <div className="rounded-2xl border border-border p-5 text-center">
                        <div className="text-xl sm:text-2xl font-extrabold text-emerald-600">
                          {detailMoney(receipt.totals.totalPaid)}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">Pagado</div>
                      </div>
                      <div className="rounded-2xl border border-border p-5 text-center">
                        <div className="text-xl sm:text-2xl font-extrabold text-orange-600">
                          {detailMoney(receipt.totals.pendingAmount)}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">Saldo</div>
                      </div>
                    </div>

                    {/* Gate de cobranza — mismo bloque visual que la card
                        "Clave de recojo" de la tab Seguimiento, para que el
                        saldo pendiente bloquee la clave desde Pagos también
                        sin exponer el valor real en ningún texto. */}
                    {shippingGuide?.shippingKey && !isDebtFree && (
                      <div className="rounded-xl border border-[#F3D9A8] bg-[#FEF3E2] dark:border-amber-800 dark:bg-amber-950/30 p-[13px]">
                        <div className="flex items-center gap-[11px]">
                          <div className="h-9 w-9 rounded-lg grid place-items-center shrink-0 bg-white dark:bg-amber-900 text-[#B45309] dark:text-amber-300">
                            <Lock className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-extrabold text-[13.5px] text-[#92400E] dark:text-amber-400">
                              Clave de recojo bloqueada — hay saldo por cobrar
                            </div>
                            <div className="text-xs text-muted-foreground">
                              El cliente paga el saldo (S/
                              {receipt.totals.pendingAmount.toFixed(2)}) y recién se libera la
                              clave.
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="w-full mt-[11px] bg-[#B45309] hover:bg-[#92400E] text-white"
                          onClick={() => setPaymentModalOpen(true)}
                        >
                          <DollarSign className="h-4 w-4 mr-1.5" />
                          Registrar cobranza
                        </Button>
                      </div>
                    )}

                    <div className="rounded-2xl border border-border p-4">
                      <div className="text-sm font-bold mb-2.5">💳 Pagos registrados</div>
                      {receipt.payments.length === 0 && (
                        <div className="text-sm text-muted-foreground">
                          Sin pagos registrados
                        </div>
                      )}
                      {receipt.payments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between text-sm py-2 border-b last:border-0 border-dashed border-border"
                        >
                          <div>
                            <div className="font-medium">{p.paymentMethod}</div>
                            <div className="text-muted-foreground text-xs">
                              {new Date(p.paymentDate).toLocaleDateString("es-PE")}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">
                              {detailMoney(Number(p.amount))}
                            </div>
                            <div
                              className={
                                p.status === "PAID"
                                  ? "text-emerald-600 text-xs"
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
                      className="w-full text-sm h-11 rounded-xl"
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
      <AlertDialog open={printConfirmOpen} onOpenChange={(value) => { if (!value) setPrintConfirmation(null); }}>
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

      {lifecycleAction && open && <SaleUnitLifecycleModal open orderId={orderId} action={lifecycleAction} onClose={() => setLifecycleAction(null)} onUpdated={() => { void fetchReceipt(); onOrderUpdated?.(); }} />}
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
        onClose={() => {
          setPaymentModalOpen(false);
          if (isPendingPurchase) void fetchReceipt();
        }}
        orderId={orderId}
        orderNumber={receipt?.orderNumber || ""}
        onPaymentUpdated={() => {
          fetchReceipt();
          onOrderUpdated?.();
        }}
        canApprove={!isPendingPurchase}
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
