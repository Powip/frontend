import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import RegistrarCompraPage from "../page";
import axiosAuth from "@/lib/axiosAuth";
import {
  createTrackedPurchase,
  getTrackedPurchase,
  updateTrackedPurchase,
} from "@/services/inventoryTrackingService";

const mockPush = jest.fn();
const mockRouter = { push: mockPush };
let mockParams = new URLSearchParams();
let mockCompany = "company-a";
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockParams,
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      company: { id: mockCompany },
      user: { id: "user-a", email: "owner@example.com" },
      accessToken: "token",
    },
  }),
}));
jest.mock("@/hooks/useBusinessInventories", () => {
  const inventories = [{ id: "warehouse-a", name: "Central", storeId: "store-a" }];
  return { useBusinessInventories: () => ({ inventories, isPending: false, isError: false }) };
});
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));
jest.mock("@/services/inventoryTrackingService", () => ({
  ...jest.requireActual("@/services/inventoryTrackingService"),
  createTrackedPurchase: jest.fn(),
  getTrackedPurchase: jest.fn(),
  updateTrackedPurchase: jest.fn(),
}));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() },
}));
jest.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <select
      value={value ?? ""}
      onChange={(event) => onValueChange(event.target.value)}
      disabled={disabled}
    >
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));

const apiGet = jest.mocked(axiosAuth.get);
const apiPost = jest.mocked(axiosAuth.post);
const create = jest.mocked(createTrackedPurchase);
const variant = (mode: "NONE" | "IMEI" = "NONE") => ({
  variantId: "v1",
  inventoryItemId: "i1",
  productName: "Celular",
  sku: "SKU1",
  trackingMode: mode,
  attributes: {},
  priceBase: 10,
  physicalStock: 0,
  availableStock: 0,
});
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = new URLSearchParams();
  mockCompany = "company-a";
  sessionStorage.clear();
  apiGet.mockImplementation(async (url) => ({
    data: String(url).includes("/suppliers/company/")
      ? [{ id: "s1", name: "Proveedor A", isActive: true }]
      : { data: [variant()], meta: { total: 1, totalPages: 1 } },
  }));
  apiPost.mockResolvedValue({ data: { id: "purchase" } });
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: jest.fn().mockReturnValue("a52730b3-fbf3-4bd8-87fb-0050227f768e"),
  });
});

async function addProduct() {
  const option = await screen.findByRole("option", { name: "Proveedor A" });
  fireEvent.change(option.closest("select")!, { target: { value: "s1" } });
  fireEvent.click(screen.getByRole("button", { name: "Agregar Productos" }));
  const product = await screen.findByText("Celular");
  fireEvent.click(within(product.closest("tr")!).getByRole("button", { name: "Agregar" }));
}

it("keeps quantity purchases on the legacy endpoint without code or operation fields", async () => {
  render(<RegistrarCompraPage />);
  await addProduct();
  fireEvent.click(screen.getByRole("button", { name: "Registrar Compra" }));
  await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
  const [url, payload] = apiPost.mock.calls[0];
  expect(String(url)).toMatch(/\/purchase$/);
  expect(payload).toMatchObject({
    companyId: "company-a",
    inventoryId: "warehouse-a",
    items: [{ variantId: "v1", quantity: 1 }],
  });
  expect(payload).not.toHaveProperty("operationId");
  expect(payload).not.toHaveProperty("items.0.codes");
  expect(payload).not.toHaveProperty("items.0.trackingMode");
  expect(create).not.toHaveBeenCalled();
});

