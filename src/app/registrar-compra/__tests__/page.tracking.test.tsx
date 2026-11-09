import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import RegistrarCompraPage from "../page";
import axiosAuth from "@/lib/axiosAuth";
import {
  createTrackedPurchase,
  getTrackedPurchase,
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
const variant = (mode: "NONE" | "IMEI" | "SERIAL" = "NONE") => ({
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
  jest.resetAllMocks();
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
  const addButton = within(product.closest("tr")!).getByRole("button", { name: "Agregar" });
  fireEvent.click(addButton);
  return addButton;
}

it("keeps quantity purchases on the legacy endpoint without code or operation fields", async () => {
  render(<RegistrarCompraPage />);
  const addButton = await addProduct();
  expect(addButton).toBeDisabled();
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

it.each([
  ["IMEI", ["00123", "0012345678901234", "001234567890125"]],
  ["SERIAL", ["SERIE-001", "SERIE-002", "SERIE-003"]],
] as const)("adds more units of the same %s variant while preserving its codes and purchase line", async (mode, codes) => {
  apiGet.mockImplementation(async (url) => ({
    data: String(url).includes("/suppliers/company/")
      ? [{ id: "s1", name: "Proveedor A", isActive: true }]
      : { data: [variant(mode)], meta: { total: 1, totalPages: 1 } },
  }));
  create.mockResolvedValue({ id: "purchase" });
  render(<RegistrarCompraPage />);
  const addButton = await addProduct();
  const codeInput = screen.getByLabelText(`${mode} · un código por unidad`);
  fireEvent.change(codeInput, { target: { value: codes[0] } });
  const costInput = within(codeInput.closest("tr")!).getAllByRole("spinbutton")[1];
  fireEvent.change(costInput, { target: { value: "17.5" } });
  expect(addButton).toBeEnabled();
  expect(addButton).toHaveAccessibleName("Agregar otra unidad");
  act(() => {
    fireEvent.click(addButton);
    fireEvent.click(addButton);
  });
  expect(screen.getByLabelText("Cantidad de Celular")).toHaveValue(3);
  expect(codeInput).toHaveValue(codes[0]);
  expect(costInput).toHaveValue(17.5);
  expect(screen.getByText("1 de 3 códigos")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Registrar Compra" })).toBeDisabled();
  fireEvent.change(codeInput, { target: { value: [codes[0], codes[0], codes[2]].join("\n") } });
  expect(screen.getByText(/Código duplicado/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Registrar Compra" })).toBeDisabled();
  fireEvent.change(codeInput, { target: { value: codes.join("\n") } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar Compra" }));
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  expect(create.mock.calls[0][0]).toMatchObject({
    items: [{ variantId: "v1", quantity: 3, unitCost: 17.5, codes: [...codes] }],
  });
  expect(create.mock.calls[0][0].items).toHaveLength(1);
  expect(apiPost).not.toHaveBeenCalled();
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
  expect(screen.getByRole("button", { name: "Agregar otra unidad" })).toBeDisabled();
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

describe("FEAT-24 H0", () => {
  it("una compra recibida no se abre para editar", async () => {
    mockParams = new URLSearchParams("edit=p1&tracked=1");
    render(<RegistrarCompraPage />);
    expect(await screen.findByText("Las compras recibidas no se editan. Anúlala y registra una nueva.")).toBeInTheDocument();
    expect(getTrackedPurchase).not.toHaveBeenCalled();
    expect(apiGet.mock.calls.some(([url]) => String(url).includes("/purchase/"))).toBe(false);
  });

  it("una línea de más de 10.000 unidades no se envía", async () => {
    render(<RegistrarCompraPage />);
    await addProduct();
    fireEvent.change(screen.getByLabelText("Cantidad de Celular"), { target: { value: "10001" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar Compra" }));
    expect(await screen.findByText("La cantidad máxima por variante y almacén es 10,000 unidades.")).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("una línea de más de 1.000 unidades pide confirmar", async () => {
    render(<RegistrarCompraPage />);
    await addProduct();
    fireEvent.change(screen.getByLabelText("Cantidad de Celular"), { target: { value: "1500" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar Compra" }));
    expect(await screen.findByText("Estás cargando 1,500 unidades. ¿Confirmas la cantidad?")).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sí, confirmar" }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
  });

  it("no muestra Default Title al elegir ni en el carrito (F5)", async () => {
    apiGet.mockImplementation(async (url) => ({
      data: String(url).includes("/suppliers/company/")
        ? [{ id: "s1", name: "Proveedor A", isActive: true }]
        : { data: [{ ...variant(), attributes: { Title: "Default Title" } }], meta: { total: 1, totalPages: 1 } },
    }));
    render(<RegistrarCompraPage />);
    const option = await screen.findByRole("option", { name: "Proveedor A" });
    fireEvent.change(option.closest("select")!, { target: { value: "s1" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar Productos" }));
    const product = await screen.findByText("Celular");
    expect(screen.queryByText(/Default Title/)).not.toBeInTheDocument();
    fireEvent.click(within(product.closest("tr")!).getByRole("button", { name: "Agregar" }));
    await screen.findByLabelText("Cantidad de Celular");
    expect(screen.queryByText(/Default Title/)).not.toBeInTheDocument();
  });
});
