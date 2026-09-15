"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Package,
  Truck,
  User,
  Calendar,
  MapPin,
  Loader2,
  ExternalLink,
  MessageSquare,
  MessageCircle,
  Phone,
  ChevronDown,
  ChevronRight,
  DollarSign,
  ShoppingBag,
  Printer,
  FileText,
  Camera,
  ImageIcon,
  CheckCircle2,
  XCircle,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  Copy,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import axios from "axios";
import { toast } from "sonner";
import { paymentsHaveProof } from "@/app/centro-envios/components/shipmentUtils";
import { generateQR, generateBarcode } from "@/utils/printOrderLabel";
import { ZONE_LABELS } from "@/constants/operationsDomain";
import { printShippingGuide } from "@/utils/printShippingGuide";
import PaymentVerificationModal from "./PaymentVerificationModal";
import SendToShalomModal from "@/components/shalom/SendToShalomModal";
import SendToAliclikGuideModal from "@/components/aliclik/SendToAliclikGuideModal";
import SendToEvaGuideModal from "@/components/eva/SendToEvaGuideModal";
import EvaStatusBadge from "@/components/eva/EvaStatusBadge";
import { FileSpreadsheet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getShalomLabelPdfUrl,
  getShalomTicketPdfUrl,
} from "@/services/shalomService";
import { shouldDisplayNote } from "@/lib/logFilters";
import {
  normalizeCourier,
  isShalomCourier,
  isAliclikCourier,
  isEvaCourier,
} from "@/utils/courierNormalizer";

export interface ShippingGuide {
  id: string;
  guideNumber: string;
  storeId: string;
  courierId?: string | null;
  courierName?: string | null;
  courierPhone?: string | null;
  orderIds: string[];
  status:
    | "CREADA"
    | "APROBADA"
    | "ASIGNADA"
    | "EN_RUTA"
    | "ENTREGADA"
    | "PARCIAL"
    | "FALLIDA"
    | "CANCELADA";
  chargeType?: "PREPAGADO" | "CONTRA_ENTREGA" | "CORTESIA" | null;
  amountToCollect?: number | null;
  scheduledDate?: string | null;
  deliveryZones?: string[];
  deliveryType?: "MOTO" | "COURIER";
  deliveryAddress?: string | null;
  shippingKey?: string | null;
  shippingOffice?: string | null;
  shippingProofUrl?: string | null;
  notes?: string | null;
  trackingUrl?: string | null;
  externalCarrierId?: string | null;
  externalGuideReference?: string | null;
  shalomTrackingData?: any | null;
  quotedAmount?: number | null;
  quotedCurrency?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderDetail {
  id: string;
  orderId?: string;
  orderNumber: string;
  status: string;
  grandTotal: number;
  salesChannel?: string;
  customer: {
    fullName: string;
    phoneNumber: string;
    province?: string;
    city?: string;
    district?: string;
    address?: string;
    dni?: string | null;
  };
  payments: Array<{
    id?: string;
    amount: number;
    status: string;
  }>;
  items: Array<{
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    attributes?: Record<string, string>;
  }>;
  totals?: {
    grandTotal: number;
    totalPaid: number;
    pendingAmount: number;
  };

  // ✅ AGREGAR AMBAS VERSIONES (snake_case Y camelCase)
  externalTrackingNumber?: string | null;
  external_tracking_number?: string | null; // ⬅️ NUEVA

  shippingKey?: string | null;
  shipping_key?: string | null; // ⬅️ NUEVA

  trackingUrl?: string | null;
  tracking_url?: string | null; // ⬅️ NUEVA

  shippingOffice?: string | null;
  shipping_office?: string | null; // ⬅️ NUEVA

  shippingCode?: string | null;
  shipping_code?: string | null; // ⬅️ NUEVA

  shippingProofUrl?: string | null;
  shipping_proof_url?: string | null; // ⬅️ NUEVA

  carrierShippingCost?: number | null;
  carrier_shipping_cost?: number | null; // ⬅️ NUEVA

  shalomStatus?: string | null;
  shalom_status?: string | null; // ⬅️ NUEVA

  shalomError?: string | null;
  shalom_error?: string | null; // ⬅️ NUEVA

  aliclikDispatchStatus?: string | null;
  aliclik_dispatch_status?: string | null; // ⬅️ NUEVA

  evaStatus?: string | null;
  evaSyncedAt?: string | null;
  evaTrackingId?: string | null;

  trackingInfo?: {
    orderNumber: string;
    orderCode: string;
  };
}

interface GuideDetailsModalProps {
  open: boolean;
  onClose: () => void;
  orderId?: string; // Ahora opcional
  guideId?: string; // Nuevo prop
  defaultCourier?: string | null;
  onGuideUpdated?: () => void;
  isCourierView?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  CREADA: "bg-gray-100 text-gray-800",
  APROBADA: "bg-teal-100 text-teal-800",
  ASIGNADA: "bg-blue-100 text-blue-800",
  EN_RUTA: "bg-amber-100 text-amber-800",
  ENTREGADA: "bg-green-100 text-green-800",
  PARCIAL: "bg-orange-100 text-orange-800",
  FALLIDA: "bg-red-100 text-red-800",
  CANCELADA: "bg-red-100 text-red-800",
};


const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "bg-gray-100 text-gray-800",
  PREPARADO: "bg-yellow-100 text-yellow-800",
  LLAMADO: "bg-blue-100 text-blue-800",
  ASIGNADO_A_GUIA: "bg-purple-100 text-purple-800",
  EN_ENVIO: "bg-amber-100 text-amber-800",
  ENTREGADO: "bg-green-100 text-green-800",
  ANULADO: "bg-red-100 text-red-800",
};

const SHALOM_STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "bg-blue-100 text-blue-800 border-blue-200",
  EN_ENVIO: "bg-amber-100 text-amber-800 border-amber-200",
  ENTREGADO: "bg-green-100 text-green-800 border-green-200",
  EXITOSO: "bg-green-100 text-green-800 border-green-200",
  FALLIDO: "bg-red-100 text-red-800 border-red-200",
};

const CHARGE_TYPE_LABELS: Record<string, string> = {
  PREPAGADO: "Prepagado",
  CONTRA_ENTREGA: "Contra entrega",
  CORTESIA: "Cortesía",
};

const COURIERS = [
  "Motorizado Propio",
  "Shalom",
  "Aliclik",
  "EVA",
  "Olva Courier",
  "Marvisur",
  "Flores",
];

