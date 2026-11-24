import type {
  ContentMedia,
  ContentOverride,
  MediaKind,
  MediaOrigin,
  OverrideField,
  ProductContentView,
  SaveProductContentBody,
} from "@/services/productContentService";

/**
 * FEAT-32 M1 — lógica pura de la pestaña Contenido (spec «Contenido multicanal» v1.2, mockup `multi.html`):
 * borrador editable, lo propio de cada canal, contenido efectivo, validaciones (las mismas que ms-products) y
 * el saneado del HTML de la descripción en el navegador (misma lista blanca que el backend).
 */

export const MAX_PHOTOS = 12;
export const MAX_VIDEOS = 3;
export const TITLE_MAX = 200;
export const SHORT_DESCRIPTION_MAX = 300;
export const MAX_FEATURES = 30;
export const FEATURE_MAX = 200;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Canales de la fase 1 (todos de POWIP: muestran el contenido al instante, sin publicar). */
export interface ContentChannel {
  code: "POWIP_LIVE" | "POWIP_CRM" | "CATALOGO_WEB";
  name: string;
  /** false = no admite contenido propio (POWIP Live elige sus fotos en Live). */
  overridable: boolean;
  usage: string;
}

export const CONTENT_CHANNELS: ContentChannel[] = [
  { code: "POWIP_LIVE", name: "POWIP Live", overridable: false, usage: "Hasta 3 fotos elegidas en POWIP Live" },
  { code: "POWIP_CRM", name: "POWIP CRM", overridable: true, usage: "Al instante, sin publicar" },
  { code: "CATALOGO_WEB", name: "Catálogo web", overridable: true, usage: "Al instante, sin publicar" },
];

export interface DraftMedia {
  /** Siempre con id: a las fotos que vienen del producto (sin guardar) se les genera uno. */
  id: string;
  kind: MediaKind;
  origin: MediaOrigin;
  url: string;
  fileName: string | null;
  optionValue: string | null;
  whiteBackground: boolean;
  widthPx: number | null;
  heightPx: number | null;
  sizeBytes: number | null;
}

/** Campos que la pantalla deja personalizar por canal en la fase 1 (los atributos vienen en la fase 3). */
export type ChannelField = Exclude<OverrideField, "attributes">;
export const CHANNEL_FIELDS: ChannelField[] = ["media", "videos", "title", "short_description", "description_html", "features"];

export type ChannelValues = Partial<Record<OverrideField, unknown>>;

export interface ContentDraft {
  title: string;
  shortDescription: string;
  descriptionHtml: string;
  features: string[];
  /** Fotos en orden (la primera es la principal) y después los videos en orden. */
  media: DraftMedia[];
  /** Clave `storeId|CANAL`. */
  overrides: Record<string, ChannelValues>;
}

export const channelKey = (storeId: string, channel: string) => `${storeId.toLowerCase()}|${channel}`;

export function parseChannelKey(key: string): { storeId: string; channel: string } {
  const [storeId, channel] = key.split("|");
  return { storeId, channel };
}

const newId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

export function draftFromView(view: ProductContentView, makeId: () => string = newId): ContentDraft {
  const media: DraftMedia[] = [...ordered(view.media, "photo"), ...ordered(view.media, "video")].map((item) => ({
    id: item.id ?? makeId(),
    kind: item.kind,
    origin: item.origin,
    url: item.url,
    fileName: item.fileName,
    optionValue: item.optionValue,
    whiteBackground: item.whiteBackground,
    widthPx: item.widthPx,
    heightPx: item.heightPx,
    sizeBytes: item.sizeBytes,
  }));
  const overrides: Record<string, ChannelValues> = {};
  for (const item of view.overrides) {
    const key = channelKey(item.storeId, item.channel);
    overrides[key] = { ...(overrides[key] ?? {}), [item.field]: item.value };
  }
  return {
    title: view.title,
    shortDescription: view.shortDescription,
    descriptionHtml: view.descriptionHtml,
    features: [...view.features],
    media,
    overrides,
  };
}

function ordered(media: ContentMedia[], kind: MediaKind): ContentMedia[] {
  return media.filter((item) => item.kind === kind).sort((a, b) => a.position - b.position);
}

