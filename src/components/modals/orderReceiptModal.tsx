"use client";
import axios from "axios";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import OrderReceiptView from "./orderReceiptView";
import PaymentProofUploadModal from "./PaymentProofUploadModal";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Upload, Truck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { printOrderLabel } from "@/utils/printOrderLabel";
import { OrderHeader } from "@/interfaces/IOrder";

interface Props {
  open: boolean;
  orderId: string | null;
  onClose: () => void;
  onStatusChange?: () => void;
}
export default function OrderReceiptModal({
  open,
  orderId,
  onClose,
  onStatusChange,
}: Props) {
  const { auth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [orderHeader, setOrderHeader] = useState<OrderHeader | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!open) {
      setReceipt(null);
      setOrderHeader(null);
      return;
    }
    if (!orderId) {
      setReceipt(null);
      setOrderHeader(null);
      return;
    }

    const fetchReceipt = async () => {
      setReceipt(null);
      setLoading(true);
      try {
        const [receiptRes, orderRes] = await Promise.all([
          axios.get(
            `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}/receipt`,
          ),
          axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`),
        ]);
        setReceipt(receiptRes.data);
        setOrderHeader(orderRes.data);
      } catch (err) {
        console.error("Error fetching receipt", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [open, orderId]);

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

    // Si el estado es PENDIENTE, cambiarlo a PREPARADO (flujo unificado para LIMA y PROVINCIA)
    if (receipt.status === "PENDIENTE" && orderId) {
      const newStatus = "PREPARADO";
      try {
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
          { status: newStatus },
        );
        toast.success(`Estado actualizado a ${newStatus}`);
        onStatusChange?.();
      } catch (error: any) {
        const backendMessage = error?.response?.data?.message;
        if (backendMessage) {
          toast.error(backendMessage, { duration: 8000 });
        } else {
          toast.error("No se pudo actualizar el estado");
        }
        // No continuar con la impresión si falla el cambio de estado por stock
        return;
      }
    }

    const qrDataUrl = await generateQR(receipt.orderId);

    // Calcular adelanto y monto por cobrar
    const totalPaid = Array.isArray(receipt.payments)
      ? receipt.payments.reduce(
          (acc: number, payment: any) => acc + Number(payment.amount || 0),
          0,
        )
      : 0;
    const pendingAmount = Math.max(receipt.totals.grandTotal - totalPaid, 0);

    // Generar items expandidos para la impresión
    const expandedItems = receipt.items.flatMap((item: any) => {
      const discountPerUnit =
        item.quantity > 0
          ? (Number(item.discountAmount) || 0) / item.quantity
          : 0;
      const subtotalWithDiscount = item.unitPrice - discountPerUnit;

      return Array.from({ length: item.quantity }, () => ({
        ...item,
        originalQuantity: item.quantity,
        quantity: 1,
        subtotal: subtotalWithDiscount,
        discountPerUnit,
      }));
    });

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
              <span class="info-value">${receipt.customer.phoneNumber}</span>
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
              <span class="info-value">${receipt.customer.dni || receipt.customer.documentNumber || "-"}</span>
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

  // Misma etiqueta de despacho que "Imprimir" en el modal de pedido
  // (CustomerServiceModal) — antes este botón armaba un PDF genérico propio
  // con jsPDF que no tenía nada que ver con la etiqueta real.
  const handleDownloadPdf = async () => {
    if (!receipt) return;
    await printOrderLabel(receipt, orderHeader, auth?.company);
  };

  const handleWhatsapp = () => {
    if (!receipt) return;

    const phone = receipt.customer.phoneNumber.replace(/\D/g, "");
    const cleanPhone = phone.startsWith("51") ? phone : `51${phone}`;

    const trackingUrl = `${process.env.NEXT_PUBLIC_LANDING_URL}/rastreo/${receipt.orderNumber}`;
    const message = `Hola ${receipt.customer.fullName}, tu pedido N° ${receipt.orderNumber} se está procesando. A la brevedad se te enviará el comprobante de venta por este medio.\n\nPuedes rastrear tu pedido aquí: ${trackingUrl}`;

    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          document.body.style.overflow = "";
        }
      }}
    >
      <DialogContent
        id="order-receipt-print-area"
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Comprobante de pedido</DialogTitle>
        </DialogHeader>

        {loading && <p>Cargando comprobante...</p>}
        {!loading && receipt && (
          <OrderReceiptView
            data={{
              ...receipt,
              // El endpoint /receipt no trae googleMapsUrl — se completa con
              // el customer del order-header completo (ya lo pedimos arriba).
              customer: {
                ...receipt.customer,
                googleMapsUrl: orderHeader?.customer?.googleMapsUrl,
              },
            }}
          />
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => {
              const trackingUrl = `${process.env.NEXT_PUBLIC_LANDING_URL}/rastreo/${receipt.orderNumber}`;
              window.open(trackingUrl, "_blank");
            }}
          >
            <Truck className="h-4 w-4 mr-1" /> Rastreo
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            Imprimir
          </Button>
          <Button variant="outline" onClick={handleDownloadPdf}>
            Descargar PDF
          </Button>
          <Button onClick={handleWhatsapp}>Compartir</Button>
        </div>
      </DialogContent>

      <PaymentProofUploadModal
        open={uploadOpen}
        paymentId={selectedPaymentId}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => {
          // Recargar el recibo para ver el comprobante actualizado
          if (orderId) {
            axios
              .get(
                `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}/receipt`,
              )
              .then((res) => setReceipt(res.data))
              .catch((err) => console.error(err));
          }
        }}
      />
    </Dialog>
  );
}
