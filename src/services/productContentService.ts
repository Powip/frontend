import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

/**
 * FEAT-32 M1 — contenido del producto en ms-products (JWT, empresa del token): galería, título, descripciones,
 * características y lo propio de cada canal. Leer: cualquier usuario de la empresa; guardar: Administrador u
 * Operaciones. Desde el primer guardado POWIP es el dueño del contenido (Shopify ya no lo pisa).
 */
const products = () => process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products;

export type MediaKind = "photo" | "video";
export type MediaOrigin = "uploaded" | "youtube" | "tiktok" | "shopify" | "imported";
export type OverrideField = "media" | "videos" | "title" | "short_description" | "description_html" | "features" | "attributes";

export interface ContentMedia {
  /** `null` mientras el contenido no se guardó (fotos que vienen del producto). */
  id: string | null;
  kind: MediaKind;
  origin: MediaOrigin;
  url: string;
  fileName: string | null;
  position: number;
  optionName: string | null;
  optionValue: string | null;
  whiteBackground: boolean;
  widthPx: number | null;
  heightPx: number | null;
  sizeBytes: number | null;
}

export interface ContentOverride {
  storeId: string;
  channel: string;
  field: OverrideField;
  value: unknown;
}

export interface ProductContentView {
  productId: string;
  /** false = todavía nadie guardó la pestaña Contenido (se muestra lo del producto). */
  materialized: boolean;
  /** `external_source` del producto (`manual` si no tiene). */
  source: string;
  title: string;
  shortDescription: string;
  descriptionHtml: string;
  features: string[];
  media: ContentMedia[];
  photoOption: { name: string; values: string[] } | null;
  attributes: Record<string, string>;
  /** Lo propio de cada canal (FEAT-32 M7: sin POWIP Live, que va en `livePhotos`). */
  overrides: ContentOverride[];
  /** FEAT-32 M7 — fotos elegidas en POWIP Live por tienda (ids de la galería). Vacío o ausente = sin elegir. */
  livePhotos?: Array<{ storeId: string; mediaIds: string[] }>;
  limits: { photos: number; videos: number; photoBytes: number };
  canEdit: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface SaveContentMedia {
  id: string;
  kind: MediaKind;
  url: string;
  origin?: "uploaded" | "shopify" | "imported";
  fileName?: string | null;
  optionValue?: string | null;
  whiteBackground?: boolean;
  widthPx?: number | null;
  heightPx?: number | null;
  sizeBytes?: number | null;
}

export interface SaveProductContentBody {
  title: string;
  shortDescription: string;
  descriptionHtml: string;
  features: string[];
  media: SaveContentMedia[];
  overrides: ContentOverride[];
}

export async function getProductContent(productId: string, signal?: AbortSignal): Promise<ProductContentView> {
  const { data } = await axiosAuth.get(`${products()}/products/${encodeURIComponent(productId)}/content`, { signal });
  if (!data || typeof data.title !== "string" || !Array.isArray(data.media)) throw new Error("No se pudo leer el contenido del producto.");
  return data as ProductContentView;
}

export async function saveProductContent(productId: string, body: SaveProductContentBody): Promise<ProductContentView> {
  const { data } = await axiosAuth.put(`${products()}/products/${encodeURIComponent(productId)}/content`, body);
  return data as ProductContentView;
}

/** FEAT-32 M7 — contenido efectivo de un canal en una tienda (lo que hoy ve ese canal). */
export interface EffectiveContentView {
  productId: string;
  storeId: string | null;
  channel: string | null;
  title: string;
  shortDescription: string;
  descriptionHtml: string;
  features: string[];
  /** En POWIP Live, hasta 3: las elegidas o, sin elección, las 3 primeras de la galería. */
  photos: ContentMedia[];
  videos: ContentMedia[];
}

/** Foto elegida para el live: se busca por `id` y, si es null (producto sin contenido guardado), por `url`. */
export interface LivePhotoInput {
  id: string | null;
  url: string;
}

export interface AddContentPhotoBody {
  url: string;
  fileName?: string | null;
  widthPx?: number | null;
  heightPx?: number | null;
  sizeBytes?: number | null;
}

const contentPath = (productId: string) => `${products()}/products/${encodeURIComponent(productId)}/content`;

export async function getEffectiveContent(productId: string, storeId: string, channel: string, signal?: AbortSignal): Promise<EffectiveContentView> {
  const { data } = await axiosAuth.get(`${contentPath(productId)}/effective`, { params: { storeId, channel }, signal });
  if (!data || !Array.isArray(data.photos)) throw new Error("No se pudo leer el contenido del producto.");
  return data as EffectiveContentView;
}

/** `PUT …/content/live-photos`: hasta 3 en orden (la primera es la principal); `[]` = volver a las 3 primeras. */
export async function saveLivePhotos(productId: string, body: { storeId: string; photos: LivePhotoInput[] }): Promise<EffectiveContentView> {
  const { data } = await axiosAuth.put(`${contentPath(productId)}/live-photos`, body);
  return data as EffectiveContentView;
}

/** `POST …/content/media`: suma una foto ya subida al final de la galería (si la URL ya estaba, devuelve esa). */
export async function addContentPhoto(productId: string, body: AddContentPhotoBody): Promise<ContentMedia> {
  const { data } = await axiosAuth.post(`${contentPath(productId)}/media`, body);
  if (!data || typeof data.url !== "string") throw new Error("No se pudo agregar la foto a la galería.");
  return data as ContentMedia;
}