it("preserves IMEI zeroes, locks uncertain requests and retries the same operation", async () => {
  apiGet.mockImplementation(async (url) => ({
    data: String(url).includes("/suppliers/company/")
      ? [{ id: "s1", name: "Proveedor A", isActive: true }]
      : { data: [variant("IMEI")], meta: { total: 1, totalPages: 1 } },
  }));
  create
    .mockRejectedValueOnce(new Error("Conexión interrumpida"))
    .mockResolvedValueOnce({ id: "purchase" });
  render(<RegistrarCompraPage />);
  await addProduct();
  expect(screen.getByRole("button", { name: "Registrar Compra" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("IMEI · un código por unidad"), {
    target: { value: "001234567890123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Registrar Compra" }));
  await screen.findByText("Conexión interrumpida");
  expect(screen.getByLabelText("IMEI · un código por unidad")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar misma solicitud" }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/compras"));
  expect(create.mock.calls[1][0]).toEqual(create.mock.calls[0][0]);
  expect(create.mock.calls[0][0]).toMatchObject({
    operationId: expect.any(String),
    items: [{ codes: ["001234567890123"] }],
  });
  expect(create.mock.calls[0][0]).not.toHaveProperty("companyId");
  expect(create.mock.calls[0][0]).not.toHaveProperty("userEmail");
  expect(apiPost).not.toHaveBeenCalled();
});

it("loads tracked edits through the proxy and preserves the same units while changing cost", async () => {
  mockParams = new URLSearchParams("edit=p1&tracked=1");
  jest
    .mocked(getTrackedPurchase)
    .mockResolvedValue({
      id: "p1",
      companyId: "company-a",
      hasTrackedUnits: true,
      purchaseNumber: "COM-1",
      inventoryId: "warehouse-a",
      items: [
        {
          id: "line1",
          ...variant("IMEI"),
          supplierId: "s1",
          supplierName: "Proveedor A",
          quantity: 1,
          unitCost: 10,
          codes: ["001234567890123"],
          units: [{ id: "unit1", code: "001234567890123", status: "AVAILABLE" }],
        },
      ],
    });
  jest.mocked(updateTrackedPurchase).mockResolvedValue({});
  render(<RegistrarCompraPage />);
  await screen.findByLabelText("IMEI · un código por unidad");
  expect(screen.getByLabelText("Cantidad de Celular")).toBeDisabled();
  expect(screen.getByLabelText("IMEI · un código por unidad")).toHaveValue("001234567890123");
  expect(screen.getByLabelText("IMEI · un código por unidad")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /Guardar Cambios/ }));
  await waitFor(() =>
    expect(updateTrackedPurchase).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        items: [
          expect.objectContaining({ variantId: "v1", quantity: 1, codes: ["001234567890123"] }),
        ],
      }),
    ),
  );
  expect(axiosAuth.put).not.toHaveBeenCalled();
});

it("recovers the exact operation and codes after a reload, without storing credentials", async () => {
  apiGet.mockImplementation(async (url) => ({
    data: String(url).includes("/suppliers/company/")
      ? [{ id: "s1", name: "Proveedor A", isActive: true }]
      : { data: [variant("IMEI")], meta: { total: 1, totalPages: 1 } },
  }));
  create.mockRejectedValueOnce(new Error("Timeout")).mockResolvedValueOnce({ id: "purchase" });
  const first = render(<RegistrarCompraPage />);
  await addProduct();
  fireEvent.change(screen.getByLabelText("IMEI · un código por unidad"), {
    target: { value: "001234567890123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Registrar Compra" }));
  await screen.findByText("Timeout");
  const key = "powip:tracked-purchase:v1:company-a:user-a";
  expect(sessionStorage.getItem(key)).toContain("001234567890123");
  expect(sessionStorage.getItem(key)).not.toContain("accessToken");
  first.unmount();
  render(<RegistrarCompraPage />);
  await screen.findByText(/Recuperé una solicitud pendiente/);
  expect(screen.getByLabelText("IMEI · un código por unidad")).toHaveValue("001234567890123");
  fireEvent.click(screen.getByRole("button", { name: "Reintentar misma solicitud" }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/compras"));
  expect(create.mock.calls[1][0]).toEqual(create.mock.calls[0][0]);
  expect(sessionStorage.getItem(key)).toBeNull();
});

it("ignores the previous company's late purchase details", async () => {
  mockParams = new URLSearchParams("edit=p1&tracked=1");
  let resolveOld!: (value: unknown) => void;
  jest
    .mocked(getTrackedPurchase)
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    )
    .mockResolvedValueOnce({
      id: "p1",
      companyId: "company-b",
      hasTrackedUnits: true,
      purchaseNumber: "COM-B",
      inventoryId: "warehouse-a",
      items: [],
    });
  const view = render(<RegistrarCompraPage />);
  mockCompany = "company-b";
  view.rerender(<RegistrarCompraPage />);
  await screen.findByText(/COM-B/);
  await act(async () =>
    resolveOld({
      id: "p1",
      companyId: "company-a",
      purchaseNumber: "COM-OLD",
      inventoryId: "warehouse-a",
      items: [],
    }),
  );
  expect(screen.queryByText(/COM-OLD/)).not.toBeInTheDocument();
});
