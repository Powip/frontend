"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getChannelSummary } from "@/services/productChannelsService";
import { toast } from "sonner";
import { Loader2, Play } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import {
  CONTENT_CHANNELS,
  FEATURE_MAX,
  MAX_VIDEOS,
  SHORT_DESCRIPTION_MAX,
  TITLE_MAX,
  addVideoLink,
  buildSaveBody,
  channelKey,
  customizeField,
  draftFromView,
  draftProblems,
  effectiveDraft,
  isOwn,
  lastSavedLabel,
  parseChannelKey,
  removeMedia,
  resetField,
  sameDraft,
  setChannelValue,
  videosOf,
  type ChannelField,
  type ContentDraft,
  type DraftMedia,
} from "@/lib/catalog/productContent";
import { getProductContent, saveProductContent, type ProductContentView } from "@/services/productContentService";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import type { CatalogVariantDetail } from "@/services/catalogProductService";
import ContentPhotos from "./content/ContentPhotos";
import DescriptionEditor from "./content/DescriptionEditor";

type Updater = ContentDraft | ((current: ContentDraft) => ContentDraft);

interface ChannelOption {
  key: string;
  code: string;
  name: string;
  overridable: boolean;
  /** FEAT-32 M2 — false = el producto está desactivado en este canal y tienda. */
  active: boolean;
}

