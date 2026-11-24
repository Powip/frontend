import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FichaContentTab from "@/components/catalog/ficha/FichaContentTab";
import { getProductContent, saveProductContent, type ProductContentView } from "@/services/productContentService";
import { uploadImage } from "@/services/uploadService";
import { getChannelSummary } from "@/services/productChannelsService";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }), usePathname: () => "/productos/p1" }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", role: "ADMINISTRADOR" }, company: { id: "c1", stores: [{ id: "44444444-4444-4444-8444-444444444444", name: "KUNCA" }] } } }),
}));
jest.mock("@/services/productContentService", () => ({ getProductContent: jest.fn(), saveProductContent: jest.fn() }));
jest.mock("@/services/uploadService", () => ({ uploadImage: jest.fn() }));
jest.mock("@/services/productChannelsService", () => ({ getChannelSummary: jest.fn() }));

const STORE = "44444444-4444-4444-8444-444444444444";

const VIEW: ProductContentView = {
  productId: "p1", materialized: false, source: "shopify", title: "Pantalón Jimena", shortDescription: "",
  descriptionHtml: "<p>Jean <b>tiro alto</b></p>", features: ["Tiro alto"],
  media: [
    { id: null, kind: "photo", origin: "shopify", url: "https://cdn.shopify.com/p.jpg", fileName: null, position: 0, optionName: null, optionValue: null, whiteBackground: false, widthPx: null, heightPx: null, sizeBytes: null },
    { id: null, kind: "photo", origin: "shopify", url: "https://cdn.shopify.com/cel.jpg", fileName: null, position: 1, optionName: "Color", optionValue: "Celeste", whiteBackground: false, widthPx: null, heightPx: null, sizeBytes: null },
  ],
  photoOption: { name: "Color", values: ["Celeste", "Negro"] },
  attributes: { Marca: "KUNCA", Color: "Celeste, Negro" },
  overrides: [], limits: { photos: 12, videos: 3, photoBytes: 5242880 }, canEdit: true, updatedAt: null, updatedBy: null,
};

function renderTab(view: ProductContentView = VIEW) {
  (getProductContent as jest.Mock).mockResolvedValue(view);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FichaContentTab productId="p1" variants={[{ id: "v1", sku: "S", attributeValues: { Color: "Celeste" }, priceVta: 149, isActive: true }]} />
    </QueryClientProvider>,
  );
}

