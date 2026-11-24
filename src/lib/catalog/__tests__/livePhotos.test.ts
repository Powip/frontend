import {
  chooseLivePhoto,
  dropLivePhoto,
  galleryPhotos,
  initialLivePhotos,
  livePhotosBody,
  livePhotosChanged,
  liveMediaIds,
  makeLivePrincipal,
  resetLivePhotos,
} from "../livePhotos";
import { fichaTabFromQuery } from "../fichaTabs";
import type { ContentMedia } from "@/services/productContentService";

const STORE = "44444444-4444-4444-8444-444444444444";

const photo = (n: number, id: string | null = `m${n}`): ContentMedia => ({
  id,
  kind: "photo",
  origin: "uploaded",
  url: `https://cdn/x/${n}.jpg`,
  fileName: null,
  position: n,
  optionName: null,
  optionValue: null,
  whiteBackground: false,
  widthPx: null,
  heightPx: null,
  sizeBytes: null,
});
const VIDEO: ContentMedia = { ...photo(9), kind: "video", origin: "youtube", url: "https://youtu.be/a", position: 0 };
const GALLERY = [photo(3), photo(1), photo(2), photo(4), VIDEO];
const urls = (list: Array<{ url: string }>) => list.map((item) => item.url.replace("https://cdn/x/", ""));

describe("Fotos de POWIP Live (FEAT-32 M7, spec §7.13)", () => {
  it("la galería son las fotos en orden; la elección se busca por tienda sin importar mayúsculas", () => {
    expect(urls(galleryPhotos(GALLERY))).toEqual(["1.jpg", "2.jpg", "3.jpg", "4.jpg"]);
    expect(liveMediaIds({ livePhotos: [{ storeId: STORE.toUpperCase(), mediaIds: ["m4"] }] }, STORE)).toEqual(["m4"]);
    expect(liveMediaIds({}, STORE)).toEqual([]);
  });

  it("sin elección se ven las 3 primeras; con elección, las elegidas (o las del contenido efectivo)", () => {
    expect(initialLivePhotos({ media: GALLERY, livePhotos: [] }, STORE)).toEqual({
      explicit: false,
      chosen: [photo(1), photo(2), photo(3)].map(({ id, url }) => ({ id, url })),
    });
    const chosen = initialLivePhotos({ media: GALLERY, livePhotos: [{ storeId: STORE, mediaIds: ["m4", "m2", "gone"] }] }, STORE);
    expect(chosen.explicit).toBe(true);
    expect(urls(chosen.chosen)).toEqual(["4.jpg", "2.jpg"]);
    const effective = initialLivePhotos({ media: GALLERY, livePhotos: [{ storeId: STORE, mediaIds: ["m4"] }] }, STORE, [photo(4)]);
    expect(effective).toEqual({ explicit: true, chosen: [{ id: "m4", url: "https://cdn/x/4.jpg" }] });
  });

  it("elegir hasta 3, ★ pasa a principal y quitar la última vuelve a las 3 primeras", () => {
    const gallery = galleryPhotos(GALLERY);
    let state = initialLivePhotos({ media: GALLERY }, STORE);
    expect(chooseLivePhoto(state, photo(4))).toBe(state); // ya hay 3
    state = dropLivePhoto(state, photo(2).url, gallery);
    expect(state.explicit).toBe(true);
    state = chooseLivePhoto(state, photo(4));
    expect(urls(state.chosen)).toEqual(["1.jpg", "3.jpg", "4.jpg"]);
    expect(chooseLivePhoto({ ...state, chosen: state.chosen.slice(0, 1) }, photo(1)).chosen).toHaveLength(1); // repetida
    state = makeLivePrincipal(state, photo(4).url);
    expect(urls(state.chosen)).toEqual(["4.jpg", "1.jpg", "3.jpg"]);
    for (const n of [4, 1, 3]) state = dropLivePhoto(state, photo(n).url, gallery);
    expect(state).toEqual(resetLivePhotos(gallery));
    expect(state.explicit).toBe(false);
  });

  it("solo se guarda si cambió; sin elegir manda [] y cada foto va con su id (o null) y su URL", () => {
    const gallery = galleryPhotos(GALLERY);
    const start = initialLivePhotos({ media: GALLERY }, STORE);
    expect(livePhotosChanged(start, start)).toBe(false);
    const picked = makeLivePrincipal(start, photo(3).url);
    expect(livePhotosChanged(start, picked)).toBe(true);
    expect(livePhotosBody(picked, gallery)).toEqual([
      { id: "m3", url: "https://cdn/x/3.jpg" },
      { id: "m1", url: "https://cdn/x/1.jpg" },
      { id: "m2", url: "https://cdn/x/2.jpg" },
    ]);
    // Producto sin contenido guardado: las fotos vienen con id null y se buscan por URL.
    const raw = [photo(1, null), photo(2, null)];
    const fresh = dropLivePhoto(initialLivePhotos({ media: raw }, STORE), photo(1).url, raw);
    expect(livePhotosBody(fresh, raw)).toEqual([{ id: null, url: "https://cdn/x/2.jpg" }]);
    // Volver a «sin elegir» desde una elección guardada → [].
    const saved = initialLivePhotos({ media: GALLERY, livePhotos: [{ storeId: STORE, mediaIds: ["m4"] }] }, STORE);
    const reset = resetLivePhotos(gallery);
    expect(livePhotosChanged(saved, reset)).toBe(true);
    expect(livePhotosBody(reset, gallery)).toEqual([]);
  });
});

describe("?tab= de la ficha (FEAT-32 M7)", () => {
  it("abre la pestaña pedida; lo desconocido abre General", () => {
    expect(fichaTabFromQuery("contenido")).toBe("contenido");
    expect(fichaTabFromQuery(["Canales"])).toBe("canales");
    expect(fichaTabFromQuery("otra")).toBe("general");
    expect(fichaTabFromQuery(undefined)).toBe("general");
  });
});
