"use client";
import axios from "axios";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { toast } from "sonner";
import {
  Phone,
  PhoneOff,
  MessageCircle,
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
} from "lucide-react";
import { Textarea } from "../ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
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
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useAuth } from "@/contexts/AuthContext";

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
}

interface OrderReceipt {
  orderId: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  salesChannel?: string;
  closingChannel?: string;
  callStatus?: string;
  callAttempts?: number;
  customer: {
    fullName: string;
    phoneNumber?: string;
    dni?: string;
    address?: string;
    district?: string;
    city?: string;
    province?: string;
    clientType?: string;
    reference?: string;
  };
  items: {
    productName: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    discountAmount: number;
    attributes?: Record<string, any>;
  }[];
  payments: {
    id: string;
    paymentMethod: string;
    amount: number;
    paymentDate: string;
    status: string;
  }[];
  totals: {
    productsTotal: number;
    taxTotal: number;
    shippingTotal: number;
    discountTotal: number;
    grandTotal: number;
    totalPaid: number;
    pendingAmount: number;
  };
  externalTrackingNumber?: string | null;
  shippingCode?: string | null;
  shippingKey?: string | null;
  shippingOffice?: string | null;
}

export default function CustomerServiceModal({
  open,
  orderId,
  onClose,
  onOrderUpdated,
  hideCallManagement = false,
  shippingGuide,
  showTracking = false,
}: Props) {
  const router = useRouter();
  const { auth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [addProductsModalOpen, setAddProductsModalOpen] = useState(false);

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

  const fetchLogs = async () => {
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
  };

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

  useEffect(() => {
    if (!open || !orderId) return;
    fetchReceipt();
    fetchLogs();
  }, [open, orderId]);

  const fetchReceipt = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}/receipt`,
      );
      setReceipt(res.data);

      const orderRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
      );
      setNotes(orderRes.data.notes || "");
    } catch (err) {
      console.error("Error fetching receipt", err);
      toast.error("Error al cargar el pedido");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCallStatus = async (
    callStatus: "CONFIRMED" | "NO_ANSWER",
  ) => {
    try {
      const payload: { callStatus: string; status?: string } = { callStatus };

      if (callStatus === "CONFIRMED") {
        payload.status = "LLAMADO";
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

  const handleSaveNotes = async () => {
    try {
      setSavingNotes(true);
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        { notes },
      );
      toast.error("Error al guardar las notas");
    } finally {
      setSavingNotes(false);
    }
  };

  const [savingTracking, setSavingTracking] = useState(false);
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

  const handlePrint = async () => {
    if (!receipt) return;

    const qrDataUrl = await generateQR(receipt.orderId);

    // Calcular adelanto y monto por cobrar
    const totalPaid = receipt.totals.totalPaid || 0;
    const pendingAmount = receipt.totals.pendingAmount || 0;

    // Crear ventana de impresión con contenido limpio
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) {
      toast.error("No se pudo abrir la ventana de impresión");
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Resumen de Venta - ${receipt.orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            font-size: 11px; 
            padding: 15px;
            max-width: 280px;
            margin: 0 auto;
          }
          .header { 
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 6px;
            padding-bottom: 8px;
            border-bottom: 1px dashed #333;
          }
          .qr-code { 
            width: 70px; 
            height: 70px; 
            flex-shrink: 0;
          }
          .header-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .order-title { 
            font-size: 14px; 
            font-weight: bold; 
            margin-bottom: 4px;
          }
          .order-total { 
            font-size: 16px; 
            font-weight: bold;
          }
          .section { margin-bottom: 10px; }
          .section-title { 
            font-weight: bold; 
            margin-bottom: 6px;
            font-size: 12px;
          }
          .info-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 4px 8px;
            font-size: 10px;
          }
          .info-item { line-height: 1.3; }
          .info-label { color: #666; }
          .info-value { font-weight: 500; }
          .products-table { 
            width: 100%;
            font-size: 9px;
            border-collapse: collapse;
            margin-bottom: 10px;
          }
          .products-table th {
            text-align: left;
            border-bottom: 1px solid #333;
            padding: 4px 2px;
            font-size: 8px;
          }
          .products-table td {
            padding: 3px 2px;
            border-bottom: 1px dotted #ddd;
            vertical-align: top;
          }
          .products-table .qty { width: 25px; text-align: center; }
          .products-table .price { text-align: right; white-space: nowrap; }
          .products-table .desc { font-size: 8px; color: #666; }
          .totals { 
            border-top: 1px dashed #333;
            padding-top: 8px;
          }
          .total-row { 
            display: flex; 
            justify-content: space-between;
            margin-bottom: 3px;
            font-size: 10px;
          }
          .total-row.main { 
            font-size: 14px; 
            font-weight: bold;
            border-top: 1px solid #333333ff;
            padding-top: 6px;
            margin-top: 6px;
          }
          .total-row.pending { 
            font-weight: bold;
            color: #333333ff;
          }
          .tracking-section {
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px dashed #333;
            font-size: 10px;
          }
          .tracking-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px;
          }
          .tracking-item { line-height: 1.2; }
          .tracking-label { color: #666; font-size: 8px; text-decoration: underline; }
          .tracking-value { font-weight: bold; display: block; }
          @media print {
            body { padding: 10px; }
            @page { margin: 5mm; size: 80mm auto; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" class="qr-code">` : ""}
          <div class="header-info">
            <div class="order-title">Orden # ${receipt.orderNumber}</div>
            <div class="order-total">Total: S/ ${receipt.totals.grandTotal.toFixed(2)}</div>
          </div>
        </div>

        <div class="section">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Nombre:</span>
              <span class="info-value">${receipt.customer.fullName}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Distrito:</span>
              <span class="info-value">${receipt.customer.district || "-"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Teléfono:</span>
              <span class="info-value">${receipt.customer.phoneNumber || "-"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Tipo:</span>
              <span class="info-value">${receipt.customer.clientType || "-"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Dirección:</span>
              <span class="info-value">${receipt.customer.address || "-"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Referencia:</span>
              <span class="info-value">${receipt.customer.reference || "-"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Departamento:</span>
              <span class="info-value">${receipt.customer.city || "-"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Canal:</span>
              <span class="info-value">${receipt.salesChannel || "-"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Provincia:</span>
              <span class="info-value">${receipt.customer.province || "-"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">DNI:</span>
              <span class="info-value">${receipt.customer.dni || "-"}</span>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Productos</div>
          <table class="products-table">
            <thead>
              <tr>
                <th class="qty">Qty</th>
                <th>Producto</th>
                <th class="price">Precio</th>
              </tr>
            </thead>
            <tbody>
              ${receipt.items
                .map((item: any) => {
                  const attrs = item.attributes
                    ? Object.entries(item.attributes)
                        .map(([k, v]) => `${v}`)
                        .join("/")
                    : "";
                  const discount = Number(item.discountAmount) || 0;
                  const subtotal = Number(item.subtotal);
                  return `
                  <tr>
                    <td class="qty">${item.quantity}</td>
                    <td>
                      ${item.productName}${attrs ? ` (${attrs})` : ""}
                      ${discount > 0 ? `<div class="desc">Dcto: -S/${discount.toFixed(2)}</div>` : ""}
                    </td>
                    <td class="price">S/${subtotal.toFixed(2)}</td>
                  </tr>
                `;
                })
                .join("")}
            </tbody>
          </table>
        </div>

        <div class="totals">
          <div class="total-row">
            <span>Productos:</span>
            <span>S/ ${receipt.totals.productsTotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>IGV 18%:</span>
            <span>S/ ${receipt.totals.taxTotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>Envío:</span>
            <span>S/ ${receipt.totals.shippingTotal.toFixed(2)}</span>
          </div>
          <div class="total-row main">
            <span>Total:</span>
            <span>S/ ${receipt.totals.grandTotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>Descuentos:</span>
            <span>S/ ${receipt.totals.discountTotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>Adelanto:</span>
            <span>S/ ${totalPaid.toFixed(2)}</span>
          </div>
            <span>Por Cobrar:</span>
            <span>S/ ${pendingAmount.toFixed(2)}</span>
          </div>
        </div>

        ${
          receipt.externalTrackingNumber ||
          receipt.shippingCode ||
          receipt.shippingKey ||
          receipt.shippingOffice
            ? `
        <div class="tracking-section">
          <div class="tracking-grid">
            ${
              receipt.externalTrackingNumber
                ? `
            <div class="tracking-item">
              <span class="tracking-label">Tracking:</span>
              <span class="tracking-value">${receipt.externalTrackingNumber}</span>
            </div>`
                : ""
            }
            ${
              receipt.shippingOffice
                ? `
            <div class="tracking-item">
              <span class="tracking-label">Oficina:</span>
              <span class="tracking-value">${receipt.shippingOffice}</span>
            </div>`
                : ""
            }
            ${
              receipt.shippingCode
                ? `
            <div class="tracking-item">
              <span class="tracking-label">Código:</span>
              <span class="tracking-value">${receipt.shippingCode}</span>
            </div>`
                : ""
            }
            ${
              receipt.shippingKey
                ? `
            <div class="tracking-item">
              <span class="tracking-label">Clave:</span>
              <span class="tracking-value">${
                pendingAmount > 0
                  ? '<span style="color:red; font-weight:bold;">CLAVE OCULTA (Pago Pendiente)</span>'
                  : receipt.shippingKey
              }</span>
            </div>`
                : ""
            }
          </div>
        </div>
        `
            : ""
        }
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    // Esperar a que cargue el contenido y el QR antes de imprimir
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();

      // Si el pedido está en PENDIENTE, mostrar confirmación para pasar a PREPARADO
      if (receipt.status === "PENDIENTE") {
        setPrintConfirmOpen(true);
      }
    };
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

          <!-- Footer con info de orden -->
          <div class="order-footer">
            Orden #${receipt.orderNumber} | Total: S/ ${receipt.totals.grandTotal.toFixed(2)}
            ${Number(shippingGuide.amountToCollect) > 0 ? ` | <strong>COBRAR: S/ ${Number(shippingGuide.amountToCollect).toFixed(2)}</strong>` : ""}
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

  const isConfirmed = receipt?.status === "LLAMADO";

  if (!receipt && !loading) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">Cargando...</div>
          ) : (
            receipt && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ================================== */}
                {/* SECCIÓN IZQUIERDA */}
                {/* ================================== */}
                <div className="space-y-4">
                  {/* Header: N° Orden y Total */}
                  <div className="border-b pb-4">
                    <h2 className="text-2xl font-bold">
                      N° de Orden # {receipt.orderNumber}
                    </h2>
                    <p className="text-2xl font-bold text-primary">
                      Total: S/{receipt.totals.grandTotal.toFixed(2)}
                    </p>
                  </div>

                  {/* Productos */}
                  <div className="border border-border rounded-lg p-4">
                    <h3 className="font-semibold mb-3 text-lg">Productos</h3>
                    <div className="space-y-3 max-h-[250px] overflow-y-auto">
                      {receipt.items.map((item, i) => (
                        <div
                          key={i}
                          className="border border-border rounded-md p-3 bg-muted"
                        >
                          <p className="font-medium text-base">
                            {item.productName}
                          </p>
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
                <div className="space-y-4">
                  {/* Cliente */}
                  <div className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-lg">Cliente</h3>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900"
                          onClick={handleWhatsApp}
                          title="WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
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
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
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
                        <div className="mt-4 pt-4 border-t border-dashed border-muted-foreground/30">
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
                              {receipt.totals.pendingAmount > 0 ? (
                                <div className="flex items-center gap-2 px-2 py-1 border rounded bg-red-50 text-red-600 text-xs h-8">
                                  <Lock className="h-3 w-3 flex-shrink-0" />
                                  <span
                                    className="font-medium truncate"
                                    title="Pago Pendiente - Clave oculta"
                                  >
                                    Oculta
                                  </span>
                                </div>
                              ) : (
                                <Input
                                  className="h-8 text-xs"
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
                              )}
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
                          <div className="mt-4 pt-4 border-t border-dashed border-muted-foreground/30">
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

                  {/* Shipping Guide Section - only shown when shippingGuide data is provided */}
                  {shippingGuide && (
                    <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-950/30">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          Guía de Envío
                        </h3>
                        <div className="flex gap-1 items-center">
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
                        {shippingGuide.amountToCollect != null &&
                          shippingGuide.amountToCollect > 0 && (
                            <div>
                              <span className="text-muted-foreground">
                                Monto a Cobrar:{" "}
                              </span>
                              <span className="font-medium text-amber-600">
                                S/{" "}
                                {Number(shippingGuide.amountToCollect).toFixed(
                                  2,
                                )}
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

                  {/* Promo del día - only shown in customer service view */}
                  {!hideCallManagement && (
                    <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-red-700 dark:text-red-400">
                          Promo del día
                        </h3>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-red-600 dark:text-red-400"
                          onClick={() => setAddProductsModalOpen(true)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Agregar productos
                        </Button>
                      </div>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Agregar más productos a la venta
                      </p>
                    </div>
                  )}

                  {/* Gestión de Llamada - only shown in customer service view */}
                  {!hideCallManagement && (
                    <div className="border border-border rounded-lg p-4">
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
                              className="flex-1 bg-green-600 hover:bg-green-700"
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
                              className="flex-1 bg-green-600 hover:bg-green-700"
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
                        </div>
                      )}
                    </div>
                  )}

                  {/* Comentarios Timeline */}
                  <div className="border border-border rounded-lg p-4">
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

                    {/* Timeline */}
                    <div className="max-h-[200px] overflow-y-auto mb-3 pr-1">
                      {logsLoading ? (
                        <div className="text-center text-muted-foreground py-4">
                          Cargando historial...
                        </div>
                      ) : logs.length === 0 ? (
                        <div className="text-center text-muted-foreground py-4">
                          No hay registros en el historial
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {logs.map((log, index) => (
                            <div
                              key={log.id}
                              className={`relative pl-5 pb-2 ${
                                index < logs.length - 1
                                  ? "border-l-2 border-muted ml-1.5"
                                  : "ml-1.5"
                              }`}
                            >
                              {/* Dot */}
                              <div
                                className={`absolute -left-[7px] top-0 w-3 h-3 rounded-full border-2 ${
                                  log.isSystemGenerated
                                    ? "bg-muted border-muted-foreground"
                                    : "bg-primary border-primary"
                                }`}
                              />

                              {/* Content */}
                              <div
                                className={`rounded-md p-2 ${log.isSystemGenerated ? "bg-muted/30 border border-muted" : "bg-primary/10 border border-primary/20"}`}
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
                                  <p className="text-sm">{log.comentarios}</p>
                                )}
                                {!log.comentarios && log.isSystemGenerated && (
                                  <p className="text-xs text-muted-foreground italic">
                                    Acción automática
                                  </p>
                                )}
                              </div>
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
    </>
  );
}
