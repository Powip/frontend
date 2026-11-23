import {
  addPhotos,
  addVideoLink,
  buildSaveBody,
  channelKey,
  customizeField,
  draftFromView,
  draftProblems,
  effectiveDraft,
  htmlToText,
  isOwn,
  makePrincipal,
  movePhoto,
  photoFileProblem,
  photosOf,
  plainTextToHtml,
  removeMedia,
  resetField,
  sameDraft,
  sanitizeDescriptionHtml,
  setChannelValue,
  videoLinkOrigin,
  videosOf,
} from "../productContent";
import type { ContentMedia, ProductContentView } from "@/services/productContentService";

const STORE = "44444444-4444-4444-8444-444444444444";
const CAT = channelKey(STORE, "CATALOGO_WEB");

const media = (over: Partial<ContentMedia>): ContentMedia => ({
  id: null, kind: "photo", origin: "shopify", url: "https://a.com/x.jpg", fileName: null, position: 0,
  optionName: null, optionValue: null, whiteBackground: false, widthPx: null, heightPx: null, sizeBytes: null, ...over,
});

const view = (over: Partial<ProductContentView> = {}): ProductContentView => ({
  productId: "p-1", materialized: false, source: "shopify", title: "Pantalón Jimena", shortDescription: "",
  descriptionHtml: "<p>Jean</p>", features: [],
  media: [
    media({ url: "https://a.com/cel.jpg", position: 1, optionName: "Color", optionValue: "Celeste" }),
    media({ url: "https://a.com/principal.jpg", position: 0 }),
  ],
  photoOption: { name: "Color", values: ["Celeste", "Negro"] }, attributes: { Marca: "KUNCA" }, overrides: [],
  limits: { photos: 12, videos: 3, photoBytes: 5242880 }, canEdit: true, updatedAt: null, updatedBy: null, ...over,
});

let seq = 0;
const ids = () => `id-${++seq}`;
beforeEach(() => { seq = 0; });

