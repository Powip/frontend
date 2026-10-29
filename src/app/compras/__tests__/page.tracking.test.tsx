import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ComprasPage from "../page";
import axiosAuth from "@/lib/axiosAuth";
import { deleteTrackedPurchase, getTrackedPurchase } from "@/services/inventoryTrackingService";
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
  deleteTrackedPurchase: jest.fn(),
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
it("uses the tracked cancellation endpoint and keeps a rejected cancellation available to review", async () => {
  jest
    .mocked(deleteTrackedPurchase)
    .mockRejectedValue({ response: { data: { message: "Una unidad ya está reservada" } } });
  setup();
  await screen.findByText("COM-1");
  fireEvent.click(screen.getByTitle("Eliminar"));
  fireEvent.click(screen.getByRole("button", { name: "Sí, revertir stock y eliminar" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Una unidad ya está reservada"));
  expect(deleteTrackedPurchase).toHaveBeenCalledWith("p");
  expect(axiosAuth.delete).not.toHaveBeenCalled();
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
});
