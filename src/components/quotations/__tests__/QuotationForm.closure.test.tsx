import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import QuotationForm from "../QuotationForm";
import {
  createQuotation,
  getQuotationCatalog,
  getQuotationInventories,
  searchQuotationCustomers,
  updateQuotation,
  uploadQuotationLineImage,
} from "@/services/quotationService";
import type { Quotation, QuotationCatalogItem, QuotationCustomer } from "@/types/quotations";

jest.mock("@/services/quotationService", () => ({
  createQuotation: jest.fn(),
  updateQuotation: jest.fn(),
  getQuotationCatalog: jest.fn(),
  getQuotationInventories: jest.fn(),
  searchQuotationCustomers: jest.fn(),
  uploadQuotationLineImage: jest.fn(),
}));
jest.mock("@/contexts/PacksContext", () => ({ usePacks: () => ({ packs: [] }) }));
jest.mock("@/components/registrar-venta/SuggestionsPanel", () => ({
  __esModule: true,
  default: ({ onAutoFillVolume }: { onAutoFillVolume: (pack: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onAutoFillVolume({ type: "VOLUME", product: { productKey: "Promo antigua" }, minQty: 1 })
      }
    >
      Completar promoción de prueba
    </button>
  ),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const product: QuotationCatalogItem = {
  productVariantId: "variant-real",
  name: "Crema catálogo",
  sku: "SKU-REAL",
  unitPrice: 100,
  stockAvailable: 8,
};
const quote: Quotation = {
  id: "quote-1",
  number: "COT-1",
  storeId: "store-1",
  inventoryId: "warehouse-1",
  customerName: "Ana",
  customerPhone: "999999999",
  status: "PREVENTA",
  paymentType: "ADELANTO",
  suggestedDeposit: 20,
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  lines: [
    {
      id: "manual-id",
      name: "Crema negociada",
      quantity: 2,
      unitPrice: 35,
      isManual: true,
      imageUrl: "https://cdn.example/manual.jpg",
      addedBy: "VENDEDOR",
    },
    {
      id: "other-id",
      productVariantId: "variant-other",
      name: "Otro SKU",
      quantity: 1,
      unitPrice: 10,
      stockAvailable: 5,
    },
  ],
  payments: [
    {
      id: "deposit-1",
      amount: 20,
      method: "YAPE_QR",
      status: "APROBADO",
      createdAt: new Date().toISOString(),
    },
  ],
  total: 80,
  pendingBalance: 60,
  approvedDeposit: 20,
  publicToken: "token",
  publicUrl: "/c/token",
  customerConfirmed: false,
  createdAt: new Date().toISOString(),
};
afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(getQuotationInventories)
    .mockResolvedValue([{ id: "warehouse-1", name: "Principal", isActive: true }]);
  jest.mocked(getQuotationCatalog).mockResolvedValue([product]);
  jest.mocked(searchQuotationCustomers).mockResolvedValue([]);
  jest.mocked(updateQuotation).mockResolvedValue(quote);
  jest.mocked(createQuotation).mockResolvedValue(quote);
  Object.defineProperty(crypto, "randomUUID", { configurable: true, value: () => "new-line-id" });
});

it("links only the selected manual line to a real SKU, retaining IDs, quantity, negotiated price, photo and other lines", async () => {
  render(
    <QuotationForm quotation={quote} storeId="store-1" onClose={jest.fn()} onSaved={jest.fn()} />,
  );
  await screen.findByRole("button", { name: /^Crema catálogo/ });
  fireEvent.click(screen.getByRole("button", { name: "Vincular con catálogo" }));
  fireEvent.click(await screen.findByRole("button", { name: /^Crema catálogo/ }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar cotización" }));
  await waitFor(() => expect(updateQuotation).toHaveBeenCalled());
  const payload = jest.mocked(updateQuotation).mock.calls[0][1];
  expect(payload.inventoryId).toBe("warehouse-1");
  expect(payload.suggestedDeposit).toBe(20);
  expect(payload).not.toHaveProperty("payments");
  expect(payload.lines).toEqual([
    expect.objectContaining({
      id: "manual-id",
      productVariantId: "variant-real",
      name: "Crema catálogo",
      sku: "SKU-REAL",
      quantity: 2,
      unitPrice: 35,
      imageUrl: "https://cdn.example/manual.jpg",
      isManual: false,
      addedBy: "VENDEDOR",
    }),
    expect.objectContaining({
      id: "other-id",
      productVariantId: "variant-other",
      quantity: 1,
      unitPrice: 10,
    }),
  ]);
});

it("searches the authenticated company customer directory by phone and carries the selected delivery identity", async () => {
  const customer: QuotationCustomer = {
    id: "customer-1",
    name: "María Quispe",
    phone: "987654321",
    address: "Calle 4",
    district: "Cusco",
    department: "Cusco",
    province: "Cusco",
    reference: "Puerta azul",
    documentNumber: "12345678",
  };
  jest.mocked(searchQuotationCustomers).mockResolvedValue([customer]);
  render(<QuotationForm storeId="store-1" onClose={jest.fn()} onSaved={jest.fn()} />);
  const input = screen.getByLabelText("Buscar cliente existente por nombre o teléfono");
  fireEvent.change(input, { target: { value: "987" } });
  fireEvent.change(input, { target: { value: "987654" } });
  fireEvent.click(await screen.findByRole("button", { name: /María Quispe · 987654321/ }));
  expect(searchQuotationCustomers).toHaveBeenCalledTimes(1);
  expect(searchQuotationCustomers).toHaveBeenCalledWith(
    { storeId: "store-1", search: "987654" },
    expect.any(AbortSignal),
  );
  expect(screen.getByLabelText("Nombre completo *")).toHaveValue("María Quispe");
  expect(screen.getByLabelText("Teléfono *")).toHaveValue("987654321");
  fireEvent.click(await screen.findByRole("button", { name: /^Crema catálogo/ }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar cotización" }));
  await waitFor(() =>
    expect(createQuotation).toHaveBeenCalledWith(
      expect.objectContaining({
        customerName: "María Quispe",
        address: {
          address: "Calle 4",
          district: "Cusco",
          department: "Cusco",
          province: "Cusco",
          reference: "Puerta azul",
          documentNumber: "12345678",
        },
      }),
    ),
  );
});

it("requires a deliberate warehouse choice when several are active and aborts the previous catalog on a scope change", async () => {
  jest.mocked(getQuotationInventories).mockResolvedValue([
    { id: "warehouse-1", name: "Principal", isActive: true },
    { id: "warehouse-2", name: "Sucursal", isActive: true },
    { id: "inactive", name: "Inactivo", isActive: false },
  ]);
  render(<QuotationForm storeId="store-1" onClose={jest.fn()} onSaved={jest.fn()} />);
  await screen.findByRole("option", { name: "Sucursal" });
  expect(screen.getByLabelText("Almacén *")).toHaveValue("");
  expect(screen.queryByRole("option", { name: "Inactivo" })).not.toBeInTheDocument();
  expect(getQuotationCatalog).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Almacén *"), { target: { value: "warehouse-1" } });
  await screen.findByRole("button", { name: /^Crema catálogo/ });
  const signal = jest.mocked(getQuotationCatalog).mock.calls[0][1];
  fireEvent.change(screen.getByLabelText("Almacén *"), { target: { value: "warehouse-2" } });
  expect(signal?.aborted).toBe(true);
  await waitFor(() =>
    expect(getQuotationCatalog).toHaveBeenLastCalledWith(
      { storeId: "store-1", inventoryId: "warehouse-2", search: "", page: 1, limit: 30 },
      expect.any(AbortSignal),
    ),
  );
});

it("returns from the real product creation flow with the draft intact, refreshes and maps the new SKU", async () => {
  render(
    <QuotationForm quotation={quote} storeId="store-1" onClose={jest.fn()} onSaved={jest.fn()} />,
  );
  await screen.findByRole("button", { name: /^Crema catálogo/ });
  const createLink = screen.getByRole("link", { name: "Crear producto en otra pestaña" });
  expect(createLink).toHaveAttribute("href", "/productos");
  expect(createLink).toHaveAttribute("target", "_blank");
  fireEvent.click(createLink);
  expect(screen.getByLabelText("Nombre completo *")).toHaveValue("Ana");
  expect(screen.getAllByLabelText("Precio unitario")[0]).toHaveValue(35);
  jest
    .mocked(getQuotationCatalog)
    .mockResolvedValue([
      { ...product, name: "Crema negociada creada", productVariantId: "new-variant" },
    ]);
  fireEvent.click(screen.getByRole("button", { name: "Ya creé el producto: actualizar catálogo" }));
  fireEvent.click(await screen.findByRole("button", { name: /^Crema negociada creada/ }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar cotización" }));
  await waitFor(() =>
    expect(updateQuotation).toHaveBeenCalledWith(
      "quote-1",
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({
            id: "manual-id",
            productVariantId: "new-variant",
            quantity: 2,
            unitPrice: 35,
          }),
        ]),
      }),
    ),
  );
});

it("uploads an optional manual-product image and blocks save while upload is pending", async () => {
  let finishUpload!: (url: string) => void;
  jest.mocked(uploadQuotationLineImage).mockReturnValue(
    new Promise((resolve) => {
      finishUpload = resolve;
    }),
  );
  render(
    <QuotationForm quotation={quote} storeId="store-1" onClose={jest.fn()} onSaved={jest.fn()} />,
  );
  await screen.findByRole("button", { name: /^Crema catálogo/ });
  const file = new File(["image"], "product.jpg", { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText("Foto del producto (opcional)"), {
    target: { files: [file] },
  });
  expect(screen.getByRole("button", { name: "Guardar cotización" })).toBeDisabled();
  await act(async () => finishUpload("https://cdn.example/uploaded.jpg"));
  expect(screen.getByRole("img", { name: "Foto de Crema negociada" })).toHaveAttribute(
    "src",
    "https://cdn.example/uploaded.jpg",
  );
  fireEvent.click(screen.getByRole("button", { name: "Guardar cotización" }));
  await waitFor(() =>
    expect(updateQuotation).toHaveBeenCalledWith(
      "quote-1",
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({
            id: "manual-id",
            imageUrl: "https://cdn.example/uploaded.jpg",
            isManual: true,
          }),
        ]),
      }),
    ),
  );
});

it("ignores a late customer lookup and clears an old customer's address when the identity is edited", async () => {
  jest.useFakeTimers();
  let finishOldLookup!: (customers: QuotationCustomer[]) => void;
  jest.mocked(searchQuotationCustomers).mockImplementation(({ search }) =>
    search === "Ana"
      ? new Promise((resolve) => {
          finishOldLookup = resolve;
        })
      : Promise.resolve([
          {
            id: "new-customer",
            name: "Luisa",
            phone: "900000000",
            address: "Calle Luisa",
            district: "Breña",
          },
        ]),
  );
  render(
    <QuotationForm
      quotation={{ ...quote, address: { address: "Antigua", district: "Lima" } }}
      storeId="store-1"
      onClose={jest.fn()}
      onSaved={jest.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Buscar cliente existente por nombre o teléfono"), {
    target: { value: "Ana" },
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  expect(searchQuotationCustomers).toHaveBeenCalledTimes(1);
  const oldSignal = jest.mocked(searchQuotationCustomers).mock.calls[0][1];
  fireEvent.change(screen.getByLabelText("Buscar cliente existente por nombre o teléfono"), {
    target: { value: "Luisa" },
  });
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  expect(screen.getByRole("button", { name: /Luisa · 900000000/ })).toBeInTheDocument();
  await act(async () => finishOldLookup([{ id: "old", name: "Ana anterior", phone: "999" }]));
  expect(screen.queryByRole("button", { name: /Ana anterior/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Luisa · 900000000/ }));
  fireEvent.change(screen.getByLabelText("Teléfono *"), { target: { value: "911111111" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cotización" }));
  await waitFor(() =>
    expect(updateQuotation).toHaveBeenCalledWith(
      "quote-1",
      expect.objectContaining({ customerPhone: "911111111", address: null }),
    ),
  );
  jest.useRealTimers();
});

it("discards an older warehouse promotion response without adding its variant to the newly selected warehouse", async () => {
  let finishOldCatalog!: (items: QuotationCatalogItem[]) => void;
  jest.mocked(getQuotationInventories).mockResolvedValue([
    { id: "warehouse-1", name: "Principal", isActive: true },
    { id: "warehouse-2", name: "Sucursal", isActive: true },
  ]);
  jest.mocked(getQuotationCatalog).mockImplementation(({ search }) =>
    search === "Promo antigua"
      ? new Promise((resolve) => {
          finishOldCatalog = resolve;
        })
      : Promise.resolve([]),
  );
  render(<QuotationForm storeId="store-1" onClose={jest.fn()} onSaved={jest.fn()} />);
  await screen.findByRole("option", { name: "Sucursal" });
  fireEvent.change(screen.getByLabelText("Almacén *"), { target: { value: "warehouse-1" } });
  fireEvent.click(screen.getByRole("button", { name: "Completar promoción de prueba" }));
  expect(getQuotationCatalog).toHaveBeenCalledWith(
    expect.objectContaining({ inventoryId: "warehouse-1", search: "Promo antigua" }),
    undefined,
  );
  fireEvent.change(screen.getByLabelText("Almacén *"), { target: { value: "warehouse-2" } });
  await act(async () =>
    finishOldCatalog([
      { ...product, name: "Promo antigua", productVariantId: "variant-warehouse-A" },
    ]),
  );
  expect(screen.getByLabelText("Almacén *")).toHaveValue("warehouse-2");
  expect(screen.queryByLabelText("Cantidad")).not.toBeInTheDocument();
  expect(screen.queryByText("Promo antigua")).not.toBeInTheDocument();
  expect(createQuotation).not.toHaveBeenCalled();
});