describe("productContent (FEAT-32 M1)", () => {
  it("arma el borrador desde la vista: fotos en orden, ids generados para lo que viene del producto", () => {
    const draft = draftFromView(view(), ids);
    expect(photosOf(draft).map((m) => [m.id, m.url, m.optionValue])).toEqual([
      ["id-1", "https://a.com/principal.jpg", null],
      ["id-2", "https://a.com/cel.jpg", "Celeste"],
    ]);
    expect(sameDraft(draft, draftFromView(view(), (() => { let n = 0; return () => `id-${++n}`; })()))).toBe(true);
  });

  it("los canales guardados se agrupan por tienda y canal", () => {
    const draft = draftFromView(view({ overrides: [
      { storeId: STORE, channel: "CATALOGO_WEB", field: "title", value: "Jimena web" },
      { storeId: STORE, channel: "CATALOGO_WEB", field: "media", value: ["x"] },
    ] }), ids);
    expect(draft.overrides[CAT]).toEqual({ title: "Jimena web", media: ["x"] });
  });

  it("principal, mover y quitar fotos", () => {
    let draft = draftFromView(view(), ids);
    draft = makePrincipal(draft, 1);
    expect(photosOf(draft)[0].url).toBe("https://a.com/cel.jpg");
    draft = movePhoto(draft, 0, 1);
    expect(photosOf(draft)[0].url).toBe("https://a.com/principal.jpg");
    expect(movePhoto(draft, 0, -1)).toBe(draft);
    draft = removeMedia(draft, "id-1");
    expect(photosOf(draft).map((m) => m.id)).toEqual(["id-2"]);
  });

  it("quitar una foto la saca de los canales; un canal sin fotos vuelve a las de por defecto", () => {
    let draft = draftFromView(view(), ids);
    draft = setChannelValue(draft, CAT, "media", ["id-1"]);
    draft = setChannelValue(draft, CAT, "title", "Web");
    draft = removeMedia(draft, "id-1");
    expect(draft.overrides[CAT]).toEqual({ title: "Web" });
    draft = resetField(draft, CAT, "title");
    expect(draft.overrides[CAT]).toBeUndefined();
  });

  it("agrega fotos hasta 12 sin repetir URL", () => {
    const draft = draftFromView(view(), ids);
    const fresh = Array.from({ length: 12 }, (_, i) => ({ origin: "uploaded" as const, url: `https://s.co/${i}.jpg`, fileName: `${i}.jpg`, optionValue: null, whiteBackground: false, widthPx: 10, heightPx: 10, sizeBytes: 100 }));
    const result = addPhotos(draft, [{ ...fresh[0], url: "https://a.com/cel.jpg" }, ...fresh], ids);
    expect(photosOf(result.draft)).toHaveLength(12);
    expect(result.skipped).toBe(3);
  });

  it("videos solo con link https de YouTube o TikTok, hasta 3", () => {
    expect(videoLinkOrigin("https://www.youtube.com/watch?v=abc")).toBe("youtube");
    expect(videoLinkOrigin("https://youtu.be/abc")).toBe("youtube");
    expect(videoLinkOrigin("https://vm.tiktok.com/ZM1/")).toBe("tiktok");
    expect(videoLinkOrigin("http://youtu.be/abc")).toBeNull();
    expect(videoLinkOrigin("https://vimeo.com/1")).toBeNull();
    expect(videoLinkOrigin("https://evil.com/youtube.com/watch?v=1")).toBeNull();
    let draft = draftFromView(view(), ids);
    for (const url of ["https://youtu.be/a", "https://youtu.be/b", "https://youtu.be/c"]) {
      const result = addVideoLink(draft, url, ids);
      if ("error" in result) throw new Error(result.error);
      draft = result.draft;
    }
    expect(videosOf(draft)).toHaveLength(3);
    expect(addVideoLink(draft, "https://youtu.be/d", ids)).toEqual({ error: "Puedes agregar hasta 3 videos." });
    expect(addVideoLink(draft, "https://vimeo.com/1", ids)).toEqual({ error: "Pega un link de YouTube o TikTok que empiece con https://" });
  });

  it("valida los archivos de foto: tipo y 5 MB", () => {
    expect(photoFileProblem({ name: "a.gif", type: "image/gif", size: 10 })).toBe("«a.gif» no es JPG, PNG ni WebP.");
    expect(photoFileProblem({ name: "a.jpg", type: "image/jpeg", size: 6 * 1024 * 1024 })).toBe("«a.jpg» pesa más de 5 MB.");
    expect(photoFileProblem({ name: "a.webp", type: "image/webp", size: 1000 })).toBeNull();
  });

  it("personalizar copia lo de por defecto; el canal usa lo propio y hereda lo demás", () => {
    let draft = draftFromView(view(), ids);
    draft = customizeField(draft, CAT, "media");
    expect(draft.overrides[CAT].media).toEqual(["id-1", "id-2"]);
    draft = setChannelValue(draft, CAT, "media", ["id-2"]);
    draft = customizeField(draft, CAT, "title");
    draft = setChannelValue(draft, CAT, "title", "Jimena tiro alto");
    const effective = effectiveDraft(draft, CAT);
    expect(effective.title).toBe("Jimena tiro alto");
    expect(effective.photos.map((m) => m.id)).toEqual(["id-2"]);
    expect(effective.descriptionHtml).toBe("<p>Jean</p>");
    expect(isOwn(draft, CAT, "title")).toBe(true);
    expect(isOwn(draft, CAT, "features")).toBe(false);
    expect(isOwn(draft, null, "title")).toBe(false);
    expect(effectiveDraft(draft, null).title).toBe("Pantalón Jimena");
  });

  it("problemas antes de guardar", () => {
    let draft = { ...draftFromView(view(), ids), title: "  " };
    draft = setChannelValue(draft, CAT, "title", "");
    draft = setChannelValue(draft, CAT, "media", []);
    expect(draftProblems(draft, () => "Catálogo web")).toEqual([
      "Escribe el título que ve el cliente.",
      "Escribe el título de Catálogo web o vuelve al de por defecto.",
      "Elige al menos una foto para Catálogo web o vuelve a las de por defecto.",
    ]);
  });

  it("arma el cuerpo de guardar: recorta, saca características repetidas, sanea y aplana los canales", () => {
    let draft = draftFromView(view(), ids);
    draft = { ...draft, title: "  Pantalón   Jimena ", features: ["Tiro alto", " tiro alto", "", "Bota recta"], descriptionHtml: '<p onclick="x()">Hola</p><script>1</script>' };
    draft = setChannelValue(draft, CAT, "features", ["A", "a"]);
    const added = addVideoLink(draft, "https://youtu.be/a", ids);
    if ("error" in added) throw new Error(added.error);
    const body = buildSaveBody(added.draft);
    expect(body.title).toBe("Pantalón Jimena");
    expect(body.features).toEqual(["Tiro alto", "Bota recta"]);
    expect(body.descriptionHtml).toBe("<p>Hola</p>");
    expect(body.overrides).toEqual([{ storeId: STORE, channel: "CATALOGO_WEB", field: "features", value: ["A"] }]);
    expect(body.media.map((m) => [m.id, m.kind, m.origin, m.optionValue])).toEqual([
      ["id-1", "photo", "shopify", null],
      ["id-2", "photo", "shopify", "Celeste"],
      ["id-3", "video", undefined, undefined],
    ]);
  });
});

