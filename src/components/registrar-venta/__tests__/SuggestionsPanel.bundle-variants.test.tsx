import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import SuggestionsPanel from "../SuggestionsPanel";
import type { BundlePack } from "@/interfaces/IPack";
import { matchesBundleItem } from "@/utils/bundleVariants";

const bundle: BundlePack = {
  id: "kit-300", type: "BUNDLE", schemaVersion: 2, name: "Kit salud",
  active: true, channels: ["WHATSAPP"], packPrice: 120,
  items: [
    {
      productId: "supplement", productKey: "Suplemento", productName: "Suplemento",
      variantId: "supplement-300", sku: "SUP-300", attributes: { Tamaño: "300 g" }, price: 100,
    },
    {
      productId: "vitamin", productKey: "Vitamina", productName: "Vitamina",
      variantId: "vitamin-1", sku: "VIT-1", price: 50,
    },
  ],
};

function panelProps(overrides: Partial<ComponentProps<typeof SuggestionsPanel>> = {}) {
  const cart = [
    { variantId: "supplement-150", productName: "Suplemento" },
    { variantId: "vitamin-1", productName: "Vitamina" },
  ];
  return {
    packs: [bundle], channel: "WHATSAPP", appliedPacks: {}, pendingHints: [],
    modelQtyInCart: jest.fn(() => 1),
    bundleQtyInCart: jest.fn((ref) => cart.filter((line) => matchesBundleItem(ref, line)).length),
    subtotalPayable: 99, totalUnits: 2, isAdmin: true,
    onApplyPack: jest.fn(), onAutoFillVolume: jest.fn(), onAutoAddBundleItem: jest.fn(),
    ...overrides,
  } satisfies ComponentProps<typeof SuggestionsPanel>;
}

describe("SuggestionsPanel — componentes de bundle por variante", () => {
  it("con 150 g presente sigue mostrando 300 g como faltante y transmite su referencia completa", () => {
    const props = panelProps();
    const submit = jest.fn();
    render(<form onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <SuggestionsPanel {...props} />
    </form>);

    expect(screen.queryByRole("button", { name: "Aplicar bundle" })).not.toBeInTheDocument();
    const add = screen.getByRole("button", { name: "+ Suplemento · 300 g" });
    fireEvent.click(add);
    expect(props.onAutoAddBundleItem).toHaveBeenCalledWith(bundle.items[0]);
    expect(props.modelQtyInCart).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it("la sugerencia lista la presentación y SKU para poder verificar qué bundle se aplica", () => {
    const props = panelProps({ pendingHints: [bundle], bundleQtyInCart: () => 1 });
    render(<SuggestionsPanel {...props} />);

    expect(screen.getByText(/Suplemento · 300 g \+ Vitamina · VIT-1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar bundle" }));
    expect(props.onApplyPack).toHaveBeenCalledWith(bundle);
  });

  it("revalida una sugerencia previa si el carrito ya sólo tiene la presentación de 150 g", () => {
    render(<SuggestionsPanel {...panelProps({ pendingHints: [bundle] })} />);

    expect(screen.queryByRole("button", { name: "Aplicar bundle" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Suplemento · 300 g" })).toBeInTheDocument();
  });

  it("no ofrece un v2 incompleto aunque el nombre tenga unidades y llegue como pendingHint", () => {
    const { variantId: _variantId, ...legacyRef } = bundle.items[0];
    const incomplete: BundlePack = { ...bundle, items: [legacyRef, bundle.items[1]] };
    const props = panelProps({ packs: [incomplete], pendingHints: [incomplete], bundleQtyInCart: () => 1 });
    render(<SuggestionsPanel {...props} />);

    expect(screen.queryByRole("button", { name: "Aplicar bundle" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Kit salud/)).not.toBeInTheDocument();
  });

  it("legacy conserva una sugerencia por producto sin inventar una variante", () => {
    const { variantId: _variantId, sku: _sku, attributes: _attributes, ...legacyRef } = bundle.items[0];
    const legacy: BundlePack = { ...bundle, schemaVersion: undefined, items: [legacyRef, bundle.items[1]] };
    const props = panelProps({
      packs: [legacy], bundleQtyInCart: (ref) => ref.productKey === "Vitamina" ? 1 : 0,
    });
    render(<SuggestionsPanel {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "+ Suplemento" }));
    expect(props.onAutoAddBundleItem).toHaveBeenCalledWith(legacyRef);
    expect(props.onAutoAddBundleItem.mock.calls[0][0]).not.toHaveProperty("variantId");
  });
});
