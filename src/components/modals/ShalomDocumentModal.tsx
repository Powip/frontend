"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { X, FileText, Download, Printer, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/shared/WhatsAppIcon";
import { OrderHeader } from "@/interfaces/IOrder";
import { generateShalomTicketPdf, generateShalomLabelPdf } from "@/services/shalomService";
import { useAuth } from "@/contexts/AuthContext";
import { buildWhatsAppUrl, toWhatsAppNumber } from "@/utils/whatsapp/build-whatsapp-url";
import { trackingUrlFor } from "@/app/centro-envios/components/shipmentUtils";

export type ShalomDocTab = "comprobante" | "rotulo";

interface ShalomDocState {
  url: string | null;
  blob: Blob | null;
  loading: boolean;
  error: boolean;
  fetched: boolean;
}

const EMPTY_DOCS: Record<ShalomDocTab, ShalomDocState> = {
  comprobante: { url: null, blob: null, loading: false, error: false, fetched: false },
  rotulo: { url: null, blob: null, loading: false, error: false, fetched: false },
};

export type WhatsAppRecipientKey = "cliente" | "destinatario";

export interface WhatsAppRecipientOption {
  key: WhatsAppRecipientKey;
  label: string;
  rawPhone: string | null;
  number: string | null;
}

/**
 * Qué se manda por WhatsApp según el estado del PDF:
 * - "document": el PDF está cargado → se comparte como archivo (Web Share
 *   API) o, si el dispositivo no lo permite, se descarga para adjuntarlo a
 *   mano. Nunca se pone la URL blob: en el mensaje (solo existe en este
 *   navegador) ni el endpoint autenticado de Shalom.
 * - "link": el PDF no está disponible → solo el enlace público de rastreo.
 * - "loading": todavía no se sabe; el botón queda deshabilitado.
 */
export type WhatsAppShareMode = "document" | "link" | "loading";

export function formatWhatsAppNumber(number: string): string {
  return `+${number.slice(0, 2)} ${number.slice(2, 5)} ${number.slice(5, 8)} ${number.slice(8)}`;
}

function docFileName(tab: ShalomDocTab, order: OrderHeader): string {
  return `${tab === "comprobante" ? "comprobante" : "rotulo"}-${order.shippingCode || order.orderNumber}.pdf`;
}

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
  const [recipientKey, setRecipientKey] = useState<WhatsAppRecipientKey>("cliente");
  const urlsRef = useRef<string[]>([]);

  const fetchDoc = useCallback(
    async (tab: ShalomDocTab) => {
      if (!auth?.accessToken || !order?.externalTrackingNumber || !order?.shippingCode) {
        setDocs((prev) => ({ ...prev, [tab]: { url: null, blob: null, loading: false, error: true, fetched: true } }));
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
        setDocs((prev) => ({ ...prev, [tab]: { url, blob, loading: false, error: false, fetched: true } }));
      } catch (error) {
        console.error(`❌ Error loading ${tab} PDF:`, error);
        setDocs((prev) => ({ ...prev, [tab]: { url: null, blob: null, loading: false, error: true, fetched: true } }));
      }
    },
    [auth?.accessToken, order?.externalTrackingNumber, order?.shippingCode],
  );

  useEffect(() => {
    if (!active) return;
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    setActiveTab("comprobante");
    setRecipientKey("cliente");
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
    a.download = docFileName(activeTab, order);
    a.click();
  }

  // El teléfono lo elige el usuario en la UI: nunca se cambia solo del
  // cliente al destinatario Shalom (pueden ser personas distintas).
  const recipientOptions = useMemo<WhatsAppRecipientOption[]>(() => {
    const customerPhone = order?.customer?.phoneNumber?.trim() || null;
    const options: WhatsAppRecipientOption[] = [
      {
        key: "cliente",
        label: "Cliente",
        rawPhone: customerPhone,
        number: toWhatsAppNumber(customerPhone),
      },
    ];
    const recipientPhone = order?.shalomRecipientPhone?.trim() || null;
    if (recipientPhone) {
      options.push({
        key: "destinatario",
        label: "Destinatario Shalom",
        rawPhone: recipientPhone,
        number: toWhatsAppNumber(recipientPhone),
      });
    }
    return options;
  }, [order?.customer?.phoneNumber, order?.shalomRecipientPhone]);

  const recipient =
    recipientOptions.find((o) => o.key === recipientKey) ?? recipientOptions[0];
  const recipientOwner = recipient.key === "cliente" ? "del cliente" : "del destinatario Shalom";
  const recipientError = !recipient.rawPhone
    ? `No hay teléfono ${recipientOwner} registrado.`
    : !recipient.number
      ? `El teléfono ${recipientOwner} (${recipient.rawPhone}) no es un celular válido para WhatsApp: debe tener 9 dígitos y empezar con 9.`
      : null;

  const shareMode: WhatsAppShareMode = current.loading
    ? "loading"
    : current.blob
      ? "document"
      : "link";

  function openWhatsApp(whatsappUrl: string): boolean {
    const win = window.open(whatsappUrl, "_blank");
    if (!win) {
      toast.error(
        "El navegador bloqueó la ventana de WhatsApp. Permite las ventanas emergentes para este sitio o ábrelo desde aquí.",
        {
          action: {
            label: "Abrir WhatsApp",
            onClick: () => window.open(whatsappUrl, "_blank", "noopener,noreferrer"),
          },
        },
      );
      return false;
    }
    win.opener = null;
    return true;
  }

  // Todo lo que requiere gesto del usuario (navigator.share, window.open,
  // la descarga) se dispara de forma síncrona dentro del click: el PDF ya
  // está en memoria como Blob, no hay await antes.
  function handleShareWhatsApp() {
    if (!order || shareMode === "loading") return;
    if (recipientError || !recipient.number) {
      toast.error(recipientError ?? "Teléfono inválido para WhatsApp.");
      return;
    }

    const docLabel = activeTab === "comprobante" ? "comprobante" : "rótulo";
    const trackingUrl = trackingUrlFor(order);
    const greeting =
      recipient.key === "cliente" && order.customer?.fullName
        ? `Hola ${order.customer.fullName}`
        : "Hola";

    if (shareMode === "link" || !current.blob) {
      const text = `${greeting}, puedes seguir el envío de tu pedido ${order.orderNumber} con ${courierName} aquí: ${trackingUrl}`;
      const whatsappUrl = buildWhatsAppUrl(recipient.number, text);
      if (whatsappUrl) openWhatsApp(whatsappUrl);
      return;
    }

    const fileName = docFileName(activeTab, order);
    const text = `${greeting}, te comparto el ${docLabel} de envío con ${courierName} de tu pedido ${order.orderNumber}. Seguimiento: ${trackingUrl}`;
    const file = new File([current.blob], fileName, { type: "application/pdf" });

    if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file], title: fileName, text }).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        toast.error(
          `No se pudo compartir el ${docLabel}. Descárgalo y adjúntalo manualmente en WhatsApp.`,
          { action: { label: "Descargar PDF", onClick: handleDownload } },
        );
      });
      return;
    }

    const whatsappUrl = buildWhatsAppUrl(recipient.number, text);
    if (!whatsappUrl) return;
    handleDownload();
    if (openWhatsApp(whatsappUrl)) {
      toast.info(
        `Se descargó ${fileName}. Adjúntalo en el chat de WhatsApp antes de enviar el mensaje.`,
      );
    }
  }

  function handlePrint() {
    if (!current.url) return;
    const win = window.open(current.url, "_blank");
    win?.focus();
    win?.print();
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
    recipientOptions,
    recipient,
    recipientError,
    setRecipientKey,
    shareMode,
  };
}