describe("Pestaña Contenido (FEAT-32 M1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getChannelSummary).mockResolvedValue({ channels: [], ownPrices: [] });
  });

  it("muestra lo que viene del producto, el aviso de Shopify, la vista previa y los atributos", async () => {
    renderTab();
    expect(await screen.findByLabelText("Título que ve el cliente")).toHaveValue("Pantalón Jimena");
    expect(screen.getByText(/POWIP pasa a ser el dueño del contenido/)).toBeInTheDocument();
    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByLabelText("Color de la foto 2")).toHaveValue("Celeste");
    expect(screen.getByText("S/ 149.00")).toBeInTheDocument();
    expect(screen.getByText("Celeste, Negro")).toBeInTheDocument();
    expect(screen.queryByText("Cambios sin guardar en el contenido")).not.toBeInTheDocument();
  });

  it("editar muestra la barra; Descartar vuelve atrás y Guardar manda todo el contenido", async () => {
    const user = userEvent.setup();
    (saveProductContent as jest.Mock).mockImplementation(async (_id, body) => ({
      ...VIEW, materialized: true, title: body.title,
      media: body.media.map((m: { id: string; kind: "photo" | "video"; url: string }, i: number) => ({ ...VIEW.media[0], id: m.id, kind: m.kind, url: m.url, position: i })),
    }));
    renderTab();
    const title = await screen.findByLabelText("Título que ve el cliente");
    await user.clear(title);
    await user.type(title, "Pantalón Jimena tiro alto");
    expect(screen.getByText("Cambios sin guardar en el contenido")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Descartar" }));
    expect(title).toHaveValue("Pantalón Jimena");

    await user.type(title, " mujer");
    await user.type(screen.getByLabelText("Link del video"), "https://vimeo.com/1");
    await user.click(screen.getByRole("button", { name: "＋ Agregar link" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Pega un link de YouTube o TikTok");
    await user.clear(screen.getByLabelText("Link del video"));
    await user.type(screen.getByLabelText("Link del video"), "https://youtu.be/abc");
    await user.click(screen.getByRole("button", { name: "＋ Agregar link" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(saveProductContent).toHaveBeenCalledTimes(1));
    const body = (saveProductContent as jest.Mock).mock.calls[0][1];
    expect(body.title).toBe("Pantalón Jimena mujer");
    expect(body.descriptionHtml).toBe("<p>Jean <b>tiro alto</b></p>");
    expect(body.media.map((m: { kind: string; url: string; optionValue?: string | null }) => [m.kind, m.url, m.optionValue])).toEqual([
      ["photo", "https://cdn.shopify.com/p.jpg", null],
      ["photo", "https://cdn.shopify.com/cel.jpg", "Celeste"],
      ["video", "https://youtu.be/abc", undefined],
    ]);
    expect(body.overrides).toEqual([]);
    await waitFor(() => expect(screen.queryByText("Cambios sin guardar en el contenido")).not.toBeInTheDocument());
  });

  it("en un canal se personaliza solo lo que cambia y vuelve al de por defecto", async () => {
    const user = userEvent.setup();
    (saveProductContent as jest.Mock).mockResolvedValue({ ...VIEW, materialized: true });
    renderTab();
    await user.selectOptions(await screen.findByLabelText("Canal"), "Catálogo web");
    const title = screen.getByLabelText("Título que ve el cliente");
    expect(title).toHaveAttribute("readonly");
    await user.click(screen.getAllByRole("button", { name: "Personalizar para Catálogo web" })[2]);
    expect(title).not.toHaveAttribute("readonly");
    await user.clear(title);
    await user.type(title, "Jimena web");
    expect(screen.getByText("Así se ve en Catálogo web")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(saveProductContent).toHaveBeenCalled());
    expect((saveProductContent as jest.Mock).mock.calls[0][1].overrides).toEqual([{ storeId: STORE, channel: "CATALOGO_WEB", field: "title", value: "Jimena web" }]);
  });

  it("FEAT-32 M2: un canal desactivado dice «(no activado)», avisa en ámbar y en «Dónde se usa»", async () => {
    jest.mocked(getChannelSummary).mockResolvedValue({
      channels: [{ productId: "p1", storeId: STORE, channel: "CATALOGO_WEB", active: false, ruleMode: "same" }],
      ownPrices: [],
    });
    const user = userEvent.setup();
    renderTab();
    const select = await screen.findByLabelText("Canal");
    await waitFor(() => expect(within(select).getByRole("option", { name: "Catálogo web (no activado)" })).toBeInTheDocument());
    expect(screen.getByText("No activado")).toBeInTheDocument();
    await user.selectOptions(select, "Catálogo web (no activado)");
    expect(screen.getByRole("status")).toHaveTextContent("El producto no está activado en Catálogo web.");
  });

  it("POWIP Live no admite contenido propio", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.selectOptions(await screen.findByLabelText("Canal"), "POWIP Live");
    expect(screen.queryByRole("button", { name: /Personalizar para/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Elegir las 3 del live en POWIP Live" })).toHaveAttribute("href", "/live");
    expect(screen.getByLabelText("Título que ve el cliente")).toHaveAttribute("readonly");
  });

  it("sube fotos JPG/PNG/WebP de hasta 5 MB y las agrega al final", async () => {
    const user = userEvent.setup({ applyAccept: false });
    (uploadImage as jest.Mock).mockResolvedValue("https://x.supabase.co/neg.webp");
    const { container } = renderTab();
    await screen.findByLabelText("Título que ve el cliente");
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, [new File(["x"], "neg.webp", { type: "image/webp" }), new File(["x"], "a.gif", { type: "image/gif" })]);
    await waitFor(() => expect(screen.getAllByRole("img").length).toBeGreaterThanOrEqual(3));
    expect(uploadImage).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/\(3 de 12\)/)).toBeInTheDocument();
  });

  it("FEAT-32 M7: quitar una foto que se ve en POWIP Live o en un canal avisa que se quita también de ahí", async () => {
    const user = userEvent.setup();
    renderTab({
      ...VIEW,
      materialized: true,
      media: VIEW.media.map((item, index) => ({ ...item, id: `m${index}` })),
      livePhotos: [{ storeId: STORE, mediaIds: ["m0"] }],
      overrides: [{ storeId: STORE, channel: "CATALOGO_WEB", field: "media", value: ["m1"] }],
    });
    await screen.findByLabelText("Título que ve el cliente");
    expect(screen.queryByText(/al guardar, se quita también/)).not.toBeInTheDocument();
    const fotos = screen.getByText(/Fotos/).closest("section") as HTMLElement;
    await user.click(within(fotos).getAllByRole("button", { name: "Quitar foto" })[0]);
    expect(within(fotos).getByRole("status")).toHaveTextContent("Esta foto se ve en POWIP Live: al guardar, se quita también del live.");
    await user.click(within(fotos).getAllByRole("button", { name: "Quitar foto" })[0]);
    expect(within(fotos).getByRole("status")).toHaveTextContent("Esta foto se ve en Catálogo web: al guardar, se quita también de ese canal.");
    await user.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.queryByText(/al guardar, se quita también/)).not.toBeInTheDocument();
  });

  it("sin permiso de edición se ve de solo lectura", async () => {
    renderTab({ ...VIEW, canEdit: false });
    expect(await screen.findByText(/Solo el Administrador u Operaciones pueden editar el contenido/)).toBeInTheDocument();
    expect(screen.getByLabelText("Título que ve el cliente")).toHaveAttribute("readonly");
    expect(screen.queryByText("Subir fotos")).not.toBeInTheDocument();
    const fotos = screen.getByText(/Fotos/).closest("section") as HTMLElement;
    expect(within(fotos).queryByRole("button", { name: "Quitar foto" })).not.toBeInTheDocument();
  });
});