export const photosOf = (draft: Pick<ContentDraft, "media">) => draft.media.filter((item) => item.kind === "photo");
export const videosOf = (draft: Pick<ContentDraft, "media">) => draft.media.filter((item) => item.kind === "video");

/** Igualdad para «Cambios sin guardar» (orden de las claves de canales indistinto). */
export function sameDraft(a: ContentDraft, b: ContentDraft): boolean {
  return stableJson(a) === stableJson(b);
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y)))
      : inner,
  );
}

// ---------------------------------------------------------------------------------------------------------
// Galería
// ---------------------------------------------------------------------------------------------------------

function withKinds(draft: ContentDraft, photos: DraftMedia[], videos: DraftMedia[]): ContentDraft {
  return { ...draft, media: [...photos, ...videos] };
}

/** Mueve la foto `index` a `index + delta` (‹ ›). */
export function movePhoto(draft: ContentDraft, index: number, delta: number): ContentDraft {
  const photos = photosOf(draft);
  const target = index + delta;
  if (index < 0 || index >= photos.length || target < 0 || target >= photos.length) return draft;
  const next = [...photos];
  [next[index], next[target]] = [next[target], next[index]];
  return withKinds(draft, next, videosOf(draft));
}

/** ★ Poner como principal. */
export function makePrincipal(draft: ContentDraft, index: number): ContentDraft {
  const photos = photosOf(draft);
  if (index <= 0 || index >= photos.length) return draft;
  const next = [photos[index], ...photos.filter((_, i) => i !== index)];
  return withKinds(draft, next, videosOf(draft));
}

export function updateMedia(draft: ContentDraft, id: string, patch: Partial<Pick<DraftMedia, "optionValue" | "whiteBackground">>): ContentDraft {
  return { ...draft, media: draft.media.map((item) => (item.id === id ? { ...item, ...patch } : item)) };
}

/** Quita una foto o un video de la galería y de la selección de cada canal (si un canal queda sin fotos, vuelve a las de por defecto). */
export function removeMedia(draft: ContentDraft, id: string): ContentDraft {
  const overrides: Record<string, ChannelValues> = {};
  for (const [key, values] of Object.entries(draft.overrides)) {
    const next: ChannelValues = { ...values };
    for (const field of ["media", "videos"] as const) {
      const list = next[field];
      if (!Array.isArray(list)) continue;
      const kept = (list as string[]).filter((item) => item !== id);
      if (kept.length === 0 && field === "media") delete next[field];
      else next[field] = kept;
    }
    if (Object.keys(next).length) overrides[key] = next;
  }
  return { ...draft, media: draft.media.filter((item) => item.id !== id), overrides };
}

/**
 * FEAT-32 M7 (spec §5.1: «Al quitar una foto que está elegida en POWIP Live o en un canal, se quita también de
 * ahí y se avisa») — avisos por las fotos quitadas de la galería (`baseline` → `draft`) que hoy se ven en POWIP
 * Live (`livePhotos`) o están elegidas en un canal (lo propio con `media`).
 */
export function removedPhotoWarnings(
  baseline: ContentDraft,
  draft: ContentDraft,
  livePhotos: ReadonlyArray<{ storeId: string; mediaIds: string[] }> = [],
  channelName: (key: string) => string = (key) => key,
): string[] {
  const kept = new Set(photosOf(draft).map((item) => item.id));
  const removed = new Set(photosOf(baseline).map((item) => item.id).filter((id) => !kept.has(id)));
  if (!removed.size) return [];
  const count = (ids: Iterable<string>) => new Set([...ids].filter((id) => removed.has(id))).size;
  const warnings: string[] = [];
  const inLive = count(livePhotos.flatMap((row) => row.mediaIds));
  if (inLive === 1) warnings.push("Esta foto se ve en POWIP Live: al guardar, se quita también del live.");
  else if (inLive > 1) warnings.push(`${inLive} de las fotos que quitaste se ven en POWIP Live: al guardar, se quitan también del live.`);
  for (const [key, values] of Object.entries(baseline.overrides)) {
    if (!Array.isArray(values.media)) continue;
    const inChannel = count(values.media as string[]);
    const name = channelName(key);
    if (inChannel === 1) warnings.push(`Esta foto se ve en ${name}: al guardar, se quita también de ese canal.`);
    else if (inChannel > 1) warnings.push(`${inChannel} de las fotos que quitaste se ven en ${name}: al guardar, se quitan también de ese canal.`);
  }
  return warnings;
}

