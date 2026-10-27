import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import QuotationForm from "@/components/quotations/QuotationForm";
import axiosAuth from "@/lib/axiosAuth";
import { createQuotation, getQuotationCatalog } from "@/services/quotationService";
import type { BundlePack } from "@/interfaces/IPack";

jest.setTimeout(15000);

const mockPack: BundlePack = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", type: "BUNDLE", name: "Kit 300 g", active: true, channels: [], schemaVersion: 2,
  items: [
    { productId: "product-complement", productKey: "Complemento", productName: "Complemento", variantId: "complement", price: 20 },
    { productId: "product-supplement", productKey: "Suplemento anterior", productName: "Suplemento anterior", variantId: "supplement-300", sku: "SKU-ANTIGUO", attributes: { Tamaño: "300 g" }, price: 99 },
  ],
  packPrice: 100, shared: true, synced: false,
};
jest.mock("@/contexts/PacksContext", () => ({ usePacks: () => ({ packs: [mockPack] }) }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("@/services/quotationService", () => ({
  createQuotation: jest.fn(), updateQuotation: jest.fn(), getQuotationCatalog: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const complement = { productVariantId: "complement", name: "Complemento", sku: "COMP", unitPrice: 20, stockAvailable: 10 };
const small = { productVariantId: "supplement-150", name: "Suplemento actual", sku: "SUP-150", variant: "150 g", unitPrice: 49, stockAvailable: 100 };
const large = { productVariantId: "supplement-300", name: "Suplemento actual", sku: "SUP-300", variant: "300 g", unitPrice: 99, stockAvailable: 2 };

beforeAll(() => {
  Object.defineProperty(crypto, "randomUUID", { configurable: true, value: () => `line-${Math.random()}` });
});
beforeEach(() => {
  jest.resetAllMocks();
  (axiosAuth.get as jest.Mock).mockResolvedValue({ data: {
    id: "supplement-300", sku: "SUP-300", isActive: true, product: { name: "Suplemento actual", status: true },
  } });
  (getQuotationCatalog as jest.Mock).mockResolvedValue([complement, small, large]);
  (createQuotation as jest.Mock).mockResolvedValue({ id: "quotation-created" });
});

async function startBundle() {
  render(<QuotationForm storeId="store-fixture" onClose={jest.fn()} onSaved={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Nombre completo *"), { target: { value: "Cliente FICTICIO" } });
  fireEvent.change(screen.getByLabelText("Teléfono *"), { target: { value: "900000000" } });
  fireEvent.click(await screen.findByRole("button", { name: /^Complemento/ }));
  fireEvent.click(screen.getByRole("button", { name: /\+ Suplemento anterior · 300 g/ }));
}

test("quotation autofill uses exact 300 g after rename, applies bundle and saves that variant", async () => {
  await startBundle();
  const apply = await screen.findByRole("button", { name: "Aplicar bundle" });
  expect(createQuotation).not.toHaveBeenCalled();
  fireEvent.click(apply);
  expect(createQuotation).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Guardar cotización" }));
  await waitFor(() => expect(createQuotation).toHaveBeenCalledTimes(1));
  const payload = (createQuotation as jest.Mock).mock.calls[0][0];
  expect(payload.lines).toHaveLength(2);
  expect(payload.lines).toEqual(expect.arrayContaining([
    expect.objectContaining({ productVariantId: "supplement-300", sku: "SUP-300", variant: "300 g", isPack: true, quantity: 1 }),
  ]));
  expect(payload.lines.some((line: { productVariantId: string }) => line.productVariantId === "supplement-150")).toBe(false);
  expect(payload.lines.every((line: { packId?: string }) => line.packId === undefined)).toBe(true);
  expect(payload.lines.reduce((sum: number, line: { unitPrice: number; quantity: number }) => sum + line.unitPrice * line.quantity, 0)).toBe(100);
  expect(getQuotationCatalog).toHaveBeenCalledWith({ storeId: "store-fixture", search: "SUP-300" });
});

test.each(["missing", "out-of-stock"])("quotation refuses %s exact 300 g without replacing it with 150 g", async (reason) => {
  (getQuotationCatalog as jest.Mock).mockImplementation(({ search }) => Promise.resolve(
    search === "SUP-300"
      ? reason === "missing" ? [small] : [{ ...large, stockAvailable: 0 }, small]
      : [complement, small, large],
  ));
  await startBundle();
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(screen.queryByRole("button", { name: "Aplicar bundle" })).not.toBeInTheDocument();
  expect(screen.getAllByLabelText("Cantidad")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Guardar cotización" }));
  await waitFor(() => expect(createQuotation).toHaveBeenCalledTimes(1));
  expect((createQuotation as jest.Mock).mock.calls[0][0].lines).toEqual([
    expect.objectContaining({ productVariantId: "complement" }),
  ]);
});
