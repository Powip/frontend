/** FEAT-32 M6a — bundle anterior por producto: se elige la variante (ya no la de más stock) (§6.18). */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BundleVariantPicker from "@/components/registrar-venta/BundleVariantPicker";
import type { InventoryItemForSale } from "@/interfaces/IProduct";

const variant = (variantId: string, sku: string, availableStock: number, talla: string): InventoryItemForSale => ({
  inventoryItemId: `inv-${variantId}`, variantId, productName: "Blusa Sofía", sku, price: 89, availableStock, physicalStock: availableStock,
  attributes: { Color: "Crema", Talla: talla },
});

function renderPicker(onPick = jest.fn(), onClose = jest.fn()) {
  const loadVariants = jest.fn().mockResolvedValue([variant("s", "SOF-S-CRE", 0, "S"), variant("m", "SOF-M-CRE", 12, "M")]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <BundleVariantPicker
        item={{ productKey: "Blusa Sofía", productName: "Blusa Sofía", price: 89 }}
        inventoryId="warehouse-1"
        loadVariants={loadVariants}
        onPick={onPick}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return { loadVariants, onPick, onClose };
}

describe("BundleVariantPicker", () => {
  it("pide elegir la variante y agrega la elegida (no la de más stock)", async () => {
    const { loadVariants, onPick, onClose } = renderPicker();
    expect(screen.getByText("Elige la variante de cada producto del bundle")).toBeInTheDocument();
    const small = await screen.findByRole("radio", { name: /Crema \/ S/ });
    expect(loadVariants).toHaveBeenCalledWith("Blusa Sofía");
    expect(small).toHaveTextContent("SOF-S-CRE");
    expect(small).toHaveTextContent("sin stock en este almacén");
    expect(screen.getByRole("radio", { name: /Crema \/ M/ })).toHaveTextContent("12 disp.");

    const add = screen.getByRole("button", { name: "Agregar" });
    expect(add).toBeDisabled();
    await userEvent.click(small);
    expect(small).toHaveAttribute("aria-checked", "true");
    await userEvent.click(add);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ variantId: "s", sku: "SOF-S-CRE" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("al cancelar no agrega nada", async () => {
    const { onPick, onClose } = renderPicker();
    await screen.findByRole("radio", { name: /Crema \/ M/ });
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onPick).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