/** Agrega fotos al final (las que no entran en las 12 se descartan y se informa cuántas). */
export function addPhotos(draft: ContentDraft, photos: Omit<DraftMedia, "id" | "kind">[], makeId: () => string = newId): { draft: ContentDraft; skipped: number } {
  const current = photosOf(draft);
  const room = Math.max(0, MAX_PHOTOS - current.length);
  const urls = new Set(current.map((item) => item.url));
  const fresh = photos.filter((item) => !urls.has(item.url));
  const added = fresh.slice(0, room).map((item) => ({ ...item, id: makeId(), kind: "photo" as const }));
  return { draft: withKinds(draft, [...current, ...added], videosOf(draft)), skipped: photos.length - added.length };
}

/** Agrega un video por link (YouTube o TikTok). Devuelve el error para mostrar, o el borrador nuevo. */
export function addVideoLink(draft: ContentDraft, url: string, makeId: () => string = newId): { draft: ContentDraft } | { error: string } {
  const link = url.trim();
  const origin = videoLinkOrigin(link);
  if (!origin) return { error: "Pega un link de YouTube o TikTok que empiece con https://" };
  const videos = videosOf(draft);
  if (videos.length >= MAX_VIDEOS) return { error: `Puedes agregar hasta ${MAX_VIDEOS} videos.` };
  if (videos.some((item) => item.url === link)) return { error: "Ese video ya está agregado." };
  const video: DraftMedia = {
    id: makeId(),
    kind: "video",
    origin,
    url: link,
    fileName: null,
    optionValue: null,
    whiteBackground: false,
    widthPx: null,
    heightPx: null,
    sizeBytes: null,
  };
  return { draft: withKinds(draft, photosOf(draft), [...videos, video]) };
}

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);
const TIKTOK_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"]);

/** Mismo criterio que ms-products: solo https de YouTube o TikTok, sin usuario ni contraseña en el link. */
export function videoLinkOrigin(value: unknown): "youtube" | "tiktok" | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be") return url.pathname.length > 1 ? "youtube" : null;
  if (YOUTUBE_HOSTS.has(host)) {
    if (url.pathname === "/watch") return url.searchParams.get("v") ? "youtube" : null;
    return /^\/(shorts|embed|live)\/[\w-]+/.test(url.pathname) ? "youtube" : null;
  }
  if (TIKTOK_HOSTS.has(host)) return url.pathname.length > 1 ? "tiktok" : null;
  return null;
}

/** Validación de un archivo de foto antes de subirlo (spec §5.1). */
export function photoFileProblem(file: Pick<File, "type" | "size" | "name">): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return `«${file.name}» no es JPG, PNG ni WebP.`;
  if (file.size > PHOTO_MAX_BYTES) return `«${file.name}» pesa más de 5 MB.`;
  return null;
}

