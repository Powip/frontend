"use client";
import axios from "axios";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import OrderReceiptView from "./orderReceiptView";
import PaymentProofUploadModal from "./PaymentProofUploadModal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Upload } from "lucide-react";

interface Props {
  open: boolean;
  orderId: string | null;
  onClose: () => void;
  onStatusChange?: () => void;
}
export default function OrderReceiptModal({ open, orderId, onClose, onStatusChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !orderId) return;

    const fetchReceipt = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}/receipt`
        );

        setReceipt(res.data);
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

    // Si el estado es PENDIENTE, intentar cambiarlo según la región
    if (receipt.status === "PENDIENTE" && orderId) {
      const newStatus = receipt.salesRegion === "PROVINCIA" ? "EN_ENVIO" : "PREPARADO";
      try {
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
          { status: newStatus }
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
        0
      )
      : 0;
    const pendingAmount = Math.max(receipt.totals.grandTotal - totalPaid, 0);

    // Generar items expandidos para la impresión
    const expandedItems = receipt.items.flatMap((item: any) =>
      Array.from({ length: item.quantity }, () => ({
        ...item,
        quantity: 1,
        subtotal: item.unitPrice,
      }))
    );

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
            text-align: center; 
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px dashed #333;
          }
          .qr-code { 
            width: 80px; 
            height: 80px; 
            margin: 0 auto 8px;
            display: block;
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
          .products-list { 
            border: 1px solid #ddd; 
            padding: 8px;
            margin-bottom: 10px;
          }
          .product-item { 
            padding: 6px 0;
            border-bottom: 1px dotted #eee;
          }
          .product-item:last-child { border-bottom: none; }
          .product-name { font-weight: bold; font-size: 11px; }
          .product-detail { font-size: 9px; color: #666; }
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
            border-top: 1px solid #333;
            padding-top: 6px;
            margin-top: 6px;
          }
          .total-row.pending { 
            font-weight: bold;
            color: #d97706;
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
          <div class="order-title">Orden # ${receipt.orderNumber}</div>
          <div class="order-total">Total: S/ ${receipt.totals.grandTotal.toFixed(2)}</div>
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
              <span class="info-value">${receipt.customer.phoneNumber}</span>
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
              <span class="info-value">${receipt.customer.documentNumber || '-'}</span>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Productos</div>
          <div class="products-list">
            ${expandedItems.map((item: any) => `
              <div class="product-item">
                <div class="product-name">${item.productName}</div>
                ${item.attributes ? Object.entries(item.attributes).map(([k, v]) =>
      `<div class="product-detail">${k}: ${v}</div>`
    ).join('') : ''}
                <div class="product-detail">Cantidad: ${item.quantity} | Valor Und: S/ ${item.unitPrice} | Sub Total: S/ ${item.subtotal}</div>
              </div>
            `).join('')}
          </div>
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

  const handleDownloadPdf = async () => {
    if (!receipt) return;

    const qrDataUrl = await generateQR(receipt.orderId);

    const doc = new jsPDF();
    const createdAt = new Date(receipt.createdAt);
    const formattedDate = createdAt.toLocaleDateString("es-AR");
    const formattedTime = createdAt.toLocaleTimeString("es-AR");

    // QR en PDF
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, "PNG", 150, 14, 40, 40); // posición y tamaño
    }

    // Header
    doc.setFontSize(16);
    doc.text(`Comprobante ${receipt.receiptType}`, 14, 20);
    doc.setFontSize(12);
    doc.text(`N° Orden: ${receipt.orderNumber}`, 14, 30);
    doc.text(`Estado: ${receipt.status}`, 14, 36);
    doc.text(`Fecha: ${formattedDate} ${formattedTime}`, 14, 42);

    // Cliente
    doc.text(`Cliente: ${receipt.customer.fullName}`, 14, 52);
    doc.text(`Teléfono: ${receipt.customer.phoneNumber}`, 14, 58);
    doc.text(`DNI: ${receipt.customer.dni ?? "-"}`, 14, 64);
    doc.text(
      `Dirección: ${receipt.customer.address}, ${receipt.customer.district}, ${receipt.customer.province}`,
      14,
      70
    );

    // Items
    const items = receipt.items.map((item: any) => [
      item.productName,
      Object.entries(item.attributes)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · "),
      item.quantity.toString(),
      item.unitPrice.toFixed(2),
      item.subtotal.toFixed(2),
    ]);

    autoTable(doc, {
      startY: 80,
      head: [
        ["Producto", "Variantes", "Cantidad", "Precio Unitario", "Subtotal"],
      ],
      body: items,
      theme: "grid",
      headStyles: { fillColor: [2, 168, 225], textColor: 255 },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 0;

    // Calcular adelanto y monto por cobrar
    const totalPaid = Array.isArray(receipt.payments)
      ? receipt.payments.reduce(
        (acc: number, payment: any) => acc + Number(payment.amount || 0),
        0
      )
      : 0;
    const pendingAmount = Math.max(receipt.totals.grandTotal - totalPaid, 0);

    doc.text(
      `Productos: S/${receipt.totals.productsTotal.toFixed(2)}`,
      14,
      finalY + 10
    );
    doc.text(
      `IGV 18%: S/${receipt.totals.taxTotal.toFixed(2)}`,
      14,
      finalY + 16
    );
    doc.text(
      `Envío: S/${receipt.totals.shippingTotal.toFixed(2)}`,
      14,
      finalY + 22
    );
    doc.setFontSize(14);
    doc.text(
      `Total: S/${receipt.totals.grandTotal.toFixed(2)}`,
      14,
      finalY + 32
    );
    doc.setFontSize(12);
    doc.text(
      `Descuentos: S/${receipt.totals.discountTotal.toFixed(2)}`,
      14,
      finalY + 42
    );
    doc.text(
      `Adelanto: S/${totalPaid.toFixed(2)}`,
      14,
      finalY + 48
    );
    doc.text(
      `Por Cobrar: S/${pendingAmount.toFixed(2)}`,
      14,
      finalY + 54
    );

    doc.save(`Comprobante_${receipt.orderNumber}.pdf`);
  };

  const handleWhatsapp = () => {
    if (!receipt) return;

    const phone = receipt.customer.phoneNumber.replace(/\D/g, "");
    const cleanPhone = phone.startsWith("51") ? phone : `51${phone}`;

    const message = `Hola ${receipt.customer.fullName}, tu pedido N° ${receipt.orderNumber} se está procesando. A la brevedad se te enviará el comprobante de venta por este medio.`;

    toast.info("Abriendo WhatsApp. Recuerda descargar el comprobante y adjuntarlo en el chat.", {
      duration: 5000,
    });

    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      "_blank"
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
          <DialogTitle>Comprobante</DialogTitle>
        </DialogHeader>

        {loading && <p>Cargando comprobante...</p>}
        {!loading && receipt && <OrderReceiptView data={receipt} />}

        <div className="flex justify-end gap-2 mt-4">
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
            axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}/receipt`)
              .then(res => setReceipt(res.data))
              .catch(err => console.error(err));
          }
        }}
      />
    </Dialog>
  );
}
