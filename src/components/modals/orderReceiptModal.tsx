"use client";
import SaleUnitLifecycleActions from "@/components/registrar-venta/SaleUnitLifecycleActions";
import axios from "@/lib/axiosAuth";
import Link from "next/link";
import { isCommercialLeadOrder, canOperateCommercialOrder, commercialLeadHref } from "@/utils/commercialOrders";
import {
  assignmentBlockReason,
  saleMutationUrl,
} from "@/services/saleTrackingService";
import { SaleAssignmentStatus } from "@/components/registrar-venta/SaleTrackingRecovery";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import OrderReceiptView from "./orderReceiptView";
import PaymentProofUploadModal from "./PaymentProofUploadModal";
import { toast } from "sonner";
import { Upload, Truck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useReceiptPrintScope } from "@/hooks/useReceiptPrintScope";
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
  const receiptKey = `${auth?.company?.id ?? ""}:${auth?.user?.id ?? ""}:${orderId}`;
  const activeReceiptKey = useRef(receiptKey);
  activeReceiptKey.current = receiptKey;
  const [receiptRevision, setReceiptRevision] = useState(0);
  const beginPrint = useReceiptPrintScope(
    `${receiptKey}:${receiptRevision}`,
    Boolean(open && orderId && auth?.company?.id && auth?.user?.id),
  );
  const [loading, setLoading] = useState(false);
  const [loadedReceipt, setReceipt] = useState<any>(null);
  const [loadedHeader, setOrderHeader] = useState<OrderHeader | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const receipt = loadedKey === receiptKey ? loadedReceipt : null;
  const orderHeader = loadedKey === receiptKey ? loadedHeader : null;
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
    if (!orderId || !auth?.company?.id || !auth?.user?.id) {
      setReceipt(null);
      setOrderHeader(null);
      return;
    }

    const controller = new AbortController();
    const fetchReceipt = async () => {
      setReceipt(null);
      setLoading(true);
      try {
        const orderRes = await axios.get<OrderHeader>(`${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/manual/${orderId}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (orderRes.data.id !== orderId) throw new Error("El pedido no corresponde al documento solicitado.");
        setOrderHeader(orderRes.data);
        setLoadedKey(receiptKey);
        if (isCommercialLeadOrder(orderRes.data)) return;
        const receiptRes = await axios.get(`${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/manual/${orderId}/receipt`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (
          receiptRes.data?.orderId !== orderId ||
          orderRes.data?.id !== orderId
        )
          throw new Error(
            "El comprobante no corresponde al pedido solicitado.",
          );
        setReceipt(receiptRes.data);
        setOrderHeader(orderRes.data);
        setLoadedKey(receiptKey);
      } catch (err) {
        if (!controller.signal.aborted)
          console.error("Error fetching receipt", err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchReceipt();
    return () => controller.abort();
  }, [
    open,
    orderId,
    receiptKey,
    receiptRevision,
    auth?.company?.id,
    auth?.user?.id,
  ]);

  const reloadReceipt = (saved?: OrderHeader) => {
    if (
      !open ||
      activeReceiptKey.current !== receiptKey ||
      (saved && saved.id !== orderId)
    )
      return;
    setReceipt(null);
    setLoadedKey("");
    setReceiptRevision((revision) => revision + 1);
  };

  const handlePrint = async () => {
    if (!receipt || !orderHeader || !canOperateCommercialOrder(orderHeader)) { toast.error("Gestiona y prepara la compra desde el Lead antes de imprimir."); return; }
    const operation = beginPrint();
    try {
      const blocked =
        orderHeader && assignmentBlockReason(orderHeader, "PREPARADO");
      if (blocked) {
        toast.error(blocked);
        return;
      }

      // PAGADO confirma el cobro, pero el paquete aún debe pasar a PREPARADO al imprimir.
      if ((receipt.status === "PENDIENTE" || receipt.status === "PAGADO") && orderId) {
        const newStatus = "PREPARADO";
        try {
          await axios.patch(
            saleMutationUrl(
              process.env.NEXT_PUBLIC_API_VENTAS || "",
              orderId,
              orderHeader,
            ),
            { status: newStatus },
          );
          if (!operation.isCurrent?.()) return;
          toast.success(`Estado actualizado a ${newStatus}`);
          onStatusChange?.();
        } catch (error: any) {
          if (!operation.isCurrent?.()) return;
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

      if (operation.isCurrent?.())
        await printOrderLabel(receipt, orderHeader, auth?.company, operation);
    } finally {
      operation.release();
    }
  };

  const handleDownloadPdf = async () => {
    if (!receipt) return;
    const operation = beginPrint();
    try {
      await downloadNotaVentaPdf(
        receipt,
        orderHeader,
        auth?.company,
        operation,
      );
    } finally {
      operation.release();
    }
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
        className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden"
      >
        <DialogHeader>
          <DialogTitle>Comprobante de pedido</DialogTitle>
        </DialogHeader>

        {loading && <p>Cargando comprobante...</p>}
        {!loading && receipt && (
          <>
            {orderHeader && (
              <SaleAssignmentStatus
                key={`${auth?.company?.id}:${orderHeader.id}`}
                order={orderHeader}
                onRefresh={reloadReceipt}
              />
            )}
            <OrderReceiptView data={receipt} />
          </>
        )}

        {orderHeader && (
          <SaleUnitLifecycleActions
            key={`${receiptKey}:${orderHeader.id}`}
            order={orderHeader}
            onUpdated={(saved) => {
              reloadReceipt(saved);
              onStatusChange?.();
            }}
          />
        )}
        <div className="flex flex-wrap justify-end gap-2 mt-4">
          <Button
            variant="outline"
            disabled={!receipt}
            onClick={() => {
              const trackingUrl = `${process.env.NEXT_PUBLIC_LANDING_URL}/rastreo/${receipt.orderNumber}`;
              window.open(trackingUrl, "_blank");
            }}
          >
            <Truck className="h-4 w-4 mr-1" /> Rastreo
          </Button>
          {orderHeader?.unitAssignmentStatus &&
            orderHeader.unitAssignmentStatus !== "NONE" && (
              <Button variant="outline" asChild>
                <Link href={`/registrar-venta?orderId=${orderHeader.id}`}>
                  Revisar IMEI / series
                </Link>
              </Button>
            )}
          <Button variant="outline" onClick={handlePrint} disabled={!receipt}>
            Imprimir
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={!receipt}
          >
            Nota de venta
          </Button>
          <Button onClick={handleWhatsapp} disabled={!receipt}>
            Compartir
          </Button>
        </div>
      </DialogContent>

      <PaymentProofUploadModal
        open={uploadOpen}
        paymentId={selectedPaymentId}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => reloadReceipt()}
      />
    </Dialog>
  );
}
