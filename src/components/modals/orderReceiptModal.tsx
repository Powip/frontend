"use client";
import axios from "axios";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import OrderReceiptView from "./orderReceiptView";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { toast } from "sonner";

interface Props {
  open: boolean;
  orderId: string | null;
  onClose: () => void;
  onStatusChange?: () => void;
}
export default function OrderReceiptModal({ open, orderId, onClose, onStatusChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

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

    // Crear imagen temporal del QR
    const qrImg = document.createElement("img");
    qrImg.src = qrDataUrl;
    qrImg.style.width = "120px";
    qrImg.style.height = "120px";
    qrImg.style.display = "block";
    qrImg.style.marginBottom = "10px";

    const modalContent = document.querySelector("#order-receipt-print-area");
    if (!modalContent) return;

    modalContent.prepend(qrImg);
    window.print();
    qrImg.remove();
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
    doc.text(
      `Total productos: $${receipt.totals.productsTotal.toFixed(2)}`,
      14,
      finalY + 10
    );
    doc.text(
      `Impuestos: $${receipt.totals.taxTotal.toFixed(2)}`,
      14,
      finalY + 16
    );
    doc.text(
      `Descuentos: $${receipt.totals.discountTotal.toFixed(2)}`,
      14,
      finalY + 22
    );
    doc.text(
      `Envío: $${receipt.totals.shippingTotal.toFixed(2)}`,
      14,
      finalY + 28
    );
    doc.setFontSize(14);
    doc.text(
      `Total: $${receipt.totals.grandTotal.toFixed(2)}`,
      14,
      finalY + 38
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
    </Dialog>
  );
}