export default function GuideDetailsModal({
  open,
  onClose,
  orderId,
  guideId,
  defaultCourier,
  onGuideUpdated,
  isCourierView = false,
}: GuideDetailsModalProps) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;

  // Shalom modal
  const [shalomModalOpen, setShalomModalOpen] = useState(false);
  // Aliclik modal
  const [aliclikModalOpen, setAliclikModalOpen] = useState(false);
  // EVA modal
  const [evaModalOpen, setEvaModalOpen] = useState(false);

  const [guide, setGuide] = useState<ShippingGuide | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState("");
  const [ordersDetails, setOrdersDetails] = useState<OrderDetail[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState<{
    id: string;
    number: string;
  } | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set(),
  );

  // Estado para tracking por pedido (key = orderId)
  const [orderTrackingFields, setOrderTrackingFields] = useState<
    Record<
      string,
      {
        externalTrackingNumber: string;
        shippingKey: string;
        trackingUrl: string;
        shippingOffice: string;
        shippingCode: string;
      }
    >
  >({});
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  // Upload de foto de entrega
  const [uploadingOrderId, setUploadingOrderId] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  // El endpoint /receipt (usado para ordersDetails) no trae paymentProofUrl,
  // así que se consulta aparte order-header/:id (mismo endpoint que ya usa
  // PaymentVerificationModal) solo para saber si hay comprobante cargado.
  const [orderHasProof, setOrderHasProof] = useState<Record<string, boolean>>({});

  const toggleKeyReveal = (orderId: string) => {
    setRevealedKeys((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const fetchGuide = useCallback(async () => {
    setLoading(true);
    try {
      let url = "";
      if (guideId) {
        url = `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guideId}`;
      } else if (orderId) {
        url = `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/order/${orderId}`;
      } else {
        return;
      }

      const res = await axios.get<ShippingGuide | null>(url);
      setGuide(res.data);

      if (res.data?.courierName) {
        setSelectedCourier(normalizeCourier(res.data.courierName) || "");
      } else if (defaultCourier) {
        setSelectedCourier(normalizeCourier(defaultCourier) || "");
      }

      // Fetch order details for all orders in the guide using /receipt endpoint
      if (res.data?.orderIds?.length) {
        const ordersPromises = res.data.orderIds.map((id) =>
          axios.get<OrderDetail>(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${id}/receipt`,
          ),
        );
        const ordersResponses = await Promise.all(ordersPromises);
        const orders = ordersResponses.map((r) => ({
          ...r.data,
          id: r.data.id || r.data.orderId || "",
        }));
        setOrdersDetails(orders);

        // Inicializar tracking fields por cada pedido
        const trackingByOrder: Record<string, any> = {};
        orders.forEach((order) => {
          trackingByOrder[order.id] = {
            externalTrackingNumber: order.externalTrackingNumber || "",
            shippingKey: order.shippingKey || "",
            trackingUrl: order.trackingUrl || "",
            shippingOffice: order.shippingOffice || "",
            shippingCode: order.shippingCode || "",
          };
        });
        setOrderTrackingFields(trackingByOrder);

        // /receipt no trae paymentProofUrl — se consulta order-header/:id
        // (completo) en paralelo solo para eso, igual que hace
        // PaymentVerificationModal. Un fallo puntual no bloquea el resto.
        const proofResults = await Promise.all(
          res.data.orderIds.map((id) =>
            axios
              .get(`${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${id}`)
              .then((r) => paymentsHaveProof(r.data?.payments))
              .catch(() => false),
          ),
        );
        const proofByOrder: Record<string, boolean> = {};
        res.data.orderIds.forEach((id, i) => {
          proofByOrder[id] = proofResults[i];
        });
        setOrderHasProof(proofByOrder);
      }
    } catch (error) {
      console.error("Error fetching guide:", error);
      toast.error("No se pudo cargar la información de la guía");
    } finally {
      setLoading(false);
    }
  }, [guideId, orderId, defaultCourier]);

  useEffect(() => {
    if (open && (orderId || guideId)) {
      fetchGuide();
    }
  }, [open, orderId, guideId, fetchGuide]);

  // Guardar tracking de un pedido individual
  const handleSaveOrderTracking = async (orderId: string) => {
    const trackingData = orderTrackingFields[orderId];
    if (!trackingData) return;
    // Defensa en profundidad: aunque los inputs ya están disabled sin
    // comprobante, no se dispara el PATCH si de algún modo se llama igual.
    if (!orderHasProof[orderId]) return;

    setSavingOrderId(orderId);
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        {
          externalTrackingNumber: trackingData.externalTrackingNumber || null,
          shippingKey: trackingData.shippingKey || null,
          trackingUrl: trackingData.trackingUrl || null,
          shippingOffice: trackingData.shippingOffice || null,
          shippingCode: trackingData.shippingCode || null,
        },
      );
      toast.success("Datos de tracking guardados");
      onGuideUpdated?.();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Error al guardar tracking",
      );
    } finally {
      setSavingOrderId(null);
    }
  };

  // Actualizar campo de tracking para un pedido
  const updateOrderTrackingField = (
    orderId: string,
    field: keyof (typeof orderTrackingFields)[string],
    value: string,
  ) => {
    setOrderTrackingFields((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value,
      },
    }));
  };

  const openDocument = (url: string) => {
    window.open(url, "_blank");
  };

  const handleAssignCourier = async () => {
    if (!guide || !selectedCourier) return;

    setAssigning(true);
    try {
      // Solo asignar courier a la guía, NO cambiar estado de órdenes
      // El estado de las órdenes cambiará cuando se APRUEBE la guía
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guide.id}/assign-courier`,
        {
          courierId: null,
          courierName: selectedCourier,
        },
      );

      toast.success(`Courier ${selectedCourier} asignado a la guía`);
      fetchGuide();
      onGuideUpdated?.();
    } catch (error: any) {
      const message =
        error?.response?.data?.message || "Error asignando courier";
      toast.error(message);
    } finally {
      setAssigning(false);
    }
  };

  // Aprobar guía (cambiar status de CREADA a APROBADA) y pasar órdenes a EN_ENVIO
  const handleApproveGuide = async () => {
    if (!guide) return;

    // Verificar que hay courier realmente asignado (no solo seleccionado)
    if (!guide.courierName) {
      toast.error("Debes asignar un courier antes de aprobar la guía");
      return;
    }

    setAssigning(true);
    try {
      // 1. Aprobar la guía
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guide.id}`,
        {
          status: "APROBADA",
          courierName: normalizeCourier(guide.courierName), // ✅ Normalizar antes de guardar
        },
      );

      // 2. Cambiar estado de todas las órdenes a EN_ENVIO
      for (const orderId of guide.orderIds) {
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
          {
            status: "EN_ENVIO",
            courier: guide.courierName,
          },
        );
      }

      toast.success(
        `Guía aprobada y ${guide.orderIds.length} pedido(s) despachados`,
      );
      fetchGuide();
      onGuideUpdated?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Error al aprobar guía");
    } finally {
      setAssigning(false);
    }
  };

  // Subir foto de prueba de entrega por pedido
  const handleUploadOrderProof = async (
    orderId: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imágenes");
      return;
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no debe superar 5MB");
      return;
    }

    setUploadingOrderId(orderId);
    try {
      // 1. Subir imagen a ms-courier (Cloudinary)
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await axios.post<{ url: string }>(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/upload-proof`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );

      const proofUrl = uploadRes.data.url;

      // 2. Actualizar pedido en ms-ventas
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        {
          shippingProofUrl: proofUrl,
        },
      );

      toast.success("Prueba de entrega subida correctamente");
      fetchGuide(); // Recargar datos para mostrar la imagen/link
      onGuideUpdated?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Error al subir la prueba");
    } finally {
      setUploadingOrderId(null);
      e.target.value = "";
    }
  };

  // Desvincular un pedido de la guía
  const handleRemoveOrder = async (orderId: string) => {
    if (!guide) return;

    if (confirm("¿Estás seguro de desvincular este pedido de la guía?")) {
      try {
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guide.id}/orders/remove`,
          { orderIds: [orderId] },
        );

        toast.success("Pedido desvinculado correctamente");
        fetchGuide();
        onGuideUpdated?.();
      } catch (error: unknown) {
        const axiosError = error as { response?: { data?: { message?: string } } };
        toast.error(
          axiosError?.response?.data?.message || "Error al desvincular pedido",
        );
      }
    }
  };

  const handleClose = () => {
    setGuide(null);
    setSelectedCourier("");
    setOrdersDetails([]);
    setExpandedOrders(new Set());
    setSelectedOrderIds(new Set());
    setOrderTrackingFields({});
    onClose();
    // No reseteamos el guideId u orderId aquí porque vienen de props,
    // pero si el modal se cierra, el padre debería limpiar esos estados si es necesario.
  };

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleWhatsApp = (
    phoneNumber: string,
    orderNumber?: string,
    clientName?: string,
    pendingPayment?: number,
  ) => {
    const phone = phoneNumber.replace(/\D/g, "");
    const cleanPhone = phone.startsWith("51") ? phone : `51${phone}`;

    let message = `Hola${clientName ? ` ${clientName}` : ""}! `;
    if (orderNumber) {
      const trackingUrl = `${process.env.NEXT_PUBLIC_LANDING_URL}/rastreo/${orderNumber}`;
      message += `Te contactamos por tu pedido ${orderNumber}.\n\nPuedes rastrear tu pedido aquí: ${trackingUrl}`;
    }

    if (pendingPayment && pendingPayment > 0) {
      message += `\n\n📌 Tienes un saldo pendiente de: S/ ${pendingPayment.toFixed(2)}`;
    }

    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
  };

  const handleBulkWhatsApp = () => {
    const selectedOrders = ordersDetails.filter((o) =>
      selectedOrderIds.has(o.id),
    );

    if (selectedOrders.length === 0) {
      toast.warning("No hay pedidos seleccionados para enviar WhatsApp");
      return;
    }

    if (selectedOrders.length > 5) {
      toast.info(
        `Se abrirán ${selectedOrders.length} ventanas de WhatsApp. Asegúrate de permitir las ventanas emergentes (pop-ups).`,
      );
    } else {
      toast.success(
        `Preparando envío múltiple a ${selectedOrders.length} clientes...`,
      );
    }

    selectedOrders.forEach((order, index) => {
      setTimeout(() => {
        const paid =
          order.payments
            ?.filter((p) => p.status === "PAID")
            .reduce((s, p) => s + Number(p.amount), 0) || 0;
        const pending = Math.max(
          Number(order.totals?.grandTotal ?? order.grandTotal ?? 0) - paid,
          0,
        );

        handleWhatsApp(
          order.customer.phoneNumber,
          order.orderNumber,
          order.customer.fullName,
          pending,
        );
      }, index * 600);
    });
  };

  const handleCopySelected = () => {
    const selectedOrders = ordersDetails.filter((o) =>
      selectedOrderIds.has(o.id),
    );
    if (selectedOrders.length === 0) {
      toast.warning("No hay pedidos seleccionados para copiar");
      return;
    }
    const text = selectedOrders
      .map((order) => {
        const paid =
          order.payments
            ?.filter((p) => p.status === "PAID")
            .reduce((s, p) => s + Number(p.amount), 0) || 0;
        const total = Number(order.totals?.grandTotal ?? order.grandTotal ?? 0);
        const pending = Math.max(total - paid, 0);
        return `Venta ${order.orderNumber}\nCliente: ${order.customer.fullName}\nTeléfono: ${order.customer.phoneNumber}\nDistrito: ${order.customer.district || "-"}\nDirección: ${order.customer.address || "-"}\nTotal: S/ ${total.toFixed(2)}\nAdelanto: S/ ${paid.toFixed(2)}\nPor Cobrar: S/ ${pending.toFixed(2)}\nEstado: ${order.status.replace("_", " ")}`;
      })
      .join("\n\n--------------------\n\n");
    navigator.clipboard.writeText(text);
    toast.success(`${selectedOrders.length} pedido(s) copiados`);
  };

  // Calcular totales
  const cobranzaStats = ordersDetails.reduce(
    (acc, order) => {
      const paid =
        order.payments
          ?.filter((p) => p.status === "PAID")
          .reduce((s, p) => s + Number(p.amount), 0) || 0;
      const pendingApproval =
        order.payments
          ?.filter((p) => p.status === "PENDING_APPROVAL")
          .reduce((s, p) => s + Number(p.amount), 0) || 0;
      const totalPending =
        Number(order.totals?.grandTotal ?? order.grandTotal ?? 0) -
        paid -
        pendingApproval;

      return {
        totalPending: acc.totalPending + Math.max(totalPending, 0),
        pendingApproval: acc.pendingApproval + pendingApproval,
      };
    },
    { totalPending: 0, pendingApproval: 0 },
  );

  const totalCobranza =
    cobranzaStats.totalPending + cobranzaStats.pendingApproval;

  const handleExportExcel = async () => {
    if (!guide) {
      toast.warning("No hay datos para exportar");
      return;
    }

    if (ordersDetails.length === 0) {
      toast.error("No hay pedidos cargados para exportar");
      return;
    }

    const guideNumber = guide.guideNumber;
    const courierName = guide.courierName || "-";
    const fecha = guide.created_at
      ? format(new Date(guide.created_at), "dd/MM/yyyy")
      : format(new Date(), "dd/MM/yyyy");

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Despacho");

    const DARK_NAVY = "FF1B2A3B";
    const HEADER_FONT: any = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 10,
    };
    const TITLE_FONT: any = {
      bold: true,
      size: 13,
      color: { argb: "FF1B2A3B" },
    };
    const META_LABEL_FONT: any = {
      bold: true,
      size: 10,
      color: { argb: "FF555555" },
    };
    const THIN_BORDER: any = {
      top: { style: "thin", color: { argb: "FFDDDDDD" } },
      left: { style: "thin", color: { argb: "FFDDDDDD" } },
      bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
      right: { style: "thin", color: { argb: "FFDDDDDD" } },
    };

    const COLUMNS = [
      { header: "Nro Orden Powip", width: 18 },
      { header: "Nro Orden Canal", width: 18 },
      { header: "Nombre Cliente", width: 24 },
      { header: "Teléfono", width: 14 },
      { header: "Departamento", width: 16 },
      { header: "Provincia", width: 16 },
      { header: "Ciudad/Distrito", width: 18 },
      { header: "Dirección", width: 30 },
      { header: "Cant. Productos", width: 16 },
      { header: "Productos", width: 40 },
      { header: "Monto Total", width: 14 },
      { header: "Adelanto", width: 14 },
      { header: "Saldo a Pagar", width: 14 },
    ];
    const numCols = COLUMNS.length;

    // Fila 1: Título
    ws.addRow([`HOJA DE DESPACHO — ${guideNumber}`]);
    ws.mergeCells(1, 1, 1, numCols);
    const titleCell = ws.getCell("A1");
    titleCell.font = TITLE_FONT;
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 28;

    // Fila 2: Courier
    ws.addRow(["Courier:", courierName]);
    ws.getCell("A2").font = META_LABEL_FONT;

    // Fila 3: Fecha
    ws.addRow(["Fecha:", fecha]);
    ws.getCell("A3").font = META_LABEL_FONT;

    // Fila 4: vacía
    ws.addRow([]);

    // Fila 5: Headers con dark navy
    const headerRow = ws.addRow(COLUMNS.map((c) => c.header));
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: DARK_NAVY },
      };
      cell.font = HEADER_FONT;
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = THIN_BORDER;
    });

    // Filas de datos
    ordersDetails.forEach((order: OrderDetail) => {
      // /receipt endpoint retorna el total bajo totals.grandTotal
      const grandTotal = Number(
        order.totals?.grandTotal ?? order.grandTotal ?? 0,
      );
      const adelanto =
        order.payments
          ?.filter((p) => p.status === "PAID")
          .reduce((s, p) => s + Number(p.amount), 0) ?? 0;
      const saldo = Math.max(grandTotal - adelanto, 0);

      const productosStr = (order.items ?? [])
        .map((item) => {
          const attrs = item.attributes
            ? Object.values(item.attributes).filter(Boolean).join("/")
            : "";
          return `${item.productName}${attrs ? ` (${attrs})` : ""} x${item.quantity}`;
        })
        .join(" | ");

      const cantProductos = (order.items ?? []).reduce(
        (sum, i) => sum + i.quantity,
        0,
      );

      const dataRow = ws.addRow([
        order.orderNumber,
        order.externalTrackingNumber || "",
        order.customer.fullName,
        order.customer.phoneNumber,
        order.customer.province || "-",
        order.customer.city || "-",
        order.customer.district || "-",
        order.customer.address || "-",
        cantProductos,
        productosStr,
        grandTotal,
        adelanto,
        saldo,
      ]);

      dataRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: "middle", wrapText: false };
      });
    });

    // Ajustar ancho de columnas
    COLUMNS.forEach((col, i) => {
      ws.getColumn(i + 1).width = col.width;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Guia_${guideNumber}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success("Excel exportado correctamente");
  };

  // Imprimir guía de salida — documento de despacho A4 para el courier,
  // distinto de "Imprimir etiqueta de envío" (rótulo por paquete). Plantilla
  // extraída a printShippingGuide() para poder invocarla también desde el
  // modal de éxito de "Enviar a Shalom" (SendToShalomModal.tsx) sin duplicar
  // la plantilla HTML/CSS.
  const handlePrintGuide = () => {
    if (!guide) return;
    printShippingGuide(guide, ordersDetails, auth?.company);
  };

  // Imprimir etiquetas de envío (una ventana, múltiples páginas) — mismo QR
  // (link público de rastreo) y código de barras Code128 que ya usa la
  // etiqueta de Ventas/Atención al Cliente, reutilizando esas dos funciones
  // en vez de reimplementar la generación (ver printOrderLabel.ts).
  const handlePrintShippingLabels = async () => {
    if (ordersDetails.length === 0) {
      toast.warning("No hay pedidos para imprimir");
      return;
    }

    // Abrir la ventana ANTES de cualquier `await`: la mayoría de navegadores
    // solo permite `window.open` como respuesta directa y síncrona al click
    // del usuario — si se abre después de esperar el QR (asíncrono), el
    // bloqueador de pop-ups lo descarta en silencio y devuelve null. Se
    // completa el contenido de esta misma ventana ya abierta más abajo.
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error(
        "No se pudo abrir la ventana de impresión — revisa el bloqueador de pop-ups del navegador",
      );
      return;
    }
    printWindow.document.write(
      "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Generando etiquetas…</title></head><body>Generando etiquetas…</body></html>",
    );

    const company = auth?.company;
    const companyName = company?.name || "MI EMPRESA";
    const companyCuit = company?.cuit || "";
    const companyAddress = company?.billingAddress || "";
    const companyPhone = company?.phone || "";
    const companyInitial = companyName.trim().charAt(0).toUpperCase() || "?";
    const courierName = guide?.courierName || "COURIER";

    // Subtítulo del courier derivado de las zonas reales de la guía
    // (deliveryZones) — no hay un campo de "tipo de entrega" por pedido, así
    // que se omite si la guía no tiene zonas cargadas en vez de inventarlo.
    const zones = guide?.deliveryZones ?? [];
    const courierSubtitle = zones.includes("PROVINCIAS")
      ? "Entrega a provincia"
      : zones.length > 0
        ? "Entrega en Lima"
        : "";
    const zonaLabel =
      zones.length > 0 ? (ZONE_LABELS[zones[0]] ?? zones[0]) : "-";

    const labelsData = await Promise.all(
      ordersDetails.map(async (order) => {
        const trackingUrl = `${process.env.NEXT_PUBLIC_LANDING_URL}/rastreo/${order.orderNumber}`;
        // Fuente en mayor resolución (200px) que el tamaño mostrado en la
        // etiqueta (~92px): al imprimir, un QR generado más grande y luego
        // achicado por CSS escanea mejor que uno nativo pequeño. El código
        // de barras suma zona de silencio (margin) y más alto/ancho — sin
        // esa zona en blanco alrededor, un lector puede no reconocerlo.
        const [qrDataUrl, barcodeDataUrl] = await Promise.all([
          generateQR(trackingUrl, 200),
          Promise.resolve(
            generateBarcode(order.orderNumber, {
              width: 2.4,
              height: 55,
              fontSize: 13,
              margin: 10,
            }),
          ),
        ]);
        return { order, qrDataUrl, barcodeDataUrl };
      }),
    );

    // Generar HTML de todas las etiquetas
    const labelsHtml = labelsData
      .map(({ order, qrDataUrl, barcodeDataUrl }, index) => {
        const isLast = index === labelsData.length - 1;
        const customerAddress = order.shippingOffice
          ? `${courierName} ${order.shippingOffice}`
          : order.customer.address || "-";
        const itemsCount = order.items?.length ?? 0;

        return `
          <div class="label-page" style="${isLast ? "" : "page-break-after: always;"}">
            <div class="label-card">
              <div class="lc-header">
                <div class="lc-brand">
                  <div class="lc-logo">${
                    company?.logoUrl
                      ? `<img src="${company.logoUrl}" alt="Logo">`
                      : companyInitial
                  }</div>
                  <div>
                    <div class="lc-company-name">${companyName}</div>
                    <div class="lc-company-meta">${[
                      companyCuit ? `RUC ${companyCuit}` : "",
                      companyAddress,
                      companyPhone,
                    ]
                      .filter(Boolean)
                      .join(" · ")}</div>
                  </div>
                </div>
                <div class="lc-remite">REMITE</div>
              </div>

              <div class="lc-row lc-two-col">
                <div class="lc-col">
                  <div class="lc-label">Courier</div>
                  <div class="lc-value">${courierName}</div>
                  ${courierSubtitle ? `<div class="lc-sub">${courierSubtitle}</div>` : ""}
                </div>
                <div class="lc-col lc-col-border">
                  <div class="lc-label">Zona</div>
                  <div class="lc-value">${zonaLabel}</div>
                  ${order.customer.district ? `<div class="lc-sub">${order.customer.district}</div>` : ""}
                </div>
              </div>

              <div class="lc-row">
                <div class="lc-label">Destinatario</div>
                <div class="lc-dest-name">${order.customer.fullName}</div>
                <div class="lc-dest-fields">
                  <div><span class="lc-label">DNI</span><span class="lc-label" style="margin-left:32px">Teléfono</span></div>
                  <div class="lc-dest-values"><span>${order.customer.dni || "—"}</span><span>${order.customer.phoneNumber || "—"}</span></div>
                </div>
                <div class="lc-dest-location">${
                  [order.customer.province, order.customer.city, order.customer.district]
                    .filter(Boolean)
                    .join(" · ") || "-"
                }</div>
                <div class="lc-dest-address">${customerAddress}</div>
              </div>

              <div class="lc-row lc-order">
                ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" class="lc-qr">` : ""}
                <div class="lc-order-info">
                  <div class="lc-label">Pedido</div>
                  <div class="lc-order-number">${order.orderNumber}</div>
                  ${guide?.guideNumber ? `<div class="lc-guide">Guía ${guide.guideNumber}</div>` : ""}
                  <div class="lc-items">${itemsCount} ítem${itemsCount === 1 ? "" : "s"}</div>
                </div>
              </div>

              ${barcodeDataUrl ? `<div class="lc-barcode"><img src="${barcodeDataUrl}" alt="Código de barras"></div>` : ""}

              <div class="lc-footer">
                <span>◆ Generado por POWIP</span>
                <span>powip.lat/seguimiento</span>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Etiquetas de Envío — ${guide?.guideNumber || ""}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; color: #000; font-weight: 600; }
          .label-page { display: flex; justify-content: center; margin-bottom: 20px; }
          .label-card {
            width: 380px;
            border: 3px solid #000;
            border-radius: 22px;
            padding: 20px;
            background: #fff;
          }
          .lc-row { border-top: 1.5px solid #000; padding-top: 12px; margin-top: 12px; }
          .lc-header { display: flex; align-items: flex-start; justify-content: space-between; }
          .lc-brand { display: flex; align-items: center; gap: 12px; }
          .lc-logo {
            width: 40px; height: 40px; border: 2px solid #000; border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
            font-weight: 800; font-size: 16px; flex-shrink: 0; overflow: hidden;
          }
          .lc-logo img { width: 100%; height: 100%; object-fit: contain; }
          .lc-company-name { font-weight: 800; font-size: 15px; }
          .lc-company-meta { font-size: 10px; font-weight: 700; color: #222; margin-top: 3px; max-width: 240px; }
          .lc-remite { font-size: 10px; font-weight: 800; color: #333; letter-spacing: 0.04em; white-space: nowrap; }
          .lc-two-col { display: flex; }
          .lc-col { flex: 1; }
          .lc-col-border { border-left: 1.5px solid #000; padding-left: 16px; margin-left: 16px; }
          .lc-label { font-size: 10px; font-weight: 800; color: #333; text-transform: uppercase; letter-spacing: 0.04em; }
          .lc-value { font-size: 19px; font-weight: 800; margin-top: 2px; }
          .lc-sub { font-size: 11px; font-weight: 700; color: #222; margin-top: 2px; }
          .lc-dest-name { font-size: 25px; font-weight: 800; margin-top: 4px; }
          .lc-dest-fields { margin-top: 8px; }
          .lc-dest-fields > div { display: flex; }
          .lc-dest-fields > div > span:first-child { flex: 1; }
          .lc-dest-values { font-size: 15px; font-weight: 800; margin-top: 2px; }
          .lc-dest-location { font-size: 12px; font-weight: 700; margin-top: 8px; }
          .lc-dest-address { font-size: 12px; font-weight: 700; margin-top: 2px; }
          .lc-order { display: flex; align-items: center; gap: 16px; }
          .lc-qr { width: 92px; height: 92px; flex-shrink: 0; }
          .lc-order-info { flex: 1; min-width: 0; }
          .lc-order-number { font-size: 22px; font-weight: 800; letter-spacing: 0.02em; }
          .lc-guide { font-size: 12px; font-weight: 700; color: #222; margin-top: 2px; }
          .lc-items { font-size: 12px; font-weight: 800; margin-top: 2px; }
          .lc-barcode { border-top: 1.5px dashed #000; margin-top: 12px; padding-top: 10px; text-align: center; }
          .lc-barcode img { max-width: 100%; height: 58px; }
          .lc-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 10px; border-top: 1.5px solid #000; font-size: 10px; font-weight: 800; color: #222; }
          @media print {
            body { padding: 0; }
            .label-page { margin-bottom: 0; }
          }
        </style>
      </head>
      <body>
        ${labelsHtml}
      </body>
      </html>
    `;

    if (printWindow.closed) {
      toast.error("Se cerró la ventana de impresión antes de terminar");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    toast.success(`${ordersDetails.length} etiqueta(s) enviada(s) a imprimir`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Detalles de Guía
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : guide ? (
            <div className="space-y-4 py-4">
              {/* Header con número y estado */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{guide.guideNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    Creada:{" "}
                    {new Date(guide.created_at).toLocaleDateString("es-PE")}
                  </p>
                </div>
                <Badge className={STATUS_COLORS[guide.status]}>
                  {guide.status.replace("_", " ")}
                </Badge>
              </div>

              {/* Resumen de la guía en grilla */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted/30 rounded-lg">
                {/* Zona y Tipo */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Zona
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {guide.deliveryType && (
                      <Badge
                        className={
                          guide.deliveryType === "MOTO"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-orange-100 text-orange-800"
                        }
                      >
                        {guide.deliveryType === "MOTO" ? "🏍️" : "📦"}{" "}
                        {guide.deliveryType}
                      </Badge>
                    )}
                    {guide.deliveryZones?.map((zone) => (
                      <Badge key={zone} variant="outline" className="text-xs">
                        {ZONE_LABELS[zone] || zone}
                      </Badge>
                    ))}
                    {(!guide.deliveryZones ||
                      guide.deliveryZones.length === 0) &&
                      !guide.deliveryType &&
                      "-"}
                  </div>
                </div>

                {/* Fecha programada */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Fecha
                  </p>
                  <p className="font-medium">
                    {guide.scheduledDate
                      ? new Date(guide.scheduledDate).toLocaleDateString(
                          "es-PE",
                        )
                      : guide.created_at
                        ? new Date(guide.created_at).toLocaleDateString("es-PE")
                        : "-"}
                  </p>
                </div>

                {/* Total pedidos */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ShoppingBag className="h-3 w-3" /> Pedidos
                  </p>
                  <p className="font-medium">{guide.orderIds.length}</p>
                </div>

                {/* Cobranza total */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Cobranza Total
                  </p>
                  <p className="font-medium text-red-600">
                    S/{totalCobranza.toFixed(2)}
                  </p>
                </div>

                {/* Desglose de cobranza */}
                {cobranzaStats.totalPending > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      Pendiente Pago
                    </p>
                    <p className="font-medium text-amber-600">
                      S/{cobranzaStats.totalPending.toFixed(2)}
                    </p>
                  </div>
                )}

                {cobranzaStats.pendingApproval > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      Pend. Aprobación
                    </p>
                    <p className="font-medium text-blue-600">
                      S/{cobranzaStats.pendingApproval.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              {/* Cobro */}
              {guide.chargeType && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Tipo de cobro:</span>
                  <Badge variant="outline">
                    {CHARGE_TYPE_LABELS[guide.chargeType]}
                  </Badge>
                </div>
              )}

              {/* Courier asignado */}
              <div className="border rounded-lg p-3 space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Truck className="h-4 w-4" />
                  Courier / Repartidor
                </Label>
                {guide.courierName ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{guide.courierName}</p>
                        {guide.courierPhone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {guide.courierPhone}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-green-600 border-green-600"
                    >
                      Asignado
                    </Badge>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      className="flex-1 border rounded-md px-3 py-2 bg-background text-foreground"
                      value={selectedCourier}
                      onChange={(e) => setSelectedCourier(e.target.value)}
                    >
                      <option value="">Seleccionar courier...</option>
                      {COURIERS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={handleAssignCourier}
                      disabled={!selectedCourier || assigning}
                      size="sm"
                    >
                      {assigning ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Asignar"
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Lista de pedidos con detalles */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 border-b flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Pedidos ({ordersDetails.length})
                    {/* ✅ AGREGAR CONTADOR DE ESTADOS */}
                    {normalizeCourier(guide?.courierName) === "Shalom" && (
                      <div className="flex items-center gap-2 ml-4">
                        {(() => {
                          const registered = ordersDetails.filter(
                            (o) =>
                              o.shalomStatus === "PENDIENTE" ||
                              o.shalomStatus === "EXITOSO",
                          ).length;
                          const failed = ordersDetails.filter(
                            (o) => o.shalomStatus === "FALLIDO",
                          ).length;
                          const pending = ordersDetails.filter(
                            (o) => !o.shalomStatus,
                          ).length;

                          return (
                            <>
                              {registered > 0 && (
                                <Badge
                                  variant="outline"
                                  className="bg-green-50 text-green-700 border-green-200 text-xs"
                                >
                                  ✅ {registered} OK
                                </Badge>
                              )}
                              {failed > 0 && (
                                <Badge
                                  variant="outline"
                                  className="bg-red-50 text-red-700 border-red-200 text-xs"
                                >
                                  ❌ {failed} Fallidos
                                </Badge>
                              )}
                              {pending > 0 && (
                                <Badge
                                  variant="outline"
                                  className="bg-gray-50 text-gray-600 border-gray-300 text-xs"
                                >
                                  ⏳ {pending} Sin enviar
                                </Badge>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                    {isAliclikCourier(guide?.courierName) && (
                      <div className="flex items-center gap-2 ml-4">
                        {(() => {
                          const sent = ordersDetails.filter(
                            (o) =>
                              o.aliclikDispatchStatus &&
                              o.aliclikDispatchStatus !== "CANCELED",
                          ).length;
                          const cancelled = ordersDetails.filter(
                            (o) => o.aliclikDispatchStatus === "CANCELED",
                          ).length;
                          const pending = ordersDetails.filter(
                            (o) => !o.aliclikDispatchStatus,
                          ).length;

                          return (
                            <>
                              {sent > 0 && (
                                <Badge
                                  variant="outline"
                                  className="bg-green-50 text-green-700 border-green-200 text-xs"
                                >
                                  ✅ {sent} OK
                                </Badge>
                              )}
                              {cancelled > 0 && (
                                <Badge
                                  variant="outline"
                                  className="bg-red-50 text-red-700 border-red-200 text-xs"
                                >
                                  ❌ {cancelled} Cancelados
                                </Badge>
                              )}
                              {pending > 0 && (
                                <Badge
                                  variant="outline"
                                  className="bg-gray-50 text-gray-600 border-gray-300 text-xs"
                                >
                                  ⏳ {pending} Sin enviar
                                </Badge>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </h4>
                  <div className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 mr-2"
                      checked={
                        ordersDetails.length > 0 &&
                        selectedOrderIds.size === ordersDetails.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOrderIds(
                            new Set(ordersDetails.map((o) => o.id)),
                          );
                        } else {
                          setSelectedOrderIds(new Set());
                        }
                      }}
                    />
                    <span className="text-muted-foreground mr-2">
                      Seleccionar todos
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                      disabled={selectedOrderIds.size === 0}
                      onClick={handleBulkWhatsApp}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      WhatsApp Masivo ({selectedOrderIds.size})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selectedOrderIds.size === 0}
                      onClick={handleCopySelected}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar
                    </Button>
                  </div>
                </div>
                <div className="divide-y max-h-[300px] overflow-y-auto">
                  {ordersDetails.map((order, idx) => {
                    const isExpanded = expandedOrders.has(order.id);
                    const paid =
                      order.payments
                        ?.filter((p) => p.status === "PAID")
                        .reduce((s, p) => s + Number(p.amount), 0) || 0;
                    const pending = Math.max(
                      Number(
                        order.totals?.grandTotal ?? order.grandTotal ?? 0,
                      ) - paid,
                      0,
                    );

                    return (
                      <div key={`${order.id}-${idx}`} className="bg-background">
                        {/* Header del pedido */}
                        <div className="flex items-center justify-between px-3 py-2 hover:bg-muted/30">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedOrderIds.has(order.id)}
                              onChange={(e) => {
                                const newSelected = new Set(selectedOrderIds);
                                if (e.target.checked) newSelected.add(order.id);
                                else newSelected.delete(order.id);
                                setSelectedOrderIds(newSelected);
                              }}
                              className="h-4 w-4 rounded border-gray-300 mt-0.5"
                            />
                            <button
                              className="text-muted-foreground cursor-pointer"
                              onClick={() => toggleOrderExpand(order.id)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <div
                              className="cursor-pointer"
                              onClick={() => toggleOrderExpand(order.id)}
                            >
                              <p className="font-medium">{order.orderNumber}</p>
                              <p className="text-sm text-muted-foreground">
                                {order.customer.fullName} •{" "}
                                {order.customer.district || "-"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-medium">
                                S/
                                {Number(
                                  order.totals?.grandTotal ??
                                    order.grandTotal ??
                                    0,
                                ).toFixed(2)}
                              </p>
                              {pending > 0 && (
                                <p className="text-xs text-red-600">
                                  Cobrar: S/{pending.toFixed(2)}
                                </p>
                              )}
                              {Number(order.carrierShippingCost) > 0 && (
                                <p className="text-[10px] text-blue-600 font-medium">
                                  Envío: S/
                                  {Number(order.carrierShippingCost).toFixed(2)}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 text-green-600 border-green-200 hover:bg-green-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPaymentOrder({
                                    id: order.id,
                                    number: order.orderNumber,
                                  });
                                  setPaymentModalOpen(true);
                                }}
                                title="Gestión de Pagos"
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                              <Badge
                                className={
                                  ORDER_STATUS_COLORS[order.status] ||
                                  "bg-gray-100"
                                }
                              >
                                {order.status.replace("_", " ")}
                              </Badge>

                              {/* Estado Shalom - Badge mejorado */}
                              <div className="flex items-center gap-2">
                                {(() => {
                                  // 1. No enviado
                                  if (
                                    !order.externalTrackingNumber &&
                                    !order.shalomStatus
                                  ) {
                                    return (
                                      <Badge
                                        variant="outline"
                                        className="bg-gray-50 text-gray-600 border-gray-300 text-xs"
                                      >
                                        <div className="h-1.5 w-1.5 rounded-full bg-gray-400 mr-1.5" />
                                        Sin enviar
                                      </Badge>
                                    );
                                  }

                                  // 2. Fallido
                                  if (order.shalomStatus === "FALLIDO") {
                                    return (
                                      <Badge
                                        variant="outline"
                                        className="bg-red-50 text-red-700 border-red-200 text-xs"
                                        title={
                                          order.shalomError ||
                                          "Error al enviar a Shalom"
                                        }
                                      >
                                        <XCircle className="h-3 w-3 mr-1" />
                                        Falló Shalom
                                      </Badge>
                                    );
                                  }

                                  // 3. Exitoso/Pendiente
                                  if (
                                    order.shalomStatus === "PENDIENTE" ||
                                    order.shalomStatus === "EXITOSO"
                                  ) {
                                    return (
                                      <Badge
                                        variant="outline"
                                        className="bg-green-50 text-green-700 border-green-200 text-xs"
                                        title={`Nro. Guía: ${order.externalTrackingNumber || "-"}`}
                                      >
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Shalom OK{" "}
                                        {/* ⬅️ CAMBIAR de "Enviado" a "Shalom OK" */}
                                      </Badge>
                                    );
                                  }

                                  // 4. En proceso (ENTREGADO, EN_ENVIO, etc.)
                                  if (order.shalomStatus) {
                                    return (
                                      <Badge
                                        variant="outline"
                                        className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                                      >
                                        <div className="h-3 w-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mr-1" />
                                        {order.shalomStatus}
                                      </Badge>
                                    );
                                  }

                                  return null;
                                })()}
                              </div>

                              {/* Estado EVA */}
                              <div className="flex items-center gap-2">
                                <EvaStatusBadge
                                  evaStatus={order.evaStatus}
                                  evaSyncedAt={order.evaSyncedAt}
                                />
                                {order.evaTrackingId && (
                                  <span
                                    className="text-[10px] font-mono text-slate-500 dark:text-slate-400"
                                    title={`Tracking EVA: ${order.evaTrackingId}`}
                                  >
                                    {order.evaTrackingId}
                                  </span>
                                )}
                              </div>

                              {/* Botón Eliminar Pedido */}
                              {guide?.status !== "ENTREGADA" &&
                                guide?.status !== "CANCELADA" &&
                                !order.externalTrackingNumber && (
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50 ml-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveOrder(order.id);
                                    }}
                                    title="Desvincular pedido de esta guía"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              {order.shalomStatus === "FALLIDO" &&
                                isShalomCourier(guide?.courierName) && (
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedOrderIds(new Set([order.id]));
                                      setShalomModalOpen(true);
                                    }}
                                    title="Reintentar envío a Shalom"
                                  >
                                    <Truck className="h-4 w-4" />
                                  </Button>
                                )}
                            </div>
                          </div>
                        </div>

                        {/* Items del pedido (expandible) */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pl-10 space-y-2 bg-muted/20">
                            <p className="text-xs font-medium text-muted-foreground pt-2">
                              Items ({order.items?.length || 0}):
                            </p>
                            {order.items?.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex justify-between items-center text-sm bg-background rounded px-2 py-1.5"
                              >
                                <div className="flex-1">
                                  <p className="font-medium">
                                    {item.productName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.sku}
                                    {item.attributes &&
                                      Object.entries(item.attributes).map(
                                        ([k, v]) => ` • ${k}: ${v}`,
                                      )}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p>x{item.quantity}</p>
                                  <p className="text-muted-foreground">
                                    S/{Number(item.unitPrice).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            ))}
                            {/* Info cliente */}
                            <div className="text-xs text-muted-foreground pt-1 border-t">
                              <p>
                                <Phone className="h-3 w-3 inline mr-1" />
                                {order.customer.phoneNumber}
                              </p>
                              {order.customer.address && (
                                <p>
                                  <MapPin className="h-3 w-3 inline mr-1" />
                                  {order.customer.address}
                                </p>
                              )}
                            </div>

                            {/* Tracking del pedido */}
                            <div className="pt-2 border-t mt-2">
                              <p className="text-xs font-medium text-orange-700 mb-2 flex items-center gap-1">
                                📦 Datos de Tracking
                              </p>
                              {!orderHasProof[order.id] && (
                                <div className="mb-2 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                                  <Lock className="h-3 w-3 mt-0.5 shrink-0" />
                                  <span>
                                    Debes cargar el comprobante de pago antes
                                    de ingresar los datos de la guía.
                                  </span>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-xs text-muted-foreground">
                                    Nro. Guía Courier
                                  </label>
                                  <input
                                    type="text"
                                    className="w-full border rounded px-2 py-1 text-xs bg-background disabled:cursor-not-allowed disabled:opacity-60"
                                    placeholder="Ej: OLV-123456"
                                    value={
                                      orderTrackingFields[order.id]
                                        ?.externalTrackingNumber || ""
                                    }
                                    disabled={!orderHasProof[order.id]}
                                    title={
                                      orderHasProof[order.id]
                                        ? undefined
                                        : "Debes cargar el comprobante de pago antes de ingresar los datos de la guía"
                                    }
                                    onChange={(e) =>
                                      updateOrderTrackingField(
                                        order.id,
                                        "externalTrackingNumber",
                                        e.target.value,
                                      )
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-muted-foreground">
                                    Clave de Envío
                                  </label>
                                  <div className="relative">
                                    <input
                                      className={`w-full border rounded px-2 py-1 text-xs bg-background h-[34px] pr-8 disabled:cursor-not-allowed disabled:opacity-60 ${
                                        pending > 0
                                          ? "border-red-300 focus:border-red-500 bg-red-50/30 font-mono"
                                          : "focus:border-orange-500"
                                      }`}
                                      placeholder={
                                        pending > 0 && !revealedKeys[order.id]
                                          ? "Bloqueada"
                                          : "Ej: ABC123"
                                      }
                                      value={
                                        pending > 0 && !revealedKeys[order.id]
                                          ? ""
                                          : orderTrackingFields[order.id]
                                              ?.shippingKey || ""
                                      }
                                      disabled={!orderHasProof[order.id]}
                                      title={
                                        orderHasProof[order.id]
                                          ? undefined
                                          : "Debes cargar el comprobante de pago antes de ingresar los datos de la guía"
                                      }
                                      onChange={(e) =>
                                        updateOrderTrackingField(
                                          order.id,
                                          "shippingKey",
                                          e.target.value,
                                        )
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    {pending > 0 && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleKeyReveal(order.id);
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 focus:outline-none"
                                        title={
                                          revealedKeys[order.id]
                                            ? "Ocultar clave"
                                            : "Revelar clave"
                                        }
                                      >
                                        {revealedKeys[order.id] ? (
                                          <EyeOff className="h-3.5 w-3.5" />
                                        ) : (
                                          <Eye className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-muted-foreground">
                                    URL Tracking
                                  </label>
                                  <input
                                    type="text"
                                    className="w-full border rounded px-2 py-1 text-xs bg-background disabled:cursor-not-allowed disabled:opacity-60"
                                    placeholder="https://..."
                                    value={
                                      orderTrackingFields[order.id]
                                        ?.trackingUrl || ""
                                    }
                                    disabled={!orderHasProof[order.id]}
                                    title={
                                      orderHasProof[order.id]
                                        ? undefined
                                        : "Debes cargar el comprobante de pago antes de ingresar los datos de la guía"
                                    }
                                    onChange={(e) =>
                                      updateOrderTrackingField(
                                        order.id,
                                        "trackingUrl",
                                        e.target.value,
                                      )
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-muted-foreground">
                                    Oficina de Retiro
                                  </label>
                                  <input
                                    type="text"
                                    className="w-full border rounded px-2 py-1 text-xs bg-background disabled:cursor-not-allowed disabled:opacity-60"
                                    placeholder="Ej: Olva Lima Centro"
                                    value={
                                      orderTrackingFields[order.id]
                                        ?.shippingOffice || ""
                                    }
                                    disabled={!orderHasProof[order.id]}
                                    title={
                                      orderHasProof[order.id]
                                        ? undefined
                                        : "Debes cargar el comprobante de pago antes de ingresar los datos de la guía"
                                    }
                                    onChange={(e) =>
                                      updateOrderTrackingField(
                                        order.id,
                                        "shippingOffice",
                                        e.target.value,
                                      )
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs text-muted-foreground">
                                    Código
                                  </label>
                                  <input
                                    type="text"
                                    className="w-full border rounded px-2 py-1 text-xs bg-background disabled:cursor-not-allowed disabled:opacity-60"
                                    placeholder="Ej: COD-001"
                                    value={
                                      orderTrackingFields[order.id]
                                        ?.shippingCode || ""
                                    }
                                    disabled={!orderHasProof[order.id]}
                                    title={
                                      orderHasProof[order.id]
                                        ? undefined
                                        : "Debes cargar el comprobante de pago antes de ingresar los datos de la guía"
                                    }
                                    onChange={(e) =>
                                      updateOrderTrackingField(
                                        order.id,
                                        "shippingCode",
                                        e.target.value,
                                      )
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>

                              <Button
                                size="sm"
                                className="mt-2 w-full bg-orange-600 hover:bg-orange-700 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveOrderTracking(order.id);
                                }}
                                disabled={
                                  savingOrderId === order.id ||
                                  !orderHasProof[order.id]
                                }
                              >
                                {savingOrderId === order.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : null}
                                Guardar Tracking
                              </Button>
                            </div>

                            {/* Prueba de Entrega por Pedido */}
                            <div className="pt-2 border-t mt-2">
                              <p className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
                                <Camera className="h-3 w-3" /> Prueba de Entrega
                              </p>
                              {order.shippingProofUrl ? (
                                <div className="relative group w-fit">
                                  <Image
                                    src={order.shippingProofUrl}
                                    alt="Prueba"
                                    width={400}
                                    height={300}
                                    className="h-24 w-auto object-contain rounded border bg-muted"
                                  />
                                  <a
                                    href={order.shippingProofUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white rounded"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                  <div className="absolute top-1 right-1 bg-green-500 text-white p-0.5 rounded-full">
                                    <CheckCircle2 className="h-3 w-3" />
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  {isCourierView &&
                                  [
                                    "CREADA",
                                    "ASIGNADA",
                                    "APROBADA",
                                    "EN_RUTA",
                                    "ENTREGADA",
                                    "PARCIAL",
                                    "FALLIDA",
                                  ].includes(guide?.status || "") ? (
                                    <label className="inline-flex items-center gap-2 cursor-pointer bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs hover:bg-primary/90 transition-colors">
                                      {uploadingOrderId === order.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Camera className="h-3 w-3" />
                                      )}
                                      {uploadingOrderId === order.id
                                        ? "Subiendo..."
                                        : "Subir Foto"}
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) =>
                                          handleUploadOrderProof(order.id, e)
                                        }
                                        disabled={!!uploadingOrderId}
                                      />
                                    </label>
                                  ) : (
                                    <p className="text-xs text-muted-foreground italic flex items-center gap-1">
                                      <ImageIcon className="h-3 w-3" /> Sin
                                      prueba de entrega
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {ordersDetails.length === 0 && (
                    <div className="px-3 py-4 text-center text-muted-foreground text-sm">
                      No hay pedidos en esta guía
                    </div>
                  )}
                </div>
              </div>

              {/* Notas */}
              {guide.notes && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                    <MessageSquare className="h-4 w-4" /> Notas / Historial:
                  </p>
                  <div className="space-y-3 max-h-[150px] overflow-y-auto pr-2">
                    {(() => {
                      try {
                        const rawNotes = JSON.parse(guide.notes || "[]");
                        if (!Array.isArray(rawNotes)) {
                          return shouldDisplayNote(guide.notes) ? (
                            <p className="text-sm">{guide.notes}</p>
                          ) : null;
                        }

                        const notes = rawNotes.filter((n: any) =>
                          shouldDisplayNote(n.text),
                        );

                        if (notes.length === 0) {
                          return (
                            <p className="text-xs text-muted-foreground italic">
                              No hay notas relevantes para mostrar
                            </p>
                          );
                        }

                        return notes.map((note: any, idx: number) => (
                          <div
                            key={idx}
                            className="bg-muted/50 rounded-lg p-2 text-sm border border-muted"
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-xs text-primary">
                                {note.user}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {note.date
                                  ? format(
                                      new Date(note.date),
                                      "dd/MM/yy HH:mm",
                                      { locale: es },
                                    )
                                  : "-"}
                              </span>
                            </div>
                            <p className="text-sm leading-relaxed">
                              {note.text}
                            </p>
                          </div>
                        ));
                      } catch (e) {
                        return shouldDisplayNote(guide.notes) ? (
                          <p className="text-sm">{guide.notes}</p>
                        ) : null;
                      }
                    })()}
                  </div>
                </div>
              )}

              {/* Tracking URL */}
              {guide.trackingUrl && (
                <a
                  href={guide.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver tracking
                </a>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No se encontró información de la guía
            </div>
          )}

          <DialogFooter className="flex flex-col gap-2">
            {/* Texto informativo encima de todos los botones */}
            {guide &&
              (guide.status === "CREADA" || guide.status === "ASIGNADA") &&
              !guide.courierName && (
                <p className="text-sm text-amber-600 flex items-center gap-1 w-full justify-center">
                  ⚠️ Primero asigna un courier usando el botón
                  &quot;Asignar&quot; antes de aprobar la guía
                </p>
              )}

            {/* Botones en fila */}
            <div className="flex flex-wrap gap-2 justify-end w-full">
              {guide &&
                (guide.status === "CREADA" || guide.status === "ASIGNADA") && (
                  <Button
                    onClick={handleApproveGuide}
                    disabled={assigning || !guide.courierName}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    {assigning ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    ✓ Aprobar Guía
                  </Button>
                )}
              {guide &&
                guide.status === "APROBADA" &&
                normalizeCourier(guide.courierName) === "Shalom" &&
                (() => {
                  // ✅ Calcular cuántos pedidos necesitan envío
                  const needsShalom = ordersDetails.filter(
                    (o) =>
                      !o.shalomStatus || // Sin status
                      o.shalomStatus === "FALLIDO", // Fallidos
                  );

                  // ✅ Solo mostrar botón si hay pedidos pendientes
                  if (needsShalom.length === 0) return null;

                  return (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          // Si no hay seleccionados, seleccionar los que necesitan envío
                          if (selectedOrderIds.size === 0) {
                            setSelectedOrderIds(
                              new Set(needsShalom.map((o) => o.id)),
                            );
                          }
                          setShalomModalOpen(true);
                        }}
                        className={
                          selectedOrderIds.size > 0
                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-orange-500 hover:bg-orange-600 text-white"
                        }
                      >
                        <Truck className="h-4 w-4 mr-2" />
                        {selectedOrderIds.size > 0
                          ? `Enviar a Shalom (${selectedOrderIds.size})`
                          : `Registrar en Shalom (${needsShalom.length})`}
                      </Button>
                    </div>
                  );
                })()}
              {guide &&
                guide.status === "APROBADA" &&
                isAliclikCourier(guide.courierName) &&
                (() => {
                  const needsAliclik = ordersDetails.filter(
                    (o) => !o.aliclikDispatchStatus,
                  );

                  if (needsAliclik.length === 0) return null;

                  return (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          if (selectedOrderIds.size === 0) {
                            setSelectedOrderIds(
                              new Set(needsAliclik.map((o) => o.id)),
                            );
                          }
                          setAliclikModalOpen(true);
                        }}
                        className={
                          selectedOrderIds.size > 0
                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-orange-500 hover:bg-orange-600 text-white"
                        }
                      >
                        <Truck className="h-4 w-4 mr-2" />
                        {selectedOrderIds.size > 0
                          ? `Enviar a Aliclik (${selectedOrderIds.size})`
                          : `Registrar en Aliclik (${needsAliclik.length})`}
                      </Button>
                    </div>
                  );
                })()}
              {guide &&
                guide.status === "APROBADA" &&
                isEvaCourier(guide.courierName) &&
                (() => {
                  const needsEva = ordersDetails.filter((o) => !o.evaStatus);

                  if (needsEva.length === 0) return null;

                  return (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          if (selectedOrderIds.size === 0) {
                            setSelectedOrderIds(
                              new Set(needsEva.map((o) => o.id)),
                            );
                          }
                          setEvaModalOpen(true);
                        }}
                        className={
                          selectedOrderIds.size > 0
                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-orange-500 hover:bg-orange-600 text-white"
                        }
                      >
                        <Truck className="h-4 w-4 mr-2" />
                        {selectedOrderIds.size > 0
                          ? `Enviar a EVA (${selectedOrderIds.size})`
                          : `Registrar en EVA (${needsEva.length})`}
                      </Button>
                    </div>
                  );
                })()}
              {guide && (
                <>
                  <Button variant="outline" onClick={handleExportExcel}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
                  <Button variant="outline" onClick={handlePrintGuide}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir Guía
                  </Button>
                  <Button variant="outline" onClick={handlePrintShippingLabels}>
                    <FileText className="h-4 w-4 mr-2" />
                    Imprimir etiqueta de envío
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={handleClose}>
                Cerrar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Pago / Verificación */}
      <PaymentVerificationModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        orderId={selectedPaymentOrder?.id || ""}
        orderNumber={selectedPaymentOrder?.number || ""}
        onPaymentUpdated={() => {
          fetchGuide();
          onGuideUpdated?.();
        }}
        canApprove={true}
      />

      {/* Modal de Envío a Shalom */}
      <SendToShalomModal
        open={shalomModalOpen}
        guideId={guideId || guide?.id || ""}
        companyId={companyId || ""}
        guide={guide}
        onClose={() => setShalomModalOpen(false)}
        orders={
          selectedOrderIds.size > 0
            ? ordersDetails.filter((o) => selectedOrderIds.has(o.id))
            : ordersDetails
        }
        onSuccess={() => {
          fetchGuide();
          onGuideUpdated?.();
        }}
      />

      {/* Modal de Envío a Aliclik */}
      <SendToAliclikGuideModal
        open={aliclikModalOpen}
        guideId={guideId || guide?.id || ""}
        companyId={companyId || ""}
        orders={
          selectedOrderIds.size > 0
            ? ordersDetails.filter((o) => selectedOrderIds.has(o.id))
            : ordersDetails
        }
        onClose={() => setAliclikModalOpen(false)}
        onSuccess={() => {
          fetchGuide();
          onGuideUpdated?.();
        }}
      />

      {/* Modal de Envío a EVA */}
      <SendToEvaGuideModal
        open={evaModalOpen}
        guideId={guideId || guide?.id || ""}
        companyId={companyId || ""}
        orders={
          selectedOrderIds.size > 0
            ? ordersDetails.filter((o) => selectedOrderIds.has(o.id))
            : ordersDetails
        }
        onClose={() => setEvaModalOpen(false)}
        onSuccess={() => {
          fetchGuide();
          onGuideUpdated?.();
        }}
      />
    </>
  );
}
