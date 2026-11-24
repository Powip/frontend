"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DESCRIPTION_HTML_CLASS } from "@/components/catalog/ficha/content/DescriptionEditor";
import { sanitizeDescriptionHtml } from "@/lib/catalog/productContent";
import { cn } from "@/lib/utils";
import { getPublicLiveProductContent, liveEntryContext } from "./liveService";
import type { LiveProduct } from "./types";

/** Contenido de un grupo de variantes: es del producto, igual en todas (la primera que lo traiga). */
export const groupContent = (variants: LiveProduct[]) => variants.find((item) => item.content)?.content;

/**
 * FEAT-32 M7 — «Ver detalle» de la vitrina (`/live` y `/catalogo`): fotos del canal (hasta 3 en el live),
 * descripción corta, descripción (HTML saneado con la misma lista blanca que la pestaña Contenido) y
 * características. El detalle se pide al abrir (no en el polling) y se guarda 60 s por producto y canal; si
 * ms-products no responde, se ve lo que ya trae la tarjeta. No cambia el flujo de separar ni de comprar.
 */
export default function LiveProductDetailDialog({
  storeId,
  visitor,
  variants,
  onClose,
}: {
  storeId: string;
  visitor: string;
  variants: LiveProduct[];
  onClose: () => void;
}) {
  const product = variants[0];
  const productId = product.productId ?? "";
  const channel = liveEntryContext().channel;
  const card = groupContent(variants);
  const detail = useQuery({
    queryKey: ["live-public-content", storeId, channel, productId],
    queryFn: ({ signal }) => getPublicLiveProductContent(storeId, visitor, productId, signal),
    enabled: Boolean(productId && visitor),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const data = detail.data;
  const photos = data?.photos.length
    ? data.photos
    : card?.photos.length
      ? card.photos
      : product.imageUrl
        ? [product.imageUrl]
        : [];
  const [index, setIndex] = useState(0);
  const shown = photos[Math.min(index, Math.max(0, photos.length - 1))];
  const title = data?.title?.trim() || card?.title?.trim() || product.name;
  const short = (data?.shortDescription ?? card?.shortDescription ?? "").trim();
  const html = useMemo(() => sanitizeDescriptionHtml(data?.descriptionHtml), [data?.descriptionHtml]);
  const features = (data?.features ?? []).filter((item) => item.trim());

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto border-white/15 bg-[#171428] text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={short ? "text-slate-300" : "sr-only"}>
            {short || "Fotos y descripción del producto"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-2xl bg-slate-100 text-slate-400">
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element -- fotos del producto de cualquier origen
              <img src={shown} alt={`${title}, foto ${index + 1}`} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-8 w-8" aria-hidden="true" />
            )}
          </div>
          {photos.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {photos.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  aria-label={`Ver foto ${i + 1}`}
                  aria-pressed={i === index}
                  className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${i === index ? "border-emerald-300" : "border-white/15 opacity-70 hover:opacity-100"}`}
                  onClick={() => setIndex(i)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
          {detail.isLoading ? (
            <p role="status" className="text-sm text-slate-300">
              Cargando detalle…
            </p>
          ) : null}
          {html ? (
            <div
              data-testid="live-product-description"
              // Misma presentación que la vista previa de la pestaña Contenido, sobre blanco (como en la tienda).
              className={cn("rounded-xl bg-white p-4 text-slate-900", DESCRIPTION_HTML_CLASS)}
              // Saneado en ms-products y otra vez acá (misma lista blanca que la pestaña Contenido).
              // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML saneado con la lista blanca.
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : null}
          {features.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200" aria-label="Características">
              {[...new Set(features)].map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="min-h-11 w-full rounded-xl border border-white/20 px-4 py-3 text-sm"
            onClick={onClose}
          >
            Seguir viendo productos
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
