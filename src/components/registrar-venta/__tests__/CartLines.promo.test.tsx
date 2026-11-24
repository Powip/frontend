/** FEAT-32 M6a — línea con promo del motor: badge, precio de lista tachado, SKU y descuento manual sobre la promo. */
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CartLines from "@/components/registrar-venta/CartLines";
import { priceEngineLine } from "@/app/registrar-venta/saleEnginePricing";
import type { CartItem } from "@/interfaces/IOrder";

jest.mock("@/components/registrar-venta/Thumb", () => ({ __esModule: true, default: () => null }));

const line = (id: string, patch: Partial<CartItem> = {}): CartItem => ({
  id, inventoryItemId: `inv-${id}`, variantId: id, productName: `Blusa ${id}`, sku: `SOF-${id}`,
  quantity: 1, price: 89, pvp: 89, discount: 0, packId: null, priceSource: "catalog", ...patch,
});

function renderCart(cart: CartItem[]) {
  const noop = jest.fn();
  const props: ComponentProps<typeof CartLines> = {
    cart, packs: [], appliedPacks: {}, isAdmin: false,
    onQtyChange: noop, onRemove: noop, onSetPrice: noop, onApplyDiscount: noop,
    onClearDiscount: noop, onBulkPrice: noop, onBulkDiscount: noop,
    onRestorePvp: noop, onUndoPack: noop, pvsOpen: null, pvsLoading: false,
    pvsTotal: 0, onPvsChg: noop, onPvsConfirm: noop, onPvsCancel: noop,
    giftOpen: null, onChooseGift: noop, onChangeGift: noop, onGiftCancel: noop,
  };
  return render(<CartLines {...props} />);
}

describe("CartLines con el motor de promociones", () => {
  it("muestra la promo, el precio de lista tachado y el SKU", () => {
    const campaign = priceEngineLine(line("m"), { listPrice: 89, promoTotal: 71.2, promoId: "p1", labels: ["Cyber Wow"] });
    const volume = priceEngineLine(line("l"), { listPrice: 89, promoTotal: 70, promoId: "vol", labels: ["Volumen: 3 por S/ 210"] });
    renderCart([campaign, volume]);
    expect(screen.getByText("Cyber Wow −20%")).toBeInTheDocument();
    expect(screen.getByText("Volumen: 3 por S/ 210")).toBeInTheDocument();
    expect(screen.getAllByText("S/ 89.00")).toHaveLength(2);
    expect(screen.getAllByText("S/ 89.00")[0]).toHaveClass("line-through");
    expect(screen.getByText(/S\/ 71\.20/)).toBeInTheDocument();
    expect(screen.getByText("SOF-m")).toBeInTheDocument();
  });

  it("una línea sin SKU lo dice", () => {
    renderCart([line("x", { sku: "" })]);
    expect(screen.getByText("Sin SKU")).toBeInTheDocument();
  });

  it("el descuento manual se calcula sobre el precio de promo", async () => {
    const campaign = priceEngineLine(line("m"), { listPrice: 89, promoTotal: 71.2, promoId: "p1", labels: ["Cyber Wow"] });
    renderCart([campaign]);
    await userEvent.click(screen.getByRole("button", { name: "✎" }));
    expect(screen.getByText("% sobre S/ 71.20")).toBeInTheDocument();
  });
});
