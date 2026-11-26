"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import { MAX_PHOTOS, PHOTO_TYPES, imageFileSize, photoFileProblem } from "@/lib/catalog/productContent";
import {
  LIVE_MAX_PHOTOS,
  chooseLivePhoto,
  dropLivePhoto,
  galleryPhotos,
  initialLivePhotos,
  isChosen,
  livePhotosBody,
  livePhotosChanged,
  makeLivePrincipal,
  resetLivePhotos,
  type LivePhotosState,
} from "@/lib/catalog/livePhotos";
import {
  addContentPhoto,
  getEffectiveContent,
  getProductContent,
  type ContentMedia,
  type LivePhotoInput,
} from "@/services/productContentService";
import { uploadImage } from "@/services/uploadService";

export interface LivePhotosChange {
  /** null = las fotos del live no cambiaron (no se guardan). */
  photos: LivePhotoInput[] | null;
  /** true mientras se sube una foto: la ventana no se guarda hasta que termine. */
  uploading: boolean;
}

const tileButton =
  "min-w-0 flex-1 rounded-md bg-white/95 px-1 py-1 text-[11px] font-semibold text-slate-800 hover:bg-white disabled:opacity-50";

/**
 * FEAT-32 M7 (spec §7.13, mockup de Live) — «Fotos que se ven en el live (elige hasta 3)» en la ventana «Editar
 * producto» de POWIP Live. Se eligen de la galería del producto (ms-products); «＋ Subir nueva» guarda la foto en
 * el producto. La elección se guarda junto con la ventana (`onChange` → `PUT …/content/live-photos`). Solo el
 * Administrador u Operaciones la cambian; el resto la ve en solo lectura.
 */
