import type { ContentMedia, LivePhotoInput, ProductContentView } from "@/services/productContentService";

/**
 * FEAT-32 M7 (spec §6.2 y §7.13) — fotos de POWIP Live: hasta 3 elegidas de la galería del producto, por tienda.
 * La primera es la «Principal». Sin elección, el live muestra las 3 primeras de la galería.
 */
export const LIVE_MAX_PHOTOS = 3;

/** Una foto se identifica por su URL: un producto sin contenido guardado trae sus fotos con `id: null`. */
export interface LivePhotoRef {
  id: string | null;
  url: string;
}

export interface LivePhotosState {
  /** false = sin elegir: el live muestra las 3 primeras de la galería. */
  explicit: boolean;
  chosen: LivePhotoRef[];
}

const sameStore = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Fotos de la galería en orden (la primera es la principal del producto). */
export function galleryPhotos(media: readonly ContentMedia[]): ContentMedia[] {
  return media.filter((item) => item.kind === "photo").sort((a, b) => a.position - b.position);
}

/** Ids elegidos para el live en la tienda (vacío = sin elegir). */
export function liveMediaIds(view: Pick<ProductContentView, "livePhotos">, storeId: string): string[] {
  return (view.livePhotos ?? []).find((row) => sameStore(row.storeId, storeId))?.mediaIds ?? [];
}

const ref = (item: { id: string | null; url: string }): LivePhotoRef => ({ id: item.id ?? null, url: item.url });

/** Las 3 primeras de la galería (lo que el live muestra sin elección). */
export function defaultLivePhotos(gallery: readonly ContentMedia[]): LivePhotoRef[] {
  return gallery.slice(0, LIVE_MAX_PHOTOS).map(ref);
}

/**
 * Estado inicial de la ventana. `effective` son las fotos que hoy ve el live (`…/content/effective`); si no se
 * pudieron leer, se arman con la elección guardada (o las 3 primeras).
 */
export function initialLivePhotos(view: Pick<ProductContentView, "livePhotos" | "media">, storeId: string, effective?: readonly ContentMedia[] | null): LivePhotosState {
  const gallery = galleryPhotos(view.media);
  const ids = liveMediaIds(view, storeId);
  const explicit = ids.length > 0;
  if (effective) return { explicit, chosen: effective.slice(0, LIVE_MAX_PHOTOS).map(ref) };
  if (!explicit) return { explicit, chosen: defaultLivePhotos(gallery) };
  const byId = new Map(gallery.filter((item) => item.id).map((item) => [item.id as string, item]));
  const chosen = ids.map((id) => byId.get(id)).filter((item): item is ContentMedia => Boolean(item)).slice(0, LIVE_MAX_PHOTOS).map(ref);
  return chosen.length ? { explicit, chosen } : { explicit: false, chosen: defaultLivePhotos(gallery) };
}

export const isChosen = (state: LivePhotosState, url: string) => state.chosen.some((item) => item.url === url);

/** Agrega al final de las elegidas (máximo 3; una repetida no cambia nada). */
export function chooseLivePhoto(state: LivePhotosState, photo: LivePhotoRef): LivePhotosState {
  if (state.chosen.length >= LIVE_MAX_PHOTOS || isChosen(state, photo.url)) return state;
  return { explicit: true, chosen: [...state.chosen, ref(photo)] };
}

/** «Quitar». Si no queda ninguna, vuelve a «sin elegir» (las 3 primeras de la galería). */
export function dropLivePhoto(state: LivePhotosState, url: string, gallery: readonly ContentMedia[]): LivePhotosState {
  const chosen = state.chosen.filter((item) => item.url !== url);
  if (chosen.length === state.chosen.length) return state;
  return chosen.length ? { explicit: true, chosen } : { explicit: false, chosen: defaultLivePhotos(gallery) };
}

/** «★»: pasa la foto a principal (primera). */
export function makeLivePrincipal(state: LivePhotosState, url: string): LivePhotosState {
  const index = state.chosen.findIndex((item) => item.url === url);
  if (index <= 0) return state;
  return { explicit: true, chosen: [state.chosen[index], ...state.chosen.filter((_, i) => i !== index)] };
}

/** «Volver a las 3 primeras». */
export function resetLivePhotos(gallery: readonly ContentMedia[]): LivePhotosState {
  return { explicit: false, chosen: defaultLivePhotos(gallery) };
}

/** ¿Hay que guardar? Sin elegir → sin elegir no cambia nada, aunque la galería haya cambiado. */
export function livePhotosChanged(before: LivePhotosState, after: LivePhotosState): boolean {
  if (before.explicit !== after.explicit) return true;
  if (!after.explicit) return false;
  return before.chosen.map((item) => item.url).join("\n") !== after.chosen.map((item) => item.url).join("\n");
}

/**
 * Cuerpo de `PUT …/content/live-photos`: `{ id, url }` de cada elegida, con el `id` de la galería si ya lo tiene
 * (p. ej. tras subir una foto el producto pasa a tener contenido guardado). Sin elegir = `[]`.
 */
export function livePhotosBody(state: LivePhotosState, gallery: readonly ContentMedia[]): LivePhotoInput[] {
  if (!state.explicit) return [];
  const byUrl = new Map(gallery.map((item) => [item.url, item]));
  return state.chosen.map((item) => ({ id: byUrl.get(item.url)?.id ?? item.id ?? null, url: item.url }));
}
