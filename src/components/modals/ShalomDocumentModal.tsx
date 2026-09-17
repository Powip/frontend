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

export type ShalomDocTab = "comprobante" | "rotulo";

interface ShalomDocState {
  url: string | null;
  loading: boolean;
  error: boolean;
  fetched: boolean;
}

const EMPTY_DOCS: Record<ShalomDocTab, ShalomDocState> = {
  comprobante: { url: null, loading: false, error: false, fetched: false },
  rotulo: { url: null, loading: false, error: false, fetched: false },
};

/**
 * Estado + fetch de los PDF reales de Shalom (comprobante/rótulo), separado
 * de la presentación para poder reusarlo tanto en el Dialog (ShalomDocumentModal,
 * usado desde CourierTrackingView.tsx) como embebido inline en la tab
 * Seguimiento de CustomerServiceModal.tsx, sin duplicar la lógica de fetch.
 * `active` reemplaza al `open` del Dialog: en uso inline siempre es true
 * (el componente se monta/desmonta con la tab de Radix).
 */
export function useShalomDocumentViewer(
  order: OrderHeader | null,
  active: boolean = true,
) {
  const { auth } = useAuth();
  const [activeTab, setActiveTab] = useState<ShalomDocTab>("comprobante");
  const [docs, setDocs] = useState<Record<ShalomDocTab, ShalomDocState>>(EMPTY_DOCS);
  const urlsRef = useRef<string[]>([]);

  const fetchDoc = useCallback(
    async (tab: ShalomDocTab) => {
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
    if (!active) return;
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    setActiveTab("comprobante");
    setDocs(EMPTY_DOCS);
    fetchDoc("comprobante");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, order?.id]);

  useEffect(() => {
    return () => {
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = [];
    };
  }, []);

  function selectTab(tab: ShalomDocTab) {
    setActiveTab(tab);
    if (!docs[tab].fetched && !docs[tab].loading) {
      fetchDoc(tab);
    }
  }

  const courierName = order?.courier || "Shalom";
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

  return {
    activeTab,
    docs,
    current,
    courierName,
    selectTab,
    handleDownload,
    handlePrint,
    handleShareWhatsApp,
  };
}

/**
 * Versión inline (sin Dialog) del documento del courier — misma lógica que
 * ShalomDocumentModal (tabs Comprobante/Rótulo, PDF real embebido, acciones),
 * pero como card para embeber directo en una columna en vez de requerir un
 * botón "Ver" que abra un modal aparte.
 */
export function ShalomDocumentCard({ order }: { order: OrderHeader | null }) {
  const {
    activeTab,
    current,
    courierName,
    selectTab,
    handleDownload,
    handlePrint,
    handleShareWhatsApp,
  } = useShalomDocumentViewer(order);

  return (
    <div className="rounded-xl border border-border overflow-hidden h-full flex flex-col">
      <div className="flex items-center gap-2.5 px-[13px] py-[11px] bg-muted/30 border-b border-border">
        <div className="h-[30px] w-[30px] rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 grid place-items-center shrink-0">
          <FileText className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold leading-tight">Documento del courier</div>
          <span className="text-[11.5px] text-muted-foreground">
            Traído de {courierName} por API
          </span>
        </div>
      </div>

      <div className="flex gap-1 px-3 pt-2.5">
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

      <div className="flex-1 min-h-[360px] bg-muted/40 overflow-hidden">
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

      <div className="flex gap-2 p-2.5 border-t border-border">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1 justify-center"
          disabled={!current.url}
          onClick={handleDownload}
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Descargar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1 justify-center"
          disabled={!current.url}
          onClick={handlePrint}
        >
          <Printer className="h-3.5 w-3.5 mr-1.5" />
          Imprimir
        </Button>
        <Button
          type="button"
          size="sm"
          className="flex-1 justify-center bg-[#25D366] hover:bg-[#1EBE5A] text-white"
          onClick={handleShareWhatsApp}
        >
          <WhatsAppIcon className="h-3.5 w-3.5 mr-1.5" />
          WhatsApp
        </Button>
      </div>
    </div>
  );
}

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
  const {
    activeTab,
    current,
    courierName,
    selectTab,
    handleDownload,
    handlePrint,
    handleShareWhatsApp,
  } = useShalomDocumentViewer(order, open);

  if (!order) return null;

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