export default function LiveProductPhotos({
  productId,
  storeId,
  disabled,
  onChange,
}: {
  productId: string;
  storeId: string;
  disabled?: boolean;
  onChange: (change: LivePhotosChange) => void;
}) {
  const queryClient = useQueryClient();
  // Misma clave que la pestaña Contenido de la ficha: una foto subida acá se ve allá sin recargar.
  const content = useQuery({
    queryKey: ["product-content", productId],
    queryFn: ({ signal }) => getProductContent(productId, signal),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const effective = useQuery({
    queryKey: ["product-content-effective", productId, storeId, "POWIP_LIVE"],
    queryFn: ({ signal }) => getEffectiveContent(productId, storeId, "POWIP_LIVE", signal),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const [initial, setInitial] = useState<LivePhotosState | null>(null);
  const [state, setState] = useState<LivePhotosState | null>(null);
  const [uploaded, setUploaded] = useState<ContentMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gallery = useMemo(() => {
    const base = content.data ? galleryPhotos(content.data.media) : [];
    const urls = new Set(base.map((item) => item.url));
    return [...base, ...uploaded.filter((item) => !urls.has(item.url))];
  }, [content.data, uploaded]);

  // La elección de hoy se toma una sola vez (las relecturas, p. ej. tras subir una foto, no la pisan).
  useEffect(() => {
    if (initial || !content.data || effective.isPending) return;
    const start = initialLivePhotos(content.data, storeId, effective.data?.photos ?? null);
    setInitial(start);
    setState(start);
  }, [initial, content.data, effective.isPending, effective.data, storeId]);

  const report = useRef(onChange);
  report.current = onChange;
  useEffect(() => {
    const changed = Boolean(initial && state && livePhotosChanged(initial, state));
    report.current({ photos: changed && state ? livePhotosBody(state, gallery) : null, uploading });
  }, [initial, state, gallery, uploading]);

  const title = <h3 className="text-sm font-semibold">Fotos que se ven en el live (elige hasta 3)</h3>;
  const fichaLink = (
    <a
      href={`/productos/${encodeURIComponent(productId)}?tab=contenido`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs font-semibold text-[#027778] hover:underline"
    >
      Editar en la ficha del producto ↗
    </a>
  );

  if (content.isError) {
    return (
      <section className="space-y-2 rounded-xl border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">{title}{fichaLink}</div>
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          No se pudieron cargar las fotos del producto. {apiErrorInfo(content.error, "").message}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void content.refetch()}>
          Reintentar
        </Button>
      </section>
    );
  }
  if (!content.data || !state) {
    return (
      <section className="space-y-2 rounded-xl border p-3">
        {title}
        <p role="status" className="text-sm text-muted-foreground">Cargando fotos del producto…</p>
      </section>
    );
  }

  const canEdit = content.data.canEdit;
  // Mientras se guarda la ventana o se sube una foto, los controles quedan a la vista pero deshabilitados.
  const locked = Boolean(disabled) || uploading;
  const full = state.chosen.length >= LIVE_MAX_PHOTOS;
  const galleryIndex = new Map(gallery.map((item, index) => [item.url, index]));

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const problem = photoFileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    if (gallery.length >= MAX_PHOTOS) {
      setError(`La galería ya tiene ${MAX_PHOTOS} fotos: quita una en la ficha del producto.`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const [url, size] = await Promise.all([uploadImage(file), imageFileSize(file)]);
      const item = await addContentPhoto(productId, {
        url,
        fileName: file.name.slice(0, 200),
        widthPx: size?.width ?? null,
        heightPx: size?.height ?? null,
        sizeBytes: file.size,
      });
      setUploaded((list) => [...list.filter((photo) => photo.url !== item.url), item]);
      setState((current) => (current ? chooseLivePhoto(current, { id: item.id, url: item.url }) : current));
      toast.success("Foto guardada en la galería del producto.");
      void queryClient.invalidateQueries({ queryKey: ["product-content", productId] });
    } catch (cause) {
      setError(apiErrorInfo(cause, "No se pudo subir la foto.").message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border p-3" aria-label="Fotos que se ven en el live">
      <div className="flex flex-wrap items-center justify-between gap-2">{title}{fichaLink}</div>
      {!state.explicit ? (
        <p className="text-xs text-muted-foreground">Sin elegir: se ven las 3 primeras</p>
      ) : canEdit ? (
        <button
          type="button"
          className="text-xs font-medium text-[#027778] hover:underline disabled:opacity-50"
          disabled={locked}
          onClick={() => setState(resetLivePhotos(gallery))}
        >
          Volver a las 3 primeras
        </button>
      ) : null}
      {state.chosen.length ? (
        <ol className="grid grid-cols-3 gap-2" aria-label="Fotos elegidas para el live">
          {state.chosen.map((photo, index) => (
            <li key={photo.url} className="relative aspect-square overflow-hidden rounded-xl border bg-muted/40">
              {/* eslint-disable-next-line @next/next/no-img-element -- fotos del producto de cualquier origen */}
              <img src={photo.url} alt={`Foto ${index + 1} del live`} className="h-full w-full object-cover" loading="lazy" />
              {index === 0 ? (
                <span className="absolute left-1.5 top-1.5 rounded-md bg-[#027778] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  Principal
                </span>
              ) : (
                <span className="absolute left-1.5 top-1.5 rounded-md bg-white/90 px-1.5 text-[11px] font-bold text-slate-800">{index + 1}</span>
              )}
              {canEdit ? (
                <div className="absolute inset-x-0 bottom-0 flex gap-[3px] bg-gradient-to-b from-transparent to-black/50 p-1.5">
                  {index > 0 ? (
                    <button
                      type="button"
                      className={tileButton}
                      disabled={locked}
                      title="Pasar a principal"
                      aria-label={`Pasar la foto ${index + 1} a principal`}
                      onClick={() => setState((current) => (current ? makeLivePrincipal(current, photo.url) : current))}
                    >
                      ★
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={tileButton}
                    disabled={locked}
                    aria-label={`Quitar la foto ${index + 1} del live`}
                    onClick={() => setState((current) => (current ? dropLivePhoto(current, photo.url, gallery) : current))}
                  >
                    Quitar
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-muted-foreground">El producto todavía no tiene fotos.</p>
      )}

      <div className="space-y-1.5">
        <h4 className="text-xs font-semibold text-muted-foreground">Fotos del producto ({gallery.length})</h4>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
          {gallery.map((photo) => {
            const index = galleryIndex.get(photo.url) ?? 0;
            const chosen = isChosen(state, photo.url);
            const blocked = !chosen && full;
            return (
              <button
                key={photo.url}
                type="button"
                disabled={!canEdit || locked || chosen || blocked}
                title={chosen ? "Ya se ve en el live" : blocked ? "Quita una para elegir otra" : "Elegir para el live"}
                aria-label={chosen ? `Foto ${index + 1} del producto: ya se ve en el live` : `Elegir la foto ${index + 1} del producto para el live`}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-lg border",
                  chosen && "ring-2 ring-[#027778]",
                  blocked && "opacity-50",
                  canEdit && !locked && !chosen && !blocked && "hover:ring-2 hover:ring-[#027778]/60",
                )}
                onClick={() => setState((current) => (current ? chooseLivePhoto(current, { id: photo.id, url: photo.url }) : current))}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                {chosen ? (
                  <span className="absolute inset-x-0 bottom-0 bg-[#027778] text-center text-[10px] font-semibold text-white">✓ En el live</span>
                ) : null}
              </button>
            );
          })}
          {canEdit && gallery.length < MAX_PHOTOS ? (
            <label
              className={cn(
                "grid aspect-square cursor-pointer place-content-center rounded-lg border-[1.5px] border-dashed border-slate-300 bg-slate-50 text-center text-[11px] font-semibold text-[#027778] hover:bg-slate-100 dark:bg-muted/30",
                locked && "pointer-events-none opacity-60",
              )}
            >
              <input
                type="file"
                accept={PHOTO_TYPES.join(",")}
                hidden
                disabled={locked}
                aria-label="Subir nueva foto"
                onChange={(event) => {
                  void upload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              {uploading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" aria-label="Subiendo foto" /> : "＋ Subir nueva"}
            </label>
          ) : null}
        </div>
        {canEdit && full ? <p className="text-xs text-muted-foreground">Quita una para elegir otra.</p> : null}
      </div>

      {error ? <p role="alert" className="text-xs text-red-600">{error}</p> : null}
      <p className="text-xs text-muted-foreground">
        Las fotos son del producto: se ven igual en todas sus variantes.
        {canEdit ? " Una foto subida aquí queda en la galería del producto (JPG, PNG o WebP de hasta 5 MB)." : ""}
      </p>
      {!content.data.canEdit ? (
        <p className="text-xs text-muted-foreground">Solo el Administrador u Operaciones pueden cambiar las fotos del live.</p>
      ) : null}
    </section>
  );
}
