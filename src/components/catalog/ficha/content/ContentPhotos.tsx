"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadImage } from "@/services/uploadService";
import {
  MAX_PHOTOS,
  PHOTO_TYPES,
  addPhotos,
  makePrincipal,
  movePhoto,
  moveInList,
  photoFileProblem,
  photosOf,
  removeMedia,
  setChannelValue,
  updateMedia,
  type ContentDraft,
  type DraftMedia,
} from "@/lib/catalog/productContent";

async function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  try {
    if (typeof createImageBitmap !== "function") return null;
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

const tileButton = "min-w-0 flex-1 rounded-md bg-white/95 px-1 py-1 text-[11px] font-semibold text-slate-800 hover:bg-white disabled:opacity-50";

function PhotoTile({ photo, index, children, badge }: { photo: DraftMedia; index: number; children?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted/40">
      {/* eslint-disable-next-line @next/next/no-img-element -- fotos de Shopify/Supabase de cualquier tamaño */}
      <img src={photo.url} alt={photo.fileName ?? `Foto ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
      {index === 0 ? (
        <span className="absolute left-1.5 top-1.5 rounded-md bg-[#027778] px-1.5 py-0.5 text-[11px] font-semibold text-white">Principal</span>
      ) : (
        <span className="absolute left-1.5 top-1.5 rounded-md bg-white/90 px-1.5 text-[11px] font-bold text-slate-800">{index + 1}</span>
      )}
      {badge}
      {children ? <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-[3px] bg-gradient-to-b from-transparent to-black/50 p-1.5">{children}</div> : null}
    </div>
  );
}

/**
 * FEAT-32 M1 (spec §5.1) — fotos del producto: hasta 12, la primera es la principal, cada una con su color (u
 * opción de fotos) y la marca de fondo blanco. En un canal con fotos propias se eligen y ordenan las de la galería.
 */
export default function ContentPhotos({
  draft,
  onChange,
  editable,
  channel,
  photoOption,
}: {
  draft: ContentDraft;
  onChange: (next: ContentDraft | ((current: ContentDraft) => ContentDraft)) => void;
  /** Se puede editar lo que se ve (Por defecto con permiso, o un canal con fotos propias). */
  editable: boolean;
  /** Canal elegido con fotos propias (null = Por defecto o canal que hereda). */
  channel: { key: string; name: string; ownIds: string[] | null } | null;
  photoOption: { name: string; values: string[] } | null;
}) {
  const [uploading, setUploading] = useState(0);
  const gallery = photosOf(draft);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    const room = MAX_PHOTOS - gallery.length;
    const problems = list.map(photoFileProblem).filter((problem): problem is string => Boolean(problem));
    problems.forEach((problem) => toast.error(problem));
    const valid = list.filter((file) => !photoFileProblem(file)).slice(0, Math.max(0, room));
    if (list.length - problems.length > valid.length) toast.error(`Solo entran ${MAX_PHOTOS} fotos: se subieron las primeras ${valid.length}.`);
    if (!valid.length) return;
    setUploading(valid.length);
    const uploaded: Array<Omit<DraftMedia, "id" | "kind">> = [];
    for (const file of valid) {
      try {
        const [url, size] = await Promise.all([uploadImage(file), imageSize(file)]);
        uploaded.push({
          origin: "uploaded",
          url,
          fileName: file.name.slice(0, 200),
          optionValue: null,
          whiteBackground: false,
          widthPx: size?.width ?? null,
          heightPx: size?.height ?? null,
          sizeBytes: file.size,
        });
      } catch (error) {
        toast.error(`No se pudo subir «${file.name}». ${error instanceof Error ? error.message : ""}`);
      } finally {
        setUploading((count) => Math.max(0, count - 1));
      }
    }
    if (uploaded.length) onChange((current) => addPhotos(current, uploaded).draft);
  };

  // Canal con fotos propias: elige y ordena entre las de la galería.
  if (channel?.ownIds) {
    const byId = new Map(gallery.map((photo) => [photo.id, photo]));
    const chosen = channel.ownIds.map((id) => byId.get(id)).filter((photo): photo is DraftMedia => Boolean(photo));
    const rest = gallery.filter((photo) => !channel.ownIds?.includes(photo.id));
    const setIds = (ids: string[]) => onChange((current) => setChannelValue(current, channel.key, "media", ids));
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2.5">
          {chosen.map((photo, index) => (
            <PhotoTile key={photo.id} photo={photo} index={index}>
              {editable ? (
                <>
                  {index > 0 ? <button type="button" className={tileButton} title="Mover a la izquierda" aria-label="Mover a la izquierda" onClick={() => setIds(moveInList(chosen.map((p) => p.id), index, -1))}>‹</button> : null}
                  {index < chosen.length - 1 ? <button type="button" className={tileButton} title="Mover a la derecha" aria-label="Mover a la derecha" onClick={() => setIds(moveInList(chosen.map((p) => p.id), index, 1))}>›</button> : null}
                  {chosen.length > 1 ? <button type="button" className={tileButton} title={`No usar en ${channel.name}`} aria-label={`No usar en ${channel.name}`} onClick={() => setIds(chosen.filter((p) => p.id !== photo.id).map((p) => p.id))}>✕</button> : null}
                </>
              ) : null}
            </PhotoTile>
          ))}
        </div>
        {editable && rest.length ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Otras fotos de la galería (toca una para usarla en {channel.name}):</p>
            <div className="flex flex-wrap gap-2">
              {rest.map((photo) => (
                <button key={photo.id} type="button" title={`Usar en ${channel.name}`} aria-label={`Usar en ${channel.name}`} className="relative h-16 w-16 overflow-hidden rounded-lg border opacity-70 hover:opacity-100" onClick={() => setIds([...chosen.map((p) => p.id), photo.id])}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 grid place-items-center bg-black/30 text-lg font-bold text-white">＋</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">Las fotos nuevas se suben en «Por defecto» y después se eligen acá.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2.5">
        {gallery.map((photo, index) => (
          <PhotoTile
            key={photo.id}
            photo={photo}
            index={index}
            badge={
              <span className={cn("absolute right-1.5 top-1.5 max-w-[60%] truncate rounded-md border px-1.5 text-[10.5px] font-semibold", photo.whiteBackground ? "border-green-200 bg-green-50 text-green-700" : "bg-white text-slate-600")}>
                {photo.whiteBackground ? "✓ Fondo blanco" : photo.optionValue || "Todos"}
              </span>
            }
          >
            {editable ? (
              <>
                {index > 0 ? <button type="button" className={tileButton} title="Poner como principal" aria-label="Poner como principal" onClick={() => onChange((current) => makePrincipal(current, index))}>★</button> : null}
                {index > 0 ? <button type="button" className={tileButton} title="Mover a la izquierda" aria-label="Mover a la izquierda" onClick={() => onChange((current) => movePhoto(current, index, -1))}>‹</button> : null}
                {index < gallery.length - 1 ? <button type="button" className={tileButton} title="Mover a la derecha" aria-label="Mover a la derecha" onClick={() => onChange((current) => movePhoto(current, index, 1))}>›</button> : null}
                <button type="button" className={tileButton} title={photo.whiteBackground ? "Quitar marca de fondo blanco" : "Marcar como fondo blanco"} onClick={() => onChange((current) => updateMedia(current, photo.id, { whiteBackground: !photo.whiteBackground }))}>
                  {photo.whiteBackground ? "✓ Blanco" : "Blanco"}
                </button>
                <button type="button" className={tileButton} title="Quitar foto" aria-label="Quitar foto" onClick={() => onChange((current) => removeMedia(current, photo.id))}>✕</button>
                {photoOption ? (
                  <select
                    aria-label={`${photoOption.name} de la foto ${index + 1}`}
                    className={cn(tileButton, "basis-full")}
                    value={photo.optionValue ?? ""}
                    onChange={(event) => onChange((current) => updateMedia(current, photo.id, { optionValue: event.target.value || null }))}
                  >
                    <option value="">{`Todos (${photoOption.name.toLowerCase()})`}</option>
                    {photoOption.values.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                ) : null}
              </>
            ) : null}
          </PhotoTile>
        ))}
        {Array.from({ length: uploading }, (_, index) => (
          <div key={`up-${index}`} className="grid aspect-square place-items-center rounded-xl border border-dashed text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin" aria-label="Subiendo foto" />
          </div>
        ))}
        {editable && gallery.length + uploading < MAX_PHOTOS ? (
          <label className="grid aspect-square cursor-pointer place-content-center gap-0.5 rounded-xl border-[1.5px] border-dashed border-slate-300 bg-slate-50 text-center text-2xl text-[#027778] hover:bg-slate-100 dark:bg-muted/30">
            <input type="file" accept={PHOTO_TYPES.join(",")} multiple hidden onChange={(event) => { void upload(event.target.files); event.target.value = ""; }} />
            <span aria-hidden>＋</span>
            <small className="block text-xs text-muted-foreground">Subir fotos</small>
          </label>
        ) : null}
      </div>
      {!gallery.length && !editable ? <p className="text-xs text-muted-foreground">Sin fotos.</p> : null}
      <p className="text-xs text-muted-foreground">
        JPG, PNG o WebP de hasta 5 MB. La primera es la principal.
        {photoOption ? ` A cada foto le asignas su ${photoOption.name.toLowerCase()} para que el cliente vea la foto correcta al elegir la variante.` : ""}
        {" "}«Blanco» marca las fotos con fondo blanco (lo piden algunos marketplaces).
      </p>
    </div>
  );
}
