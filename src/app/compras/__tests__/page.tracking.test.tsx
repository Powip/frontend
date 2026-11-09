import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ComprasPage from "../page";
import axiosAuth from "@/lib/axiosAuth";
import { cancelPurchase, getTrackedPurchase } from "@/services/inventoryTrackingService";
import { toast } from "sonner";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: "c" }, user: { id: "u" }, accessToken: "token" } }),
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), delete: jest.fn() },
}));
jest.mock("@/services/inventoryTrackingService", () => ({
  ...jest.requireActual("@/services/inventoryTrackingService"),
  getTrackedPurchase: jest.fn(),
  cancelPurchase: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const purchase = {
  id: "p",
  companyId: "c",
  hasTrackedUnits: true,
  purchaseNumber: "COM-1",
  totalAmount: 10,
  status: "COMPLETED",
  createdAt: "2026-10-17T10:00:00Z",
  items: [],
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: { data: [purchase], meta: { total: 1 } } });
});
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ComprasPage />
    </QueryClientProvider>,
  );
}
it("loads tracked details from the scoped proxy and displays the codes", async () => {
  jest
    .mocked(getTrackedPurchase)
    .mockResolvedValue({
      ...purchase,
      items: [
        {
          id: "line",
          productName: "Celular",
          sku: "SKU",
          supplierName: "Proveedor",
          quantity: 1,
          unitCost: 10,
          trackingMode: "IMEI",
          codes: ["001234567890123"],
        },
      ],
    });
  setup();
  await screen.findByText("COM-1");
  fireEvent.click(screen.getByTitle("Ver detalles"));
  await screen.findByText("001234567890123");
  expect(getTrackedPurchase).toHaveBeenCalledWith("p");
});
it("anula por la fachada con motivo y deja el diálogo abierto si se rechaza (FEAT-24 H0)", async () => {
  jest.mocked(cancelPurchase).mockRejectedValue({ response: { data: { message: "Una unidad ya está reservada" } } });
  setup();
  await screen.findByText("COM-1");
  fireEvent.click(screen.getByTitle("Anular"));
  fireEvent.change(screen.getByLabelText("Motivo de la anulación"), { target: { value: "Error de carga" } });
  fireEvent.click(screen.getByRole("button", { name: "Anular compra" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Una unidad ya está reservada");
  expect(cancelPurchase).toHaveBeenCalledWith("p", "Error de carga");
  expect(axiosAuth.delete).not.toHaveBeenCalled();
});

describe("FEAT-24 H0", () => {
  it("no hay Editar y una compra sin unidades también se anula por la fachada", async () => {
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: { data: [{ ...purchase, hasTrackedUnits: false }], meta: { total: 1 } } });
    jest.mocked(cancelPurchase).mockResolvedValue(undefined);
    setup();
    await screen.findByText("COM-1");
    expect(screen.queryByTitle("Editar")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Anular"));
    fireEvent.change(screen.getByLabelText("Motivo de la anulación"), { target: { value: "Error de carga" } });
    fireEvent.click(screen.getByRole("button", { name: "Anular compra" }));
    await waitFor(() => expect(cancelPurchase).toHaveBeenCalledWith("p", "Error de carga"));
    expect(toast.success).toHaveBeenCalledWith("Compra anulada");
  });

  it("muestra Anulada con motivo, autor y fecha, o Sin motivo registrado", async () => {
    jest.mocked(axiosAuth.get).mockResolvedValue({
      data: {
        data: [
          { ...purchase, id: "a", purchaseNumber: "COM-2", hasTrackedUnits: false, status: "CANCELLED", cancelReason: "Error de carga", cancelledBy: "ana@x.pe", deletedAt: "2026-10-21T17:47:00Z" },
          { ...purchase, id: "b", purchaseNumber: "COM-3", hasTrackedUnits: false, status: "CANCELLED", cancelReason: null, cancelledBy: null, deletedAt: null },
        ],
        meta: { total: 2 },
      },
    });
    setup();
    await screen.findByText("COM-2");
    expect(screen.getAllByText("Anulada")).toHaveLength(2);
    expect(screen.queryByText("Cancelada")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByTitle("Ver detalles")[0]);
    expect(await screen.findByText(/Error de carga/)).toBeInTheDocument();
    expect(screen.getByText(/ana@x\.pe/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar Detalles" }));
    fireEvent.click(screen.getAllByTitle("Ver detalles")[1]);
    expect(await screen.findByText("Sin motivo registrado")).toBeInTheDocument();
  });
});
it("el detalle no muestra Default Title y conserva los atributos reales (FEAT-24 H0 F5)", async () => {
  const line = { productName: "Polo", sku: "SKU", supplierName: "Proveedor", quantity: 1, unitCost: 10 };
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: { data: [{ ...purchase, hasTrackedUnits: false, items: [
    { ...line, id: "simple", attributes: { Title: "Default Title" } },
    { ...line, id: "rojo", attributes: { Color: "Rojo" } },
  ] }], meta: { total: 1 } } });
  setup();
  await screen.findByText("COM-1");
  fireEvent.click(screen.getByTitle("Ver detalles"));
  await screen.findByText("Color: Rojo");
  expect(screen.queryByText(/Default Title/)).not.toBeInTheDocument();
});
