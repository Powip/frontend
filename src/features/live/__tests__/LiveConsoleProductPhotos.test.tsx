import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { toast } from "sonner";
import LiveConsolePage from "../LiveConsolePage";
import { getLiveConsole, updateLiveProducts } from "../liveService";
import { saveLivePhotos } from "@/services/productContentService";
import type { LiveConsoleData } from "../types";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams("tab=products"),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      user: { id: "admin", role: "ADMINISTRADOR", permissions: [] },
      company: { id: "company", stores: [{ id: "store-a", name: "Tienda A" }] },
    },
    selectedStoreId: "store-a",
    setSelectedStore: jest.fn(),
  }),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getLiveConsole: jest.fn(),
  updateLiveProducts: jest.fn(),
}));
jest.mock("@/services/productContentService", () => ({ saveLivePhotos: jest.fn() }));
// La sección de fotos tiene su propio test: acá solo lo que le pasa a la ventana.
jest.mock("../LiveProductPhotos", () => ({
  __esModule: true,
  default: ({ productId, storeId, onChange }: { productId: string; storeId: string; onChange: (change: unknown) => void }) => (
    <div>
      <p>fotos de {productId} en {storeId}</p>
      <button type="button" onClick={() => onChange({ photos: [{ id: "m3", url: "https://cdn.test/3.jpg" }], uploading: false })}>
        Elegir fotos
      </button>
      <button type="button" onClick={() => onChange({ photos: null, uploading: true })}>
        Subiendo
      </button>
    </div>
  ),
}));

const CONSOLE: LiveConsoleData = {
  config: {
    enabled: true,
    allowBuyNow: true,
    allowReservations: true,
    reservationMinutes: 15,
    maxReservedUnits: 5,
    allowAccumulation: false,
    combineShipping: false,
    homeShipping: 10,
    agencyShipping: null,
    reminderEnabled: false,
    showBackLink: false,
    allowSellerLive: false,
    closePolicy: "MANUAL",
    liveUrl: "",
  },
  session: { id: "session", status: "LIVE", platform: "TIKTOK", pinnedVariantId: null },
  products: [
    {
      variantId: "variant-s",
      productId: "product-sofia",
      name: "Blusa Sofía",
      sku: "SOF-S",
      regularPrice: 89,
      livePrice: 69,
      availableStock: 5,
      maxPerCustomer: null,
      enabled: true,
    },
  ],
  reservations: [],
  trustedCustomers: [],
  metrics: { totalSales: 0, orderCount: 0, instantOrderCount: 0, activeReservations: 0, visits: 0 },
  paymentMethods: ["yape"],
  capabilities: { readConsole: true, read: true, manage: true, operate: true, reviewPayments: true },
  serverNow: "2026-11-24T12:00:00Z",
};
const badRequest = (message: string) =>
  new AxiosError("400", "ERR", undefined, undefined, { status: 400, statusText: "Bad Request", headers: {}, config: { headers: new AxiosHeaders() }, data: { message } });

async function openDialog() {
  render(<LiveConsolePage />);
  fireEvent.click(await screen.findByRole("button", { name: "Editar Blusa Sofía" }));
  return screen.findByRole("dialog");
}

beforeEach(() => {
  jest.clearAllMocks();
  (getLiveConsole as jest.Mock).mockResolvedValue(CONSOLE);
  (updateLiveProducts as jest.Mock).mockResolvedValue({ products: CONSOLE.products, serverNow: CONSOLE.serverNow });
  (saveLivePhotos as jest.Mock).mockResolvedValue({ photos: [] });
});

describe("Editar producto del live con sus fotos (FEAT-32 M7)", () => {
  it("guarda primero las fotos elegidas y después el precio live", async () => {
    await openDialog();
    expect(screen.getByText("fotos de product-sofia en store-a")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Elegir fotos" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar producto" }));
    await waitFor(() => expect(updateLiveProducts).toHaveBeenCalled());
    expect(saveLivePhotos).toHaveBeenCalledWith("product-sofia", {
      storeId: "store-a",
      photos: [{ id: "m3", url: "https://cdn.test/3.jpg" }],
    });
    expect((saveLivePhotos as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((updateLiveProducts as jest.Mock).mock.invocationCallOrder[0]);
    // FEAT-33 L1 (B2): un precio live y un máximo para todas las variantes del producto.
    expect(updateLiveProducts).toHaveBeenCalledWith("store-a", { variantIds: ["variant-s"], livePrice: 69, maxPerCustomer: null });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("mientras se sube una foto no se puede guardar", async () => {
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Subiendo" }));
    expect(screen.getByRole("button", { name: "Guardar producto" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Elegir fotos" }));
    expect(screen.getByRole("button", { name: "Guardar producto" })).toBeEnabled();
  });

  it("si el backend rechaza las fotos, muestra su mensaje y no guarda el precio", async () => {
    (saveLivePhotos as jest.Mock).mockRejectedValue(badRequest("Una de las fotos elegidas ya no está en la galería del producto."));
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Elegir fotos" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar producto" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Una de las fotos elegidas ya no está en la galería del producto."));
    expect(updateLiveProducts).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("sin cambios de fotos guarda solo el precio", async () => {
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Guardar producto" }));
    await waitFor(() => expect(updateLiveProducts).toHaveBeenCalled());
    expect(saveLivePhotos).not.toHaveBeenCalled();
  });
});