type ShalomDocumentViewer = ReturnType<typeof useShalomDocumentViewer>;

/**
 * Bloque común (card embebida y modal) que muestra a qué teléfono se va a
 * mandar el WhatsApp y qué se va a compartir, antes de hacer click.
 */
function WhatsAppShareInfo({
  viewer,
  className = "",
}: {
  viewer: ShalomDocumentViewer;
  className?: string;
}) {
  const { recipientOptions, recipient, recipientError, setRecipientKey, shareMode, activeTab } = viewer;
  const docLabel = activeTab === "comprobante" ? "comprobante" : "rótulo";

  return (
    <div className={`flex flex-col gap-1.5 text-[11.5px] ${className}`} data-testid="whatsapp-share-info">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-muted-foreground">WhatsApp a:</span>
        {recipientOptions.length > 1 ? (
          <fieldset aria-label="Teléfono para WhatsApp" className="flex gap-1">
            {recipientOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={option.key === recipient.key}
                onClick={() => setRecipientKey(option.key)}
                className={`px-2 py-0.5 rounded-md border font-semibold transition-colors ${
                  option.key === recipient.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </fieldset>
        ) : (
          <span className="font-semibold">{recipient.label}</span>
        )}
        {recipient.number && (
          <span className="tabular-nums" data-testid="whatsapp-phone">
            {formatWhatsAppNumber(recipient.number)}
          </span>
        )}
      </div>
      {recipientError ? (
        <p role="alert" className="text-red-600 dark:text-red-400 font-medium">
          {recipientError}
        </p>
      ) : shareMode === "document" ? (
        <p className="text-muted-foreground">
          Se compartirá el PDF del {docLabel}. Si el dispositivo no permite compartir archivos, se
          descargará para que lo adjuntes en el chat.
        </p>
      ) : shareMode === "link" ? (
        <p className="text-amber-700 dark:text-amber-400 font-medium">
          El {docLabel} no está disponible: solo se enviará el enlace de seguimiento.
        </p>
      ) : null}
    </div>
  );
}

function whatsAppButtonLabel(shareMode: WhatsAppShareMode): string {
  return shareMode === "link" ? "Enviar enlace" : "WhatsApp";
}

/**
 * Versión inline (sin Dialog) del documento del courier — misma lógica que
 * ShalomDocumentModal (tabs Comprobante/Rótulo, PDF real embebido, acciones),
 * pero como card para embeber directo en una columna en vez de requerir un
 * botón "Ver" que abra un modal aparte.
 */
export function ShalomDocumentCard({ order }: { order: OrderHeader | null }) {
  const viewer = useShalomDocumentViewer(order);
  const {
    activeTab,
    current,
    courierName,
    selectTab,
    handleDownload,
    handlePrint,
    handleShareWhatsApp,
    shareMode,
  } = viewer;

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

      <WhatsAppShareInfo viewer={viewer} className="px-3 pt-2.5 border-t border-border" />

      <div className="flex gap-2 p-2.5">
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
          disabled={shareMode === "loading"}
          onClick={handleShareWhatsApp}
        >
          <WhatsAppIcon className="h-3.5 w-3.5 mr-1.5" />
          {whatsAppButtonLabel(shareMode)}
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
  const viewer = useShalomDocumentViewer(order, open);
  const {
    activeTab,
    current,
    courierName,
    selectTab,
    handleDownload,
    handlePrint,
    handleShareWhatsApp,
    shareMode,
  } = viewer;

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

        <WhatsAppShareInfo viewer={viewer} className="px-3.5 pt-3 border-t border-border" />

        <div className="flex gap-2.5 p-3.5">
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
            disabled={shareMode === "loading"}
            onClick={handleShareWhatsApp}
          >
            <WhatsAppIcon className="h-4 w-4 mr-1.5" />
            {whatsAppButtonLabel(shareMode)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
