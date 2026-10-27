import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import CartLines from "@/components/registrar-venta/CartLines";
import type { BundlePack } from "@/interfaces/IPack";

jest.mock("@/components/registrar-venta/Thumb", () => ({
  __esModule: true, default: () => null,
}));

test("an applied bundle shows its actual size and SKU in the cart", () => {
  const pack: BundlePack = {
    id: "pack-300", type: "BUNDLE", name: "Kit 300 g", active: true, channels: [], schemaVersion: 2,
    items: [
      { productKey: "Suplemento", productName: "Suplemento", variantId: "variant-300", price: 99 },
      { productKey: "Complemento", productName: "Complemento", variantId: "complement", price: 20 },
    ], packPrice: 100,
  };
  const noop = jest.fn();
  const props: ComponentProps<typeof CartLines> = {
    cart: [
      { id: "line-300", inventoryItemId: "inventory-300", variantId: "variant-300", productName: "Suplemento actual", sku: "SUP-300-ACTUAL", attributes: { Tamaño: "300 g" }, trackingMode: "NONE", price: 83.19, quantity: 1, discount: 0, packId: pack.id },
      { id: "line-complement", inventoryItemId: "inventory-complement", variantId: "complement", productName: "Complemento", sku: "COMP", trackingMode: "NONE", price: 16.81, quantity: 1, discount: 0, packId: pack.id },
    ],
    packs: [pack], appliedPacks: {}, isAdmin: false,
    onQtyChange: noop, onRemove: noop, onSetPrice: noop, onApplyDiscount: noop,
    onClearDiscount: noop, onBulkPrice: noop, onBulkDiscount: noop,
    onRestorePvp: noop, onUndoPack: noop, pvsOpen: null, pvsLoading: false,
    pvsTotal: 0, onPvsChg: noop, onPvsConfirm: noop, onPvsCancel: noop,
    giftOpen: null, onChooseGift: noop, onChangeGift: noop, onGiftCancel: noop,
  };
  render(<CartLines {...props} />);
  expect(screen.getByText("Suplemento actual")).toBeInTheDocument();
  expect(screen.getByText("300 g · SUP-300-ACTUAL")).toBeInTheDocument();
  expect(screen.queryByText(/150 g/)).not.toBeInTheDocument();
});
