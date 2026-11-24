/** FEAT-32 M6a — totales de la venta nueva: Subtotal, Descuentos por promociones y Descuento manual (§7.17). */
import { render, screen } from "@testing-library/react";
import SalePromoTotals from "@/components/registrar-venta/SalePromoTotals";
import { priceEngineLine } from "@/app/registrar-venta/saleEnginePricing";
import type { CartItem } from "@/interfaces/IOrder";

const line = (id: string, patch: Partial<CartItem> = {}): CartItem => ({
  id, inventoryItemId: `inv-${id}`, variantId: id, productName: id, sku: id.toUpperCase(),
  quantity: 1, price: 89, pvp: 89, discount: 0, packId: null, priceSource: "catalog", ...patch,
});
const row = (label: string) => screen.getByText(label).parentElement;

describe("SalePromoTotals", () => {
  it("Subtotal a precio de lista y descuentos por promociones; sin descuento manual no se muestra", () => {
    const volume = priceEngineLine(line("sof", { quantity: 3 }), { listPrice: 89, promoTotal: 210, promoId: "vol", labels: [] });
    render(<SalePromoTotals lines={[volume]} moneyPrefix="S/" />);
    expect(row("Subtotal")).toHaveTextContent("S/ 267.00");
    expect(row("Descuentos por promociones")).toHaveTextContent("- S/ 57.00");
    expect(screen.queryByText("Descuento manual")).not.toBeInTheDocument();
  });

  it("el descuento manual se suma aparte y avisa mientras recalcula", () => {
    const promo = priceEngineLine(line("a", { discMode: "pct", discValue: 10 }), { listPrice: 100, promoTotal: 80, promoId: "p1", labels: [] });
    render(<SalePromoTotals lines={[promo]} moneyPrefix="S/" pending />);
    expect(row("Subtotal")).toHaveTextContent("S/ 100.00");
    expect(row("Descuentos por promociones")).toHaveTextContent("- S/ 20.00");
    expect(row("Descuento manual")).toHaveTextContent("- S/ 8.00");
    expect(screen.getByRole("status")).toHaveTextContent("Calculando promociones…");
  });
});
