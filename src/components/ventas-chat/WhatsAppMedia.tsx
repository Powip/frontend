"use client";
import { useEffect, useState } from "react";
import { FileText, Loader2, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getMessageMedia } from "@/services/crmService";
import type { Message } from "@/types/crm";

/** Evento que el panel del pedido escucha para precargar el formulario de comprobante. */
export const USE_AS_RECEIPT_EVENT = "crm:use-as-receipt";

export function isWhatsAppMedia(m: Pick<Message, "mediaMime" | "mediaUrl" | "type">) {
  return !!m.mediaMime && !!m.mediaUrl && m.type !== "sticker";
}

/** Solo imagen o PDF sirven como comprobante (mismo límite que "Subir comprobante"). */
export function canBeReceipt(m: Pick<Message, "mediaMime" | "direction">) {
  const mime = (m.mediaMime ?? "").split(";")[0].trim().toLowerCase();
  return m.direction === "in" && ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(mime);
}

/** Baja el archivo con el token y devuelve una URL local (blob) mientras el componente viva. */
function useBlobUrl(mediaUrl: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!mediaUrl) return;
    let alive = true;
    let objectUrl: string | null = null;
    getMessageMedia(mediaUrl)
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaUrl]);
  return { url, failed };
}

export function WhatsAppMedia({ message }: { message: Message }) {
  const mime = (message.mediaMime ?? "").toLowerCase();
  const isImage = mime.startsWith("image/");
  const isAudio = mime.startsWith("audio/");
  const isVideo = mime.startsWith("video/");
  const { url, failed } = useBlobUrl(message.mediaUrl);
  const [open, setOpen] = useState(false);
  const name = message.mediaName ?? "archivo";

  return (
    <div className="space-y-1" data-testid="whatsapp-media">
      {failed ? (
        <p className="text-xs opacity-80">No se pudo cargar el archivo.</p>
      ) : !url ? (
        <p className="flex items-center gap-1 text-xs opacity-80">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Cargando archivo…
        </p>
      ) : isImage ? (
        <>
          <button type="button" onClick={() => setOpen(true)} aria-label="Ampliar imagen" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={name} className="max-h-60 rounded-md" data-testid="wa-image" />
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-3xl">
              <DialogTitle className="sr-only">{name}</DialogTitle>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={name} className="max-h-[80vh] w-full object-contain" />
            </DialogContent>
          </Dialog>
        </>
      ) : isAudio ? (
        <audio controls src={url} className="max-w-full" data-testid="wa-audio" />
      ) : isVideo ? (
        <video controls src={url} className="max-h-60 max-w-full rounded-md" data-testid="wa-video" />
      ) : (
        <a
          href={url}
          download={name}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 underline"
          data-testid="wa-document"
        >
          <FileText className="h-4 w-4" aria-hidden /> {name}
        </a>
      )}
      {canBeReceipt(message) && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs text-foreground"
          onClick={() =>
            window.dispatchEvent(new CustomEvent(USE_AS_RECEIPT_EVENT, { detail: { messageId: message.id } }))
          }
        >
          <ReceiptText /> Usar como comprobante de pago
        </Button>
      )}
    </div>
  );
}
