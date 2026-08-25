"use client";
import axios from "axios";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import OrderReceiptView from "./orderReceiptView";
import PaymentProofUploadModal from "./PaymentProofUploadModal";
import { toast } from "sonner";
import { Upload, Truck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { printOrderLabel } from "@/utils/printOrderLabel";
import { downloadNotaVentaPdf } from "@/utils/downloadNotaVentaPdf";
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

    await printOrderLabel(receipt, orderHeader, auth?.company);
  };

  const handleDownloadPdf = async () => {
    if (!receipt) return;
    await downloadNotaVentaPdf(receipt, orderHeader, auth?.company);
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
            Nota de venta
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
