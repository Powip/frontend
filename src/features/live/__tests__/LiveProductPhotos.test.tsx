import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LiveProductPhotos from "../LiveProductPhotos";
import {
  addContentPhoto,
  getEffectiveContent,
  getProductContent,
  type ContentMedia,
  type ProductContentView,
} from "@/services/productContentService";
import { uploadImage } from "@/services/uploadService";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/services/productContentService", () => ({
  getProductContent: jest.fn(),
  getEffectiveContent: jest.fn(),
  addContentPhoto: jest.fn(),
}));
jest.mock("@/services/uploadService", () => ({ uploadImage: jest.fn() }));

const STORE = "44444444-4444-4444-8444-444444444444";
const photo = (n: number, id: string | null = `m${n}`): ContentMedia => ({
  id, kind: "photo", origin: "uploaded", url: `https://cdn.test/${n}.jpg`, fileName: null, position: n,
  optionName: null, optionValue: null, whiteBackground: false, widthPx: null, heightPx: null, sizeBytes: null,
});
const VIEW: ProductContentView = {
  productId: "p1", materialized: true, source: "manual", title: "Blusa Sofía", shortDescription: "", descriptionHtml: "",
  features: [], media: [photo(0), photo(1), photo(2), photo(3)], photoOption: null, attributes: {}, overrides: [],
  livePhotos: [], limits: { photos: 12, videos: 3, photoBytes: 5242880 }, canEdit: true, updatedAt: null, updatedBy: null,
};
const effective = (photos: ContentMedia[]) => ({
  productId: "p1", storeId: STORE, channel: "POWIP_LIVE", title: "Blusa Sofía", shortDescription: "", descriptionHtml: "",
  features: [], photos, videos: [],
});
const badRequest = (message: string) =>
  new AxiosError("400", "ERR", undefined, undefined, { status: 400, statusText: "Bad Request", headers: {}, config: { headers: new AxiosHeaders() }, data: { message } });

function renderPhotos(view: ProductContentView = VIEW, live: ContentMedia[] = [photo(0), photo(1), photo(2)]) {
  jest.mocked(getProductContent).mockResolvedValue(view);
  jest.mocked(getEffectiveContent).mockResolvedValue(effective(live));
  const onChange = jest.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <LiveProductPhotos productId="p1" storeId={STORE} onChange={onChange} />
    </QueryClientProvider>,
  );
  const last = () => onChange.mock.calls[onChange.mock.calls.length - 1][0];
  return { ...utils, onChange, last };
}

const chosenUrls = () =>
  within(screen.getByRole("list", { name: "Fotos elegidas para el live" }))
    .getAllByRole("img")
    .map((img) => img.getAttribute("src"));

beforeEach(() => jest.clearAllMocks());