/** Ancho y alto de una foto antes de subirla (null si el navegador no puede leerla). */
export async function imageFileSize(file: File): Promise<{ width: number; height: number } | null> {
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

// ---------------------------------------------------------------------------------------------------------
// Canales
// ---------------------------------------------------------------------------------------------------------

/** Valor del campo de `Por defecto` en la forma en que se guarda como propio de un canal. */
export function defaultFieldValue(draft: ContentDraft, field: ChannelField): unknown {
  switch (field) {
    case "media":
      return photosOf(draft).map((item) => item.id);
    case "videos":
      return videosOf(draft).map((item) => item.id);
    case "title":
      return draft.title;
    case "short_description":
      return draft.shortDescription;
    case "description_html":
      return draft.descriptionHtml;
    case "features":
      return [...draft.features];
  }
}

/** «Personalizar para el canal»: copia lo de por defecto como punto de partida. */
export function customizeField(draft: ContentDraft, key: string, field: ChannelField): ContentDraft {
  const current = draft.overrides[key] ?? {};
  return { ...draft, overrides: { ...draft.overrides, [key]: { ...current, [field]: defaultFieldValue(draft, field) } } };
}

/** «Volver al de por defecto». */
export function resetField(draft: ContentDraft, key: string, field: OverrideField): ContentDraft {
  const current = { ...(draft.overrides[key] ?? {}) };
  delete current[field];
  const overrides = { ...draft.overrides };
  if (Object.keys(current).length) overrides[key] = current;
  else delete overrides[key];
  return { ...draft, overrides };
}

export function setChannelValue(draft: ContentDraft, key: string, field: OverrideField, value: unknown): ContentDraft {
  return { ...draft, overrides: { ...draft.overrides, [key]: { ...(draft.overrides[key] ?? {}), [field]: value } } };
}

export const isOwn = (draft: ContentDraft, key: string | null, field: OverrideField) =>
  key !== null && draft.overrides[key] !== undefined && field in draft.overrides[key];

export interface EffectiveDraft {
  title: string;
  shortDescription: string;
  descriptionHtml: string;
  features: string[];
  photos: DraftMedia[];
  videos: DraftMedia[];
}

/** Lo que usa el canal (`key` null = Por defecto): lo propio o, si no tiene, lo de por defecto. */
export function effectiveDraft(draft: ContentDraft, key: string | null): EffectiveDraft {
  const own = key ? draft.overrides[key] ?? {} : {};
  const pick = (field: "media" | "videos", kind: MediaKind) => {
    const all = draft.media.filter((item) => item.kind === kind);
    const ids = own[field];
    if (!Array.isArray(ids)) return all;
    const byId = new Map(all.map((item) => [item.id, item]));
    const chosen = (ids as string[]).map((id) => byId.get(id)).filter((item): item is DraftMedia => Boolean(item));
    return chosen.length || field === "videos" ? chosen : all;
  };
  return {
    title: typeof own.title === "string" ? own.title : draft.title,
    shortDescription: typeof own.short_description === "string" ? own.short_description : draft.shortDescription,
    descriptionHtml: typeof own.description_html === "string" ? own.description_html : draft.descriptionHtml,
    features: Array.isArray(own.features) ? (own.features as string[]) : draft.features,
    photos: pick("media", "photo"),
    videos: pick("videos", "video"),
  };
}

/** Mueve un id dentro de la selección propia de un canal. */
export function moveInList(list: string[], index: number, delta: number): string[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// ---------------------------------------------------------------------------------------------------------
// Guardar
// ---------------------------------------------------------------------------------------------------------

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

export function cleanFeatures(list: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const text = squash(raw);
    const key = text.toLocaleLowerCase("es");
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

/** Problemas que impiden guardar (los mismos que rechaza ms-products, en palabras de la pantalla). */
export function draftProblems(draft: ContentDraft, channelName: (key: string) => string = (key) => key): string[] {
  const problems: string[] = [];
  const title = squash(draft.title);
  if (!title) problems.push("Escribe el título que ve el cliente.");
  if (title.length > TITLE_MAX) problems.push(`El título puede tener hasta ${TITLE_MAX} caracteres.`);
  if (squash(draft.shortDescription).length > SHORT_DESCRIPTION_MAX) problems.push(`La descripción corta puede tener hasta ${SHORT_DESCRIPTION_MAX} caracteres.`);
  const features = cleanFeatures(draft.features);
  if (features.length > MAX_FEATURES) problems.push(`Puedes cargar hasta ${MAX_FEATURES} características.`);
  if (features.some((item) => item.length > FEATURE_MAX)) problems.push(`Cada característica puede tener hasta ${FEATURE_MAX} caracteres.`);
  if (photosOf(draft).length > MAX_PHOTOS) problems.push(`Puedes subir hasta ${MAX_PHOTOS} fotos.`);
  if (videosOf(draft).length > MAX_VIDEOS) problems.push(`Puedes agregar hasta ${MAX_VIDEOS} videos.`);
  for (const [key, values] of Object.entries(draft.overrides)) {
    const name = channelName(key);
    if ("title" in values) {
      const own = typeof values.title === "string" ? squash(values.title) : "";
      if (!own) problems.push(`Escribe el título de ${name} o vuelve al de por defecto.`);
      else if (own.length > TITLE_MAX) problems.push(`El título de ${name} puede tener hasta ${TITLE_MAX} caracteres.`);
    }
    if (typeof values.short_description === "string" && squash(values.short_description).length > SHORT_DESCRIPTION_MAX) {
      problems.push(`La descripción corta de ${name} puede tener hasta ${SHORT_DESCRIPTION_MAX} caracteres.`);
    }
    if (Array.isArray(values.media) && values.media.length === 0) problems.push(`Elige al menos una foto para ${name} o vuelve a las de por defecto.`);
  }
  return problems;
}

/** Cuerpo de `PUT /products/:id/content`. */
export function buildSaveBody(draft: ContentDraft): SaveProductContentBody {
  const overrides: ContentOverride[] = [];
  for (const [key, values] of Object.entries(draft.overrides)) {
    const { storeId, channel } = parseChannelKey(key);
    for (const [field, raw] of Object.entries(values) as Array<[OverrideField, unknown]>) {
      let value = raw;
      if (field === "title" && typeof raw === "string") value = squash(raw);
      if (field === "short_description" && typeof raw === "string") value = squash(raw);
      if (field === "features" && Array.isArray(raw)) value = cleanFeatures(raw);
      if (field === "description_html" && typeof raw === "string") value = sanitizeDescriptionHtml(raw);
      overrides.push({ storeId, channel, field, value });
    }
  }
  return {
    title: squash(draft.title),
    shortDescription: squash(draft.shortDescription),
    descriptionHtml: sanitizeDescriptionHtml(draft.descriptionHtml),
    features: cleanFeatures(draft.features),
    media: draft.media.map((item) => ({
      id: item.id,
      kind: item.kind,
      url: item.url,
      ...(item.kind === "photo"
        ? {
            origin: item.origin === "youtube" || item.origin === "tiktok" ? undefined : item.origin,
            fileName: item.fileName,
            optionValue: item.optionValue,
            whiteBackground: item.whiteBackground,
            widthPx: item.widthPx,
            heightPx: item.heightPx,
            sizeBytes: item.sizeBytes,
          }
        : {}),
    })),
    overrides,
  };
}

/** Texto de cuándo y quién guardó por última vez. */
export function lastSavedLabel(view: Pick<ProductContentView, "updatedAt" | "updatedBy">): string | null {
  if (!view.updatedAt) return null;
  const when = new Date(view.updatedAt);
  if (Number.isNaN(when.getTime())) return null;
  const date = when.toLocaleString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return `Guardado el ${date}${view.updatedBy ? ` por ${view.updatedBy}` : ""}`;
}

// ---------------------------------------------------------------------------------------------------------
// HTML de la descripción (misma lista blanca que ms-products, `content-html.ts`)
// ---------------------------------------------------------------------------------------------------------

const ALLOWED_TAGS = new Set([
  "h2", "h3", "h4", "p", "br", "strong", "b", "em", "i", "u", "s", "sup", "sub", "ul", "ol", "li", "a",
  "img", "span", "div", "blockquote", "hr", "table", "thead", "tbody", "tfoot", "tr", "td", "th",
  "colgroup", "col", "caption", "figure", "figcaption",
]);
/** Se van con todo su contenido. */
const DROPPED_TAGS = new Set([
  "script", "style", "textarea", "option", "noscript", "title", "svg", "iframe", "video", "audio", "select",
  "button", "object", "embed", "template", "head", "meta", "link", "math", "frame", "frameset", "applet", "base",
]);
const RENAMED_TAGS: Record<string, string> = { h1: "h2", h5: "h4", h6: "h4", font: "span" };
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "width", "height"],
  td: ["colspan", "rowspan", "width"],
  th: ["colspan", "rowspan", "width"],
  col: ["span", "width"],
  table: ["width"],
};
const COLOR = [/^#(0x)?[0-9a-f]{3,8}$/i, /^rgba?\(\s*[\d.%\s,]+\)$/i, /^[a-z]{3,20}$/i];
const STYLE_RULES: Record<string, RegExp[]> = {
  color: COLOR,
  "background-color": COLOR,
  "text-align": [/^(left|right|center|justify)$/i],
  "font-weight": [/^(normal|bold|bolder|lighter|[1-9]00)$/i],
  "font-style": [/^(normal|italic|oblique)$/i],
  "text-decoration": [/^(none|underline|line-through)$/i],
  "font-size": [/^\d{1,3}(\.\d{1,2})?(px|em|rem|%|pt)$/i],
};

function cleanStyle(style: string): string {
  return style
    .split(";")
    .map((rule) => {
      const at = rule.indexOf(":");
      if (at < 0) return null;
      const name = rule.slice(0, at).trim().toLowerCase();
      const value = rule.slice(at + 1).trim();
      return STYLE_RULES[name]?.some((pattern) => pattern.test(value)) ? `${name}:${value}` : null;
    })
    .filter(Boolean)
    .join(";");
}

function safeUrl(value: string, tag: string): boolean {
  const text = value.trim();
  if (/^https?:\/\//i.test(text)) return true;
  return tag === "a" && /^(mailto|tel):/i.test(text);
}

/**
 * Sanea el HTML de la descripción en un documento inerte (`DOMParser` no ejecuta scripts ni carga imágenes).
 * Se usa antes de mostrarlo en el editor y antes de guardarlo; el backend vuelve a sanearlo igual.
 */
export function sanitizeDescriptionHtml(html: string | null | undefined): string {
  if (typeof html !== "string" || !html.trim()) return "";
  if (typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  for (const element of Array.from(doc.body.querySelectorAll("*"))) {
    if (!element.isConnected) continue;
    let tag = element.tagName.toLowerCase();
    if (DROPPED_TAGS.has(tag)) {
      element.remove();
      continue;
    }
    let current: Element = element;
    if (RENAMED_TAGS[tag]) {
      const renamed = doc.createElement(RENAMED_TAGS[tag]);
      if (tag === "font" && element.getAttribute("color")) renamed.setAttribute("style", `color: ${element.getAttribute("color")}`);
      else for (const attribute of Array.from(element.attributes)) renamed.setAttribute(attribute.name, attribute.value);
      while (element.firstChild) renamed.appendChild(element.firstChild);
      element.replaceWith(renamed);
      current = renamed;
      tag = renamed.tagName.toLowerCase();
    }
    if (!ALLOWED_TAGS.has(tag)) {
      current.replaceWith(...Array.from(current.childNodes));
      continue;
    }
    const allowed = ALLOWED_ATTRIBUTES[tag] ?? [];
    for (const attribute of Array.from(current.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name === "style") {
        const style = cleanStyle(attribute.value);
        if (style) current.setAttribute("style", style);
        else current.removeAttribute("style");
        continue;
      }
      if (!allowed.includes(name)) {
        current.removeAttribute(attribute.name);
        continue;
      }
      if ((name === "href" || name === "src") && !safeUrl(attribute.value, tag)) current.removeAttribute(attribute.name);
    }
    if (tag === "a") {
      if (current.getAttribute("target") && current.getAttribute("target") !== "_blank") current.removeAttribute("target");
      if (current.getAttribute("target") === "_blank") current.setAttribute("rel", "noopener noreferrer");
      else current.removeAttribute("rel");
    }
  }
  // Comentarios fuera.
  const walker = doc.createTreeWalker(doc.body, 128 /* NodeFilter.SHOW_COMMENT */);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((comment) => comment.parentNode?.removeChild(comment));
  return doc.body.innerHTML.trim();
}

/** Texto plano de un HTML (para la vista previa y los contadores). */
export function htmlToText(html: string): string {
  if (!html) return "";
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  // Un espacio después de cada bloque para que «<p>a</p><p>b</p>» no quede «ab».
  const spaced = html.replace(/<\/(p|div|h[1-6]|li|tr|td|th|blockquote|figcaption)>|<br\s*\/?>/gi, "$& ");
  const doc = new DOMParser().parseFromString(`<body>${spaced}</body>`, "text/html");
  doc.body.querySelectorAll("script,style").forEach((node) => node.remove());
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Descripción escrita como texto (p. ej. en «Crear producto») → párrafos HTML. Si ya es HTML, se deja igual. */
export function plainTextToHtml(text: string): string {
  const value = text.trim();
  if (!value) return "";
  if (/<\/?[a-z][\s\S]*>/i.test(value)) return value;
  const escape = (line: string) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return value
    .split(/\r?\n\s*\r?\n/)
    .map((block) => `<p>${block.split(/\r?\n/).map(escape).join("<br>")}</p>`)
    .join("");
}
