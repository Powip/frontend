"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X, FileText, Download, Printer, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/shared/WhatsAppIcon";
import { OrderHeader } from "@/interfaces/IOrder";
import { generateShalomTicketPdf, generateShalomLabelPdf } from "@/services/shalomService";
import { useAuth } from "@/contexts/AuthContext";
import { buildWhatsAppUrl } from "@/utils/whatsapp/build-whatsapp-url";

type DocTab = "comprobante" | "rotulo";

interface DocState {
  url: string | null;
  loading: boolean;
  error: boolean;
  fetched: boolean;
}

const EMPTY_DOCS: Record<DocTab, DocState> = {
  comprobante: { url: null, loading: false, error: false, fetched: false },
  rotulo: { url: null, loading: false, error: false, fetched: false },
};

interface ShalomDocumentModalProps {
  open: boolean;
  onClose: () => void;
  order: OrderHeader | null;
}

export default function ShalomDocumentModal({
  open,
  onClose,
  order,
}: ShalomDocumentModalProps) {
  const { auth } = useAuth();
  const [activeTab, setActiveTab] = useState<DocTab>("comprobante");
  const [docs, setDocs] = useState<Record<DocTab, DocState>>(EMPTY_DOCS);
  const urlsRef = useRef<string[]>([]);

  const fetchDoc = useCallback(
    async (tab: DocTab) => {
      if (!auth?.accessToken || !order?.externalTrackingNumber || !order?.shippingCode) {
        setDocs((prev) => ({ ...prev, [tab]: { url: null, loading: false, error: true, fetched: true } }));
        return;
      }
      setDocs((prev) => ({ ...prev, [tab]: { ...prev[tab], loading: true, error: false } }));
      try {
        const blob =
          tab === "comprobante"
            ? await generateShalomTicketPdf(auth.accessToken, order.externalTrackingNumber, order.shippingCode)
            : await generateShalomLabelPdf(auth.accessToken, order.externalTrackingNumber, order.shippingCode);
        const url = URL.createObjectURL(blob);
        urlsRef.current.push(url);
        setDocs((prev) => ({ ...prev, [tab]: { url, loading: false, error: false, fetched: true } }));
      } catch (error) {
        console.error(`❌ Error loading ${tab} PDF:`, error);
        setDocs((prev) => ({ ...prev, [tab]: { url: null, loading: false, error: true, fetched: true } }));
      }
    },
    [auth?.accessToken, order?.externalTrackingNumber, order?.shippingCode],
  );

  useEffect(() => {
    if (!open) return;
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    setActiveTab("comprobante");
    setDocs(EMPTY_DOCS);
    fetchDoc("comprobante");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?.id]);

  useEffect(() => {
    return () => {
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = [];
    };
  }, []);

  function selectTab(tab: DocTab) {
    setActiveTab(tab);
    if (!docs[tab].fetched && !docs[tab].loading) {
      fetchDoc(tab);
    }
  }

  if (!order) return null;

  const courierName = order.courier || "Shalom";
  const current = docs[activeTab];

  function handleDownload() {
    if (!current.url || !order) return;
    const a = document.createElement("a");
    a.href = current.url;
    a.download = `${activeTab === "comprobante" ? "comprobante" : "rotulo"}-${order.shippingCode || order.orderNumber}.pdf`;
    a.click();
  }

  function handlePrint() {
    if (!current.url) return;
    const win = window.open(current.url, "_blank");
    win?.focus();
    win?.print();
  }

  function handleShareWhatsApp() {
    if (!order) return;
    const docLabel = activeTab === "comprobante" ? "comprobante" : "rótulo";
    const whatsappUrl = buildWhatsAppUrl(
      order.customer?.phoneNumber,
      `Hola ${order.customer?.fullName || ""}, aquí tienes tu ${docLabel} de envío con ${courierName} · pedido ${order.orderNumber}.`,
    );
    if (!whatsappUrl) {
      toast.error("El cliente no tiene un teléfono celular válido para WhatsApp");
      return;
    }
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-[520px] p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Documento del courier</DialogTitle>

        <div className="flex items-center gap-3 p-4 border-b border-border">
          <div className="h-[34px] w-[34px] shrink-0 rounded-lg bg-[#FDECEC] dark:bg-red-950/40 text-[#E11B22] dark:text-red-400 grid place-items-center">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-extrabold text-[15px] leading-tight">Documento del courier</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Traído de {courierName} por API · pedido {order.orderNumber}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 shrink-0 rounded-lg border border-border grid place-items-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 px-4 pt-3">
          <button
            type="button"
            onClick={() => selectTab("comprobante")}
            className={`text-xs font-bold px-3 py-1.5 rounded-t-lg transition-colors ${
              activeTab === "comprobante"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Comprobante
          </button>
          <button
            type="button"
            onClick={() => selectTab("rotulo")}
            className={`text-xs font-bold px-3 py-1.5 rounded-t-lg transition-colors ${
              activeTab === "rotulo"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Rótulo de envío
          </button>
        </div>

        <div className="h-[64vh] bg-muted/40 overflow-hidden">
          {current.loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs font-medium">Cargando documento…</span>
            </div>
          ) : current.error || !current.url ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground px-6 text-center">
              <FileText className="h-8 w-8 opacity-30" />
              <span className="text-xs font-medium">
                {activeTab === "comprobante" ? "Comprobante" : "Rótulo"} no disponible desde {courierName}.
              </span>
            </div>
          ) : (
            <embed src={current.url} type="application/pdf" className="w-full h-full border-none" />
          )}
        </div>

        <div className="flex gap-2.5 p-3.5 border-t border-border">
          <Button
            type="button"
            variant="outline"
            className="flex-1 justify-center"
            disabled={!current.url}
            onClick={handleDownload}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Descargar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 justify-center"
            disabled={!current.url}
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Imprimir
          </Button>
          <Button
            type="button"
            className="flex-1 justify-center bg-[#25D366] hover:bg-[#1EBE5A] text-white"
            onClick={handleShareWhatsApp}
          >
            <WhatsAppIcon className="h-4 w-4 mr-1.5" />
            WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