const money = (value: number) => `S/ ${value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Section({ title, aside, children, readOnly }: { title: ReactNode; aside?: ReactNode; children: ReactNode; readOnly?: boolean }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-2.5 border-b px-4 py-3">
        <h4 className="min-w-[140px] flex-1 text-[15px] font-semibold">{title}</h4>
        {aside}
      </div>
      <div className={cn("px-4 py-4", readOnly && "opacity-95")}>{children}</div>
    </section>
  );
}

const Pill = ({ tone, children }: { tone: "teal" | "purple" | "gray"; children: ReactNode }) => (
  <span
    className={cn(
      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
      tone === "teal" && "bg-[#e7f3f3] text-[#015d5e] dark:bg-teal-950/50 dark:text-teal-200",
      tone === "purple" && "bg-[#efecfb] text-[#4C2FB5] dark:bg-violet-950/50 dark:text-violet-200",
      tone === "gray" && "bg-muted text-muted-foreground",
    )}
  >
    {children}
  </span>
);

/** «N caracteres»; pasado el tope, en rojo con el tope. */
const Counter = ({ length, max }: { length: number; max: number }) => (
  <p className={cn("text-right text-xs", length > max ? "font-semibold text-red-600" : "text-muted-foreground")}>
    {length > max ? `${length} / ${max}` : length} caracteres
  </p>
);

/**
 * FEAT-32 M1 — pestaña Contenido de la ficha (spec «Contenido multicanal» v1.2 §5.2, mockup `multi.html`):
 * fotos (hasta 12, por color), videos (links de YouTube o TikTok), título que ve el cliente, descripción corta,
 * descripción (HTML), características y atributos, con «Por defecto» para todos los canales y lo propio de
 * cada canal de POWIP. Queda montada al cambiar de pestaña (el borrador no se pierde) y bloquea la salida con
 * cambios sin guardar.
 */
export default function FichaContentTab({
  productId,
  variants,
  onDirtyChange,
  onGoToChannels,
}: {
  productId: string;
  variants: CatalogVariantDetail[];
  onDirtyChange?: (dirty: boolean) => void;
  /** Abre la pestaña Canales de la ficha. */
  onGoToChannels?: () => void;
}) {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const stores = useMemo(() => auth?.company?.stores ?? [], [auth?.company?.stores]);
  const query = useQuery({
    queryKey: ["product-content", productId],
    queryFn: ({ signal }) => getProductContent(productId, signal),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  // FEAT-32 M2 — canales desactivados para este producto (sin fila = activo).
  const summary = useQuery({
    queryKey: ["product-channel-summary", auth?.company?.id ?? ""],
    queryFn: ({ signal }) => getChannelSummary(signal),
    retry: false,
    staleTime: 60_000,
  });
  const inactive = useMemo(
    () => new Set((summary.data?.channels ?? []).filter((row) => row.productId === productId && !row.active).map((row) => channelKey(row.storeId, row.channel))),
    [summary.data, productId],
  );

  const [baseline, setBaseline] = useState<ContentDraft | null>(null);
  const [draft, setDraftState] = useState<ContentDraft | null>(null);
  const [view, setView] = useState<ProductContentView | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"vis" | "html">("vis");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const dirty = Boolean(draft && baseline && !sameDraft(draft, baseline));
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  const { dialog } = useUnsavedChangesGuard(dirty);

  // Toma lo del servidor la primera vez y cada vez que se relee SIN cambios pendientes.
  useEffect(() => {
    if (!query.data) return;
    if (draft && baseline && !sameDraft(draft, baseline)) return;
    const fresh = draftFromView(query.data);
    setView(query.data);
    setBaseline(fresh);
    setDraftState(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al llegar datos nuevos
  }, [query.data]);

  const setDraft = useCallback((next: Updater) => {
    setDraftState((current) => (current ? (typeof next === "function" ? next(current) : next) : current));
    setErrors([]);
  }, []);

  const channels: ChannelOption[] = useMemo(
    () =>
      stores.flatMap((store) =>
        CONTENT_CHANNELS.map((channel) => ({
          key: channelKey(store.id, channel.code),
          code: channel.code,
          name: stores.length > 1 ? `${channel.name} · ${store.name}` : channel.name,
          overridable: channel.overridable,
          active: !inactive.has(channelKey(store.id, channel.code)),
        })),
      ),
    [stores, inactive],
  );
  const channel = selected ? channels.find((option) => option.key === selected) ?? null : null;
  const channelName = useCallback(
    (key: string) => channels.find((option) => option.key === key)?.name ?? CONTENT_CHANNELS.find((c) => c.code === parseChannelKey(key).channel)?.name ?? "el canal",
    [channels],
  );
  const priceRange = useMemo(() => {
    const prices = variants
      .filter((variant) => variant.isActive !== false && !variant.mergedInto)
      .map((variant) => Number(variant.priceVta))
      .filter((price) => Number.isFinite(price) && price > 0);
    if (!prices.length) return null;
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [variants]);

  if (query.error) {
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p>No se pudo leer el contenido del producto. {apiErrorInfo(query.error, "").message}</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Reintentar</Button>
      </div>
    );
  }
  if (!draft || !view || !baseline) return <p role="status" className="text-sm">Cargando contenido...</p>;

  const canEdit = view.canEdit;
  const key = channel ? channel.key : null;
  const isLive = channel?.code === "POWIP_LIVE";
  const editable = (field: ChannelField) => canEdit && !isLive && (key === null || isOwn(draft, key, field));
  const effective = effectiveDraft(draft, key);
  const own = key ? draft.overrides[key] ?? {} : {};

  const sectionAside = (field: ChannelField): ReactNode => {
    if (!channel) return null;
    if (isLive) {
      return field === "media" ? (
        <>
          <Pill tone="teal">Heredado de Por defecto</Pill>
          <Button variant="outline" size="sm" asChild><Link href="/live">Elegir las 3 del live en POWIP Live</Link></Button>
        </>
      ) : <Pill tone="teal">Heredado de Por defecto</Pill>;
    }
    if (isOwn(draft, key, field)) {
      return (
        <>
          <Pill tone="purple">Propio de {channel.name}</Pill>
          {canEdit ? <button type="button" className="text-xs font-medium text-primary underline-offset-2 hover:underline" onClick={() => setDraft((current) => resetField(current, channel.key, field))}>Volver al de por defecto</button> : null}
        </>
      );
    }
    return (
      <>
        <Pill tone="teal">Heredado de Por defecto</Pill>
        {canEdit ? <Button variant="outline" size="sm" onClick={() => setDraft((current) => customizeField(current, channel.key, field))}>Personalizar para {channel.name}</Button> : null}
      </>
    );
  };

  // Escribe en Por defecto o en lo propio del canal, según dónde se esté editando.
  const writeText = (field: "title" | "short_description" | "description_html", value: string) => {
    if (key) {
      setDraft((current) => setChannelValue(current, key, field, value));
      return;
    }
    const prop = field === "title" ? "title" : field === "short_description" ? "shortDescription" : "descriptionHtml";
    setDraft((current) => ({ ...current, [prop]: value }));
  };
  const writeFeatures = (features: string[]) => {
    if (key) setDraft((current) => setChannelValue(current, key, "features", features));
    else setDraft((current) => ({ ...current, features }));
  };

  const addVideo = () => {
    const result = addVideoLink(draft, videoUrl);
    if ("error" in result) {
      setVideoError(result.error);
      return;
    }
    setDraft(result.draft);
    setVideoUrl("");
    setVideoError(null);
  };

  const discard = () => {
    setDraftState(baseline);
    setErrors([]);
    setVideoError(null);
  };

  const save = async () => {
    const problems = draftProblems(draft, channelName);
    setErrors(problems);
    if (problems.length) return;
    setSaving(true);
    try {
      const saved = await saveProductContent(productId, buildSaveBody(draft));
      const fresh = draftFromView(saved);
      setView(saved);
      setBaseline(fresh);
      setDraftState(fresh);
      queryClient.setQueryData(["product-content", productId], saved);
      toast.success("✓ Guardado. POWIP Live, CRM y Catálogo ya lo muestran.");
      // La foto principal, la descripción y las fotos de las variantes quedan como espejo en el producto.
      void queryClient.invalidateQueries({ queryKey: ["catalog-product"] });
      void queryClient.invalidateQueries({ queryKey: ["catalog-product-variants", productId] });
      void queryClient.invalidateQueries({ queryKey: ["business-product-catalog"] });
    } catch (error) {
      setErrors([apiErrorInfo(error, "No se pudo guardar el contenido.").message]);
    } finally {
      setSaving(false);
    }
  };

  const ownVideoIds = Array.isArray(own.videos) ? (own.videos as string[]) : null;
  const allVideos = videosOf(draft);
  const shownVideos: DraftMedia[] = effective.videos;
  const features = effective.features;
  const titleValue = effective.title;
  const shortValue = effective.shortDescription;
  const preview = effective.photos[0];
  const note = !channel
    ? "Lo que escribas aquí lo usan todos los canales. En cada canal puedes cambiar solo lo que haga falta."
    : isLive
      ? "En POWIP Live se eligen hasta 3 de estas fotos y el precio live, desde POWIP Live › Productos del live."
      : "Este canal muestra el contenido al instante, sin publicar. Cambia aquí solo lo que necesite distinto: lo demás se hereda de Por defecto.";
  const saved = lastSavedLabel(view);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border bg-card px-4 py-3.5">
        <Label htmlFor="content-channel" className="font-semibold">Canal</Label>
        <select
          id="content-channel"
          className="h-9 min-w-[260px] rounded-md border bg-background px-3 text-sm"
          value={selected ?? ""}
          onChange={(event) => setSelected(event.target.value || null)}
        >
          <option value="">Por defecto · lo usan todos los canales</option>
          {channels.map((option) => <option key={option.key} value={option.key}>{option.name}{option.active ? "" : " (no activado)"}</option>)}
        </select>
        <span className="min-w-[200px] flex-1 text-xs text-muted-foreground">{note}</span>
      </div>

      {channel && !channel.active ? (
        <div role="status" className="rounded-xl bg-[#fff4dc] px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          El producto no está activado en {channel.name}. Puedes preparar el contenido y activarlo en la pestaña{" "}
          {onGoToChannels ? <button type="button" className="font-semibold underline" onClick={onGoToChannels}>Canales</button> : "Canales"}.
        </div>
      ) : null}
      {!view.materialized && view.source === "shopify" && canEdit ? (
        <div className="rounded-xl bg-[#fff4dc] px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Hoy las fotos y la descripción de este producto vienen de <b>Shopify</b>. Cuando guardes aquí, <b>POWIP pasa a ser el dueño del contenido</b>: lo que cambies después en Shopify (fotos y descripción) ya no se copia a POWIP. El nombre, los precios y el stock siguen sincronizándose como siempre.
        </div>
      ) : null}
      {!canEdit ? <div className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Solo el Administrador u Operaciones pueden editar el contenido. Aquí ves cómo está cargado.</div> : null}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3.5">
          <Section title={<>Fotos <span className="text-xs font-normal text-muted-foreground">({effective.photos.length} de 12)</span></>} aside={sectionAside("media")}>
            <ContentPhotos
              draft={draft}
              onChange={setDraft}
              editable={editable("media")}
              channel={channel && !isLive ? { key: channel.key, name: channel.name, ownIds: Array.isArray(own.media) ? (own.media as string[]) : null } : null}
              photoOption={view.photoOption}
            />
          </Section>

          <Section title={<>Videos <span className="text-xs font-normal text-muted-foreground">({shownVideos.length} de {MAX_VIDEOS})</span></>} aside={sectionAside("videos")}>
            <div className="space-y-2">
              {(ownVideoIds ? allVideos : shownVideos).length ? (
                (ownVideoIds ? allVideos : shownVideos).map((video) => {
                  const inChannel = !ownVideoIds || ownVideoIds.includes(video.id);
                  return (
                    <div key={video.id} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5", !inChannel && "opacity-60")}>
                      <span className="grid h-11 w-16 flex-none place-items-center rounded-lg bg-slate-800 text-white"><Play className="h-4 w-4" aria-hidden /></span>
                      <div className="min-w-0 flex-1">
                        <a href={video.url} target="_blank" rel="noopener noreferrer" className="block break-all text-sm font-semibold hover:underline">{video.url}</a>
                        <small className="text-xs text-muted-foreground">{video.origin === "youtube" ? "YouTube" : "TikTok"}</small>
                      </div>
                      {ownVideoIds && editable("videos") ? (
                        <label className="flex items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={inChannel}
                            onChange={(event) =>
                              setDraft((current) =>
                                setChannelValue(current, key as string, "videos", event.target.checked ? allVideos.filter((v) => v.id === video.id || ownVideoIds.includes(v.id)).map((v) => v.id) : ownVideoIds.filter((id) => id !== video.id)),
                              )
                            }
                          />
                          Mostrar en {channel?.name}
                        </label>
                      ) : null}
                      {!key && editable("videos") ? <Button variant="outline" size="sm" className="text-red-600" onClick={() => setDraft((current) => removeMedia(current, video.id))}>Quitar</Button> : null}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">Sin videos.</p>
              )}
              {!key && editable("videos") && allVideos.length < MAX_VIDEOS ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex flex-wrap gap-2">
                    <Input
                      className="min-w-[240px] flex-1"
                      placeholder="Pega un link de YouTube o TikTok"
                      aria-label="Link del video"
                      value={videoUrl}
                      onChange={(event) => { setVideoUrl(event.target.value); setVideoError(null); }}
                      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addVideo(); } }}
                    />
                    <Button type="button" variant="outline" onClick={addVideo} disabled={!videoUrl.trim()}>＋ Agregar link</Button>
                  </div>
                  {videoError ? <p role="alert" className="text-xs text-red-600">{videoError}</p> : null}
                  <p className="text-xs text-muted-foreground">Por ahora los videos se agregan como link (YouTube o TikTok). Mostrar el producto puesto es lo que más ayuda a vender en el live y en el chat.</p>
                </div>
              ) : null}
            </div>
          </Section>

          <Section title="Título que ve el cliente" aside={sectionAside("title")}>
            <Input
              aria-label="Título que ve el cliente"
              value={titleValue}
              maxLength={TITLE_MAX + 50}
              readOnly={!editable("title")}
              onChange={(event) => writeText("title", event.target.value)}
            />
            <Counter length={titleValue.length} max={TITLE_MAX} />
          </Section>

          <Section title="Descripción corta" aside={sectionAside("short_description")}>
            <Textarea
              aria-label="Descripción corta"
              className="min-h-[70px]"
              value={shortValue}
              readOnly={!editable("short_description")}
              onChange={(event) => writeText("short_description", event.target.value)}
            />
            <div className="mt-1 flex items-start justify-between gap-3">
              <p className="text-xs text-muted-foreground">Una o dos líneas. Se ve en la tarjeta del producto en el live, el chat y el catálogo.</p>
              <Counter length={shortValue.length} max={SHORT_DESCRIPTION_MAX} />
            </div>
          </Section>

          <Section title="Descripción" aside={sectionAside("description_html")}>
            <DescriptionEditor
              key={key ?? "default"}
              label="Descripción"
              value={effective.descriptionHtml}
              editable={editable("description_html")}
              mode={mode}
              onMode={setMode}
              onChange={(html) => writeText("description_html", html)}
            />
          </Section>

          <Section title="Características" aside={sectionAside("features")}>
            <div className="space-y-2">
              {features.length ? (
                features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-[#027778]" aria-hidden>•</span>
                    <Input
                      aria-label={`Característica ${index + 1}`}
                      value={feature}
                      maxLength={FEATURE_MAX}
                      readOnly={!editable("features")}
                      onChange={(event) => writeFeatures(features.map((item, i) => (i === index ? event.target.value : item)))}
                    />
                    {editable("features") ? <Button variant="outline" size="sm" aria-label="Quitar característica" onClick={() => writeFeatures(features.filter((_, i) => i !== index))}>✕</Button> : null}
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Sin características.</p>
              )}
              {editable("features") && features.length < 30 ? (
                <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => writeFeatures([...features, ""])}>＋ Agregar característica</button>
              ) : null}
            </div>
          </Section>

          <Section title="Atributos">
            {Object.keys(view.attributes).length ? (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Object.entries(view.attributes).map(([name, value]) => (
                  <div key={name} className="space-y-1">
                    <dt className="text-xs font-medium text-muted-foreground">{name}</dt>
                    <dd className="rounded-md border bg-muted/30 px-3 py-1.5 text-sm">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">Sin atributos.</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Salen de la marca y de las opciones de las variantes: se cambian en General y en «Editar opciones y precios». Los que pida cada marketplace se completan aquí cuando se conecte (fase 3).</p>
          </Section>
        </div>

        <aside className="grid gap-3.5 xl:sticky xl:top-4">
          <div className="rounded-2xl border bg-card p-4">
            <h3 className="text-[15px] font-semibold">Así se ve{channel ? ` en ${channel.name}` : " en el Catálogo web"}</h3>
            <div className="mt-2.5 overflow-hidden rounded-xl border">
              <div className="grid h-[150px] place-items-center bg-muted/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {preview ? <img src={preview.url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-muted-foreground">Sin foto</span>}
              </div>
              <div className="space-y-1 p-3">
                <b className="block text-sm">{titleValue.trim() || "Sin título"}</b>
                <p className="text-sm font-semibold text-[#4C2FB5]">
                  {priceRange ? (priceRange.min === priceRange.max ? money(priceRange.min) : `Desde ${money(priceRange.min)}`) : "—"}
                </p>
                {shortValue.trim() ? <p className="text-xs text-muted-foreground">{shortValue}</p> : null}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <h3 className="text-[15px] font-semibold">Dónde se usa</h3>
            <div className="mt-1.5 divide-y">
              {CONTENT_CHANNELS.map((item) => (
                <div key={item.code} className="flex items-start gap-2 py-2 text-sm">
                  <div className="flex-1">
                    <b className="font-semibold">{item.name}</b>
                    <small className="block text-xs text-muted-foreground">{item.usage}</small>
                  </div>
                  {item.code !== "POWIP_LIVE" && stores.length > 0 && stores.every((store) => inactive.has(channelKey(store.id, item.code))) ? (
                    <Pill tone="gray">No activado</Pill>
                  ) : (
                    <Pill tone="teal">Al día</Pill>
                  )}
                </div>
              ))}
              {view.source === "shopify" ? (
                <div className="flex items-start gap-2 py-2 text-sm">
                  <div className="flex-1">
                    <b className="font-semibold">Shopify</b>
                    <small className="block text-xs text-muted-foreground">Por ahora Shopify maneja su propia ficha: POWIP le envía solo el stock. Publicar el contenido en Shopify llega en la fase 2.</small>
                  </div>
                  <Pill tone="gray">Sin publicar</Pill>
                </div>
              ) : null}
            </div>
            {onGoToChannels ? (
              <Button type="button" variant="outline" className="mt-2.5 w-full" onClick={onGoToChannels}>Ir a Canales y precios →</Button>
            ) : null}
          </div>
          {saved ? <p className="px-1 text-xs text-muted-foreground">{saved}</p> : null}
        </aside>
      </div>

      {errors.length ? (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      ) : null}

      {canEdit && dirty ? (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-[#fff4dc] px-4 py-3 shadow-lg dark:border-amber-900 dark:bg-amber-950">
          <span className="flex-1 text-sm font-semibold text-amber-900 dark:text-amber-100">Cambios sin guardar en el contenido</span>
          <Button variant="outline" onClick={discard} disabled={saving}>Descartar</Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar cambios
          </Button>
        </div>
      ) : null}
      {dialog}
    </div>
  );
}