describe("Fotos que se ven en el live (FEAT-32 M7, spec §7.13)", () => {
  it("sin elección muestra las 3 primeras; con 3 elegidas el resto se deshabilita", async () => {
    const { last } = renderPhotos();
    expect(await screen.findByText("Sin elegir: se ven las 3 primeras")).toBeInTheDocument();
    expect(getEffectiveContent).toHaveBeenCalledWith("p1", STORE, "POWIP_LIVE", expect.anything());
    expect(chosenUrls()).toEqual(["https://cdn.test/0.jpg", "https://cdn.test/1.jpg", "https://cdn.test/2.jpg"]);
    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByText("Fotos del producto (4)")).toBeInTheDocument();
    const fourth = screen.getByRole("button", { name: "Elegir la foto 4 del producto para el live" });
    expect(fourth).toBeDisabled();
    expect(fourth).toHaveAttribute("title", "Quita una para elegir otra");
    expect(screen.getByText("Quita una para elegir otra.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar en la ficha del producto ↗" })).toHaveAttribute("href", "/productos/p1?tab=contenido");
    expect(last()).toEqual({ photos: null, uploading: false });
  });

  it("quitar, elegir otra y ★ arman la elección en orden con id y URL", async () => {
    const user = userEvent.setup();
    const { last } = renderPhotos();
    await user.click(await screen.findByRole("button", { name: "Quitar la foto 2 del live" }));
    await user.click(screen.getByRole("button", { name: "Elegir la foto 4 del producto para el live" }));
    await user.click(screen.getByRole("button", { name: "Pasar la foto 3 a principal" }));
    expect(chosenUrls()).toEqual(["https://cdn.test/3.jpg", "https://cdn.test/0.jpg", "https://cdn.test/2.jpg"]);
    expect(screen.queryByText("Sin elegir: se ven las 3 primeras")).not.toBeInTheDocument();
    expect(last().photos).toEqual([
      { id: "m3", url: "https://cdn.test/3.jpg" },
      { id: "m0", url: "https://cdn.test/0.jpg" },
      { id: "m2", url: "https://cdn.test/2.jpg" },
    ]);
  });

  it("con una elección guardada, «Volver a las 3 primeras» manda []", async () => {
    const user = userEvent.setup();
    const { last } = renderPhotos({ ...VIEW, livePhotos: [{ storeId: STORE, mediaIds: ["m3"] }] }, [photo(3)]);
    expect(await screen.findByRole("button", { name: "Volver a las 3 primeras" })).toBeInTheDocument();
    expect(chosenUrls()).toEqual(["https://cdn.test/3.jpg"]);
    expect(last().photos).toBeNull();
    await user.click(screen.getByRole("button", { name: "Volver a las 3 primeras" }));
    expect(screen.getByText("Sin elegir: se ven las 3 primeras")).toBeInTheDocument();
    expect(last().photos).toEqual([]);
  });

  it("«＋ Subir nueva» guarda la foto en el producto y la elige si hay lugar", async () => {
    const user = userEvent.setup();
    jest.mocked(uploadImage).mockResolvedValue("https://cdn.test/nueva.webp");
    jest.mocked(addContentPhoto).mockResolvedValue({ ...photo(9, "m9"), url: "https://cdn.test/nueva.webp", position: 4 });
    const { last } = renderPhotos({ ...VIEW, livePhotos: [{ storeId: STORE, mediaIds: ["m1"] }] }, [photo(1)]);
    await screen.findByText("Fotos del producto (4)");
    await user.upload(screen.getByLabelText("Subir nueva foto"), new File(["x"], "nueva.webp", { type: "image/webp" }));
    await screen.findByText("Fotos del producto (5)");
    expect(addContentPhoto).toHaveBeenCalledWith("p1", { url: "https://cdn.test/nueva.webp", fileName: "nueva.webp", widthPx: null, heightPx: null, sizeBytes: 1 });
    expect(chosenUrls()).toEqual(["https://cdn.test/1.jpg", "https://cdn.test/nueva.webp"]);
    expect(last()).toEqual({
      photos: [{ id: "m1", url: "https://cdn.test/1.jpg" }, { id: "m9", url: "https://cdn.test/nueva.webp" }],
      uploading: false,
    });
  });

  it("muestra el mensaje del backend si no se puede subir, y valida el archivo antes", async () => {
    const user = userEvent.setup({ applyAccept: false });
    jest.mocked(uploadImage).mockResolvedValue("https://cdn.test/n.jpg");
    jest.mocked(addContentPhoto).mockRejectedValue(badRequest("La galería ya tiene 12 fotos: quita una en la ficha del producto."));
    renderPhotos();
    await screen.findByText("Fotos del producto (4)");
    await user.upload(screen.getByLabelText("Subir nueva foto"), new File(["x"], "a.gif", { type: "image/gif" }));
    expect(screen.getByRole("alert")).toHaveTextContent("«a.gif» no es JPG, PNG ni WebP.");
    expect(uploadImage).not.toHaveBeenCalled();
    await user.upload(screen.getByLabelText("Subir nueva foto"), new File(["x"], "n.jpg", { type: "image/jpeg" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("La galería ya tiene 12 fotos: quita una en la ficha del producto."));
  });

  it("sin permiso se ve en solo lectura", async () => {
    renderPhotos({ ...VIEW, canEdit: false });
    expect(await screen.findByText("Solo el Administrador u Operaciones pueden cambiar las fotos del live.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Quitar la foto/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Subir nueva foto")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elegir la foto 4 del producto para el live" })).toBeDisabled();
  });

  it("si no se puede leer el contenido efectivo, usa la elección guardada", async () => {
    jest.mocked(getProductContent).mockResolvedValue({ ...VIEW, livePhotos: [{ storeId: STORE, mediaIds: ["m2"] }] });
    jest.mocked(getEffectiveContent).mockRejectedValue(new Error("caído"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <LiveProductPhotos productId="p1" storeId={STORE} onChange={jest.fn()} />
      </QueryClientProvider>,
    );
    await screen.findByRole("button", { name: "Volver a las 3 primeras" });
    expect(chosenUrls()).toEqual(["https://cdn.test/2.jpg"]);
  });
});
