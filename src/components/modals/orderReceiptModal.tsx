"use client";
import axios from "axios";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import OrderReceiptView from "./orderReceiptView";
import OrderReceiptPdf from "./orderReceiptPdf";

interface Props {
  open: boolean;
  orderId: string | null;
  onClose: () => void;
}
export default function OrderReceiptModal({ open, orderId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  useEffect(() => {
    if (!open || !orderId) return;

    const fetchReceipt = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          `http://localhost:3002/order-header/${orderId}/receipt`
        );
        console.log(res.data);

        setReceipt(res.data);
      } catch (err) {
        console.error("Error fetching receipt", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [open, orderId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    /* const element = document.getElementById("receipt-pdf");
    if (!element || !receipt) return;

    const prevColorScheme = document.documentElement.style.colorScheme;
    document.documentElement.style.colorScheme = "light";

    import("html2pdf.js").then((html2pdf) => {
      html2pdf
        .default()
        .set({
          margin: 10,
          filename: `orden-${receipt.orderNumber}.pdf`,
          html2canvas: {
            scale: 2,
            backgroundColor: "#ffffff",
          },
          jsPDF: { unit: "mm", format: "a4" },
        })
        .from(element)
        .save()
        .finally(() => {
          document.documentElement.style.colorScheme = prevColorScheme;
        });
    }); */
  };

  const handleWhatsapp = () => {
    const message = `Hola ${receipt.customer.fullName}, acá tenés el resumen de tu compra N° ${receipt.orderNumber}.`;
    window.open(
      `https://wa.me/${receipt.customer.phoneNumber}?text=${encodeURIComponent(
        message
      )}`,
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle></DialogTitle>
        </DialogHeader>

        {loading && <p>Cargando comprobante...</p>}
        {!loading && receipt && (
          <>
            <OrderReceiptView data={receipt} />
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                opacity: 0,
                pointerEvents: "none",
                zIndex: -1,
              }}
            >
              <OrderReceiptPdf data={receipt} />
            </div>
          </>
        )}

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
