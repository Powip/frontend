"use client";
import axios from "axios";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { Phone, PhoneOff, MessageCircle, DollarSign, Pencil, Plus, MoreVertical, Check, Printer } from "lucide-react";
import { Textarea } from "../ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import CancellationModal, { CancellationReason } from "./CancellationModal";
import PaymentVerificationModal from "./PaymentVerificationModal";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

interface Props {
  open: boolean;
  orderId: string;
  onClose: () => void;
  onOrderUpdated?: () => void;
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
}

export default function CustomerServiceModal({ open, orderId, onClose, onOrderUpdated }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  useEffect(() => {
    if (!open || !orderId) return;
    fetchReceipt();
  }, [open, orderId]);

  const fetchReceipt = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}/receipt`
      );
      setReceipt(res.data);

      const orderRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`
      );
      setNotes(orderRes.data.notes || "");
    } catch (err) {
      console.error("Error fetching receipt", err);
      toast.error("Error al cargar el pedido");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCallStatus = async (callStatus: "CONFIRMED" | "NO_ANSWER") => {
    try {
      const payload: { callStatus: string; status?: string } = { callStatus };

      if (callStatus === "CONFIRMED") {
        payload.status = "LLAMADO";
      }

      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        payload
      );

      toast.success(callStatus === "CONFIRMED" ? "Entrega confirmada" : "Registrado como no contesta");
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
        { notes }
      );
      toast.success("Notas guardadas");
    } catch (error) {
      console.error("Error saving notes", error);
      toast.error("Error al guardar las notas");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleWhatsApp = () => {
    if (!receipt) return;
    const phone = receipt.customer.phoneNumber?.replace(/\D/g, "") || "";
    const cleanPhone = phone.startsWith("51") ? phone : `51${phone}`;

    const message = `Hola ${receipt.customer.fullName}! Te contactamos por tu pedido ${receipt.orderNumber}.`;

    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
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
    const printWindow = window.open('', '_blank', 'width=400,height=600');
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
          @media print {
            body { padding: 10px; }
            @page { margin: 5mm; size: 80mm auto; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" class="qr-code">` : ''}
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
              <span class="info-value">${receipt.customer.district || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Teléfono:</span>
              <span class="info-value">${receipt.customer.phoneNumber || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Tipo:</span>
              <span class="info-value">${receipt.customer.clientType || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Dirección:</span>
              <span class="info-value">${receipt.customer.address || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Referencia:</span>
              <span class="info-value">${receipt.customer.reference || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Departamento:</span>
              <span class="info-value">${receipt.customer.city || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Canal:</span>
              <span class="info-value">${receipt.salesChannel || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Provincia:</span>
              <span class="info-value">${receipt.customer.province || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">DNI:</span>
              <span class="info-value">${receipt.customer.dni || '-'}</span>
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
              ${receipt.items.map((item: any) => {
      const attrs = item.attributes ? Object.entries(item.attributes).map(([k, v]) => `${v}`).join('/') : '';
      const discount = Number(item.discountAmount) || 0;
      const subtotal = Number(item.subtotal);
      return `
                  <tr>
                    <td class="qty">${item.quantity}</td>
                    <td>
                      ${item.productName}${attrs ? ` (${attrs})` : ''}
                      ${discount > 0 ? `<div class="desc">Dcto: -S/${discount.toFixed(2)}</div>` : ''}
                    </td>
                    <td class="price">S/${subtotal.toFixed(2)}</td>
                  </tr>
                `;
    }).join('')}
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
          <div class="total-row pending">
            <span>Por Cobrar:</span>
            <span>S/ ${pendingAmount.toFixed(2)}</span>
          </div>
        </div>
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
    };
  };

  const handleConfirmCancellation = async (reason: CancellationReason, reasonNotes?: string) => {
    setIsCancelling(true);
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        {
          status: "ANULADO",
          cancellationReason: reason,
          notes: reasonNotes,
        }
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
          ) : receipt && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ================================== */}
              {/* SECCIÓN IZQUIERDA */}
              {/* ================================== */}
              <div className="space-y-4">
                {/* Header: N° Orden y Total */}
                <div className="border-b pb-4">
                  <h2 className="text-2xl font-bold">N° de Orden # {receipt.orderNumber}</h2>
                  <p className="text-2xl font-bold text-primary">Total: S/{receipt.totals.grandTotal.toFixed(2)}</p>
                </div>

                {/* Productos */}
                <div className="border border-border rounded-lg p-4">
                  <h3 className="font-semibold mb-3 text-lg">Productos</h3>
                  <div className="space-y-3 max-h-[250px] overflow-y-auto">
                    {receipt.items.map((item, i) => (
                      <div key={i} className="border border-border rounded-md p-3 bg-muted">
                        <p className="font-medium text-base">{item.productName}</p>
                        {item.attributes && Object.keys(item.attributes).length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {Object.entries(item.attributes).map(([k, v]) => (
                              <span key={k} className="mr-2 bg-secondary px-1 rounded">{k}: {String(v)}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex justify-between text-sm mt-2">
                          <span>Cantidad: <strong>{item.quantity}</strong></span>
                          <span>Valor Und: <strong>S/{item.unitPrice.toFixed(2)}</strong></span>
                        </div>
                        <div className="flex justify-between text-sm font-medium mt-1 pt-1 border-t border-border">
                          <span>Sub Total:</span>
                          <span className="text-primary">S/{item.subtotal.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resumen de Pagos */}
                <div className="border border-border rounded-lg p-4 bg-muted">
                  <h3 className="font-semibold mb-3 text-lg">Resumen de Pagos</h3>
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
                        className="h-9 w-9 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900"
                        onClick={() => setPaymentModalOpen(true)}
                        title="Gestionar Pagos"
                      >
                        <DollarSign className="h-4 w-4" />
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
                        onClick={() => router.push(`/registrar-venta?orderId=${orderId}`)}
                        title="Editar Pedido"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nombre: </span>
                      <span className="font-medium">{receipt.customer.fullName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Distrito: </span>
                      <span className="font-medium">{receipt.customer.district || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Teléfono: </span>
                      <span className="font-medium">{receipt.customer.phoneNumber || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo: </span>
                      <span className="font-medium">{receipt.customer.clientType || "-"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Dirección: </span>
                      <span className="font-medium">{receipt.customer.address || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Departamento: </span>
                      <span className="font-medium">{receipt.customer.city || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Canal Venta: </span>
                      <span className="font-medium">{receipt.salesChannel || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Provincia: </span>
                      <span className="font-medium">{receipt.customer.province || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Canal Cierre: </span>
                      <span className="font-medium">{receipt.closingChannel || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">DNI: </span>
                      <span className="font-medium">{receipt.customer.dni || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Referencia: </span>
                      <span className="font-medium">{receipt.customer.reference || "-"}</span>
                    </div>
                  </div>
                </div>

                {/* Promo del día */}
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-red-700 dark:text-red-400">Promo del día</h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-red-600 dark:text-red-400"
                      onClick={() => router.push(`/registrar-venta?orderId=${orderId}`)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar productos
                    </Button>
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-400">Agregar más productos a la venta</p>
                </div>

                {/* Gestión de Llamada */}
                <div className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Gestión de llamada</h3>
                    <span className={`text-sm font-medium px-2 py-1 rounded ${(receipt.callAttempts || 0) >= 3
                        ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400"
                        : (receipt.callAttempts || 0) >= 2
                          ? "bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400"
                          : "bg-muted text-foreground"
                      }`}>
                      Intentos: {receipt.callAttempts || 0}/3
                    </span>
                  </div>

                  {isConfirmed ? (
                    <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
                        <Check className="h-5 w-5" />
                        <span className="font-semibold">VENTA CONFIRMADA</span>
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
                          <span className="font-semibold">LÍMITE DE INTENTOS ALCANZADO</span>
                        </div>
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                          Se han realizado 3 intentos de llamada sin respuesta.
                          <br />Se recomienda anular la venta.
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={() => handleUpdateCallStatus("CONFIRMED")}
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
                          onClick={() => handleUpdateCallStatus("CONFIRMED")}
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          CONFIRMA ENTREGA
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                          onClick={() => handleUpdateCallStatus("NO_ANSWER")}
                        >
                          <PhoneOff className="h-4 w-4 mr-2" />
                          NO CONTESTA ({(receipt.callAttempts || 0) + 1}/3)
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notas y Acciones */}
                <div className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Notas</h3>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                      >
                        {savingNotes ? "Guardando..." : "Guardar"}
                      </Button>
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
                  </div>
                  <Textarea
                    placeholder="Agregar notas o comentarios del pedido..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
    </>
  );
}
