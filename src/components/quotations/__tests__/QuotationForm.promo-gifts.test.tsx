import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import QuotationForm from "@/components/quotations/QuotationForm";
import { getQuotationCatalog, getQuotationInventories } from "@/services/quotationService";
import { evaluatePromotions } from "@/services/promotionsService";
import type { GiftPack } from "@/interfaces/IPack";
import type { Quotation } from "@/types/quotations";

// Un regalo GIFT viejo del navegador (localStorage) que antes se mostraba como «Regalo desbloqueado».
const mockLocalGift: GiftPack = {
  id: "local-gift", type: "GIFT", name: "Regalo local viejo", active: true, channels: [], triggerBy: "amount", minAmount: 1,
  gifts: [
    { variantId: "g1", productName: "Llavero", value: 5 },
    { variantId: "g2", productName: "Gorra", value: 5 },
  ],
} as GiftPack;
jest.mock("@/contexts/PacksContext", () => ({ usePacks: () => ({ packs: [mockLocalGift] }) }));
jest.mock("@/components/registrar-venta/SuggestionsPanel", () => ({ __esModule: true, default: () => null }));
jest.mock("@/services/quotationService", () => ({
  createQuotation: jest.fn(), updateQuotation: jest.fn(), getQuotationCatalog: jest.fn(), getQuotationInventories: jest.fn(),
  searchQuotationCustomers: jest.fn(), uploadQuotationLineImage: jest.fn(),
}));
jest.mock("@/services/promotionsService", () => ({ evaluatePromotions: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const crema = { productVariantId: "11111111-1111-4111-8111-111111111111", name: "Crema", sku: "CRE", unitPrice: 80, stockAvailable: 9 };
const gift = { promoId: "promo-1", name: "Llévate un neceser", variantId: "v-neceser", quantity: 1, sku: "NEC", productName: "Neceser", giftValue: 15 };

function renderForm(quotation?: Quotation) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <QuotationForm quotation={quotation} storeId="store-1" onClose={jest.fn()} onSaved={jest.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.mocked(getQuotationInventories).mockReset().mockResolvedValue([{ id: "inventory-1", name: "Principal", isActive: true }]);
  jest.mocked(getQuotationCatalog).mockReset().mockResolvedValue([crema]);
  jest.mocked(evaluatePromotions).mockReset().mockResolvedValue({ gifts: [gift] });
});

describe("Cotizaciones: regalos del backend (FEAT-24 H9)", () => {
  it("evalúa el carrito en /promos/evaluate con la tienda y sin canal, y muestra el regalo sin cobrarlo", async () => {
    renderForm();
    fireEvent.click(await screen.findByRole("button", { name: /^Crema/ }));
    await waitFor(() =>
      expect(evaluatePromotions).toHaveBeenCalledWith(
        { storeId: "store-1", channel: undefined, items: [{ productVariantId: crema.productVariantId, quantity: 1, unitPrice: 80, discountAmount: 0 }] },
        expect.anything(),
      ),
    );
    const panel = await screen.findByRole("region", { name: "Regalos de promociones" });
    expect(panel).toHaveTextContent("Regalos de promociones que aplican");
    expect(panel).toHaveTextContent("1 × Neceser");
    expect(panel).toHaveTextContent("Llévate un neceser · S/ 0.00");
    expect(panel).toHaveTextContent("La cotización no los suma");
  });

  it("ya no lee los regalos GIFT del navegador", async () => {
    jest.mocked(evaluatePromotions).mockResolvedValue({ gifts: [] });
    renderForm();
    fireEvent.click(await screen.findByRole("button", { name: /^Crema/ }));
    await waitFor(() => expect(evaluatePromotions).toHaveBeenCalled());
    expect(screen.queryByText(/Regalo desbloqueado/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Regalo local viejo/)).not.toBeInTheDocument();
  });

  it("las líneas manuales (sin variante) no van a la evaluación", async () => {
    renderForm({
      id: "quote-1", number: "COT-1", storeId: "store-1", inventoryId: "inventory-1", customerName: "Ana", customerPhone: "999999999",
      status: "PREVENTA", paymentType: "COMPLETO", expiresAt: new Date(Date.now() + 86400000).toISOString(),
      lines: [
        { id: "manual", name: "Crema negociada", quantity: 2, unitPrice: 35, isManual: true },
        { id: "real", productVariantId: crema.productVariantId, name: "Crema", quantity: 1, unitPrice: 80, stockAvailable: 9 },
      ],
    } as Quotation);
    await waitFor(() => expect(evaluatePromotions).toHaveBeenCalled());
    expect(jest.mocked(evaluatePromotions).mock.calls[0][0].items).toEqual([
      { productVariantId: crema.productVariantId, quantity: 1, unitPrice: 80, discountAmount: 0 },
    ]);
  });

  it("si el backend no responde, lo avisa sin bloquear la cotización", async () => {
    jest.mocked(evaluatePromotions).mockRejectedValue(new Error("caído"));
    renderForm();
    fireEvent.click(await screen.findByRole("button", { name: /^Crema/ }));
    expect(await screen.findByText("No se pudieron revisar los regalos de las promociones.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cotización" })).toBeEnabled();
  });
});