describe("sanitizeDescriptionHtml (misma lista blanca que ms-products)", () => {
  it("conserva el formato de Shopify (tablas, imágenes https, alineación)", () => {
    const html = '<p style="text-align: center">Hola <strong>mundo</strong></p><table><tbody><tr><td colspan="2">Talla</td></tr></tbody></table><img src="https://cdn.shopify.com/a.jpg" alt="A">';
    expect(sanitizeDescriptionHtml(html)).toBe('<p style="text-align:center">Hola <strong>mundo</strong></p><table><tbody><tr><td colspan="2">Talla</td></tr></tbody></table><img src="https://cdn.shopify.com/a.jpg" alt="A">');
  });

  it("quita scripts, iframes, eventos, class, data-*, javascript: y data: en imágenes", () => {
    const html = '<p class="x" data-a="1" onclick="hack()">A</p><script>alert(1)</script><iframe src="https://x.com"></iframe><img src="https://a.com/x.png" onerror="hack()"><a href="javascript:alert(1)">mal</a><img src="data:image/png;base64,AA"><!-- nota -->';
    expect(sanitizeDescriptionHtml(html)).toBe('<p>A</p><img src="https://a.com/x.png"><a>mal</a><img>');
  });

  it("h1→h2, h6→h4, font→span con color; etiquetas desconocidas se desenvuelven", () => {
    expect(sanitizeDescriptionHtml('<h1>T</h1><h6>s</h6><font color="red">r</font><section><p>x</p></section>')).toBe(
      '<h2>T</h2><h4>s</h4><span style="color:red">r</span><p>x</p>',
    );
  });

  it("links que abren en otra pestaña llevan rel=noopener; estilos peligrosos fuera", () => {
    expect(sanitizeDescriptionHtml('<a href="https://kunca.pe" target="_blank">Ver</a><span style="position:absolute;color:#f00">A</span>')).toBe(
      '<a href="https://kunca.pe" target="_blank" rel="noopener noreferrer">Ver</a><span style="color:#f00">A</span>',
    );
  });

  it("texto plano para la vista previa", () => {
    expect(htmlToText("<p>Crema</p><p>para la <b>noche</b></p>")).toBe("Crema para la noche");
    expect(htmlToText("")).toBe("");
  });
});

describe("plainTextToHtml (descripción de «Crear producto»)", () => {
  it("párrafos y saltos de línea, con el texto escapado; el HTML queda igual", () => {
    expect(plainTextToHtml("Jean tiro alto\nBota recta\n\n5 < 6")).toBe("<p>Jean tiro alto<br>Bota recta</p><p>5 &lt; 6</p>");
    expect(plainTextToHtml("<p>Ya es HTML</p>")).toBe("<p>Ya es HTML</p>");
    expect(plainTextToHtml("   ")).toBe("");
  });
});
