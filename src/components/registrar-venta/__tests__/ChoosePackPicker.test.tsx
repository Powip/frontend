/** FEAT-32 M6b — «Elige talla y color» del pack «a elegir»: un selector por unidad y sin las variantes sin stock (§6.14). */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ChoosePackPicker from "@/components/registrar-venta/ChoosePackPicker";
import { getStockByVariants, type VariantStock } from "@/services/inventoryItems.service";
import type { PackView } from "@/services/packsService";

jest.mock("@/services/inventoryItems.service", () => ({ getStockByVariants: jest.fn() }));

const variant = (variantId: string, sku: string, attributeValues: Record<string, string>, active = true) => ({ variantId, sku, attributeValues, active, imageUrl: null });
const JEANS: PackView = {
  id: "p-jeans", variantId: "aaaaaaaa-0000-4000-8000-000000000001", name: "Pack jeans", description: null, sku: "PCK-0002", productSku: null,
  powipEan: null, barcode: null, imageUrl: null, price: 259, active: true, categoryId: null, brandId: null, components: [], packType: "CHOOSE",
  choiceComponents: [
    {
      slot: 0, productId: "p-jim", productName: "Jean Jimena", quantity: 2,
      variants: [
        variant("jim-s", "JIM-S", { Talla: "S", Color: "Celeste" }),
        variant("jim-m", "JIM-M", { Talla: "M", Color: "Celeste" }),
        variant("jim-l", "JIM-L", { Talla: "L", Color: "Celeste" }),
        variant("jim-x", "JIM-X", { Talla: "XL", Color: "Celeste" }, false),
      ],
    },
    { slot: 1, productId: "p-polo", productName: "Polo Luisa", quantity: 1, variants: [variant("pol-u", "POL-U", { Talla: "U" })] },
  ],
  available: null,
};

const stockRow = (variantId: string, quantity: number, reserved = 0, inventoryId = "w1"): VariantStock => ({
  variant_id: variantId, quantity, reserved_quantity: reserved, available: Math.max(0, quantity - reserved),
  inventories: [{ inventory_id: inventoryId, inventory_name: "Almacén", store_id: null, quantity, reserved_quantity: reserved }],
});

function renderPicker(props: Partial<React.ComponentProps<typeof ChoosePackPicker>> = {}) {
  const onConfirm = jest.fn();
  const onClose = jest.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <ChoosePackPicker pack={JEANS} inventoryId="w1" onConfirm={onConfirm} onClose={onClose} {...props} />
    </QueryClientProvider>,
  );
  return { onConfirm, onClose };
}

beforeEach(() => {
  jest.mocked(getStockByVariants).mockReset();
  jest.mocked(getStockByVariants).mockResolvedValue([
    stockRow("jim-s", 3),
    stockRow("jim-m", 5, 1),
    stockRow("jim-l", 2, 2), // todo reservado: sin stock libre
    stockRow("pol-u", 8),
  ]);
});

describe("ChoosePackPicker", () => {
  it("un selector por unidad de cada componente, sin las variantes sin stock ni inactivas", async () => {
    renderPicker();
    expect(screen.getByRole("dialog", { name: "Elige talla y color" })).toBeInTheDocument();
    const first = await screen.findByRole("combobox", { name: "Jean Jimena (unidad 1 de 2)" });
    expect(screen.getByRole("combobox", { name: "Jean Jimena (unidad 2 de 2)" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Polo Luisa" })).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(3);
    expect(within(first).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Elige variante…",
      "S / Celeste · JIM-S · 3 disp.",
      "M / Celeste · JIM-M · 4 disp.",
    ]);
    expect(getStockByVariants).toHaveBeenCalledWith(["jim-l", "jim-m", "jim-s", "pol-u"]);
  });

  it("«Agregar al pedido» se habilita solo con todas las unidades elegidas; las unidades arrancan iguales", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPicker();
    const add = screen.getByRole("button", { name: "Agregar al pedido" });
    expect(add).toBeDisabled();

    await user.selectOptions(await screen.findByRole("combobox", { name: "Jean Jimena (unidad 1 de 2)" }), "jim-m");
    expect(screen.getByRole("combobox", { name: "Jean Jimena (unidad 2 de 2)" })).toHaveValue("jim-m");
    expect(add).toBeDisabled();
    await user.selectOptions(screen.getByRole("combobox", { name: "Jean Jimena (unidad 2 de 2)" }), "jim-s");
    expect(screen.getByRole("combobox", { name: "Jean Jimena (unidad 1 de 2)" })).toHaveValue("jim-m");
    await user.selectOptions(screen.getByRole("combobox", { name: "Polo Luisa" }), "pol-u");
    expect(add).toBeEnabled();

    await user.click(add);
    expect(onConfirm).toHaveBeenCalledWith({
      choice: [
        { slot: 0, variantId: "jim-m", quantity: 1 },
        { slot: 0, variantId: "jim-s", quantity: 1 },
        { slot: 1, variantId: "pol-u", quantity: 1 },
      ],
      components: [
        { variantId: "jim-m", quantity: 1, sku: "JIM-M", productName: "Jean Jimena M / Celeste" },
        { variantId: "jim-s", quantity: 1, sku: "JIM-S", productName: "Jean Jimena S / Celeste" },
        { variantId: "pol-u", quantity: 1, sku: "POL-U", productName: "Polo Luisa U" },
      ],
    });
  });

  it("un componente sin ninguna variante con stock avisa y no deja agregar", async () => {
    jest.mocked(getStockByVariants).mockResolvedValue([stockRow("jim-m", 5), stockRow("pol-u", 0)]);
    const user = userEvent.setup();
    renderPicker();
    expect(await screen.findByText("Sin stock de Polo Luisa en este almacén")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Polo Luisa" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Jean Jimena (unidad 1 de 2)" }), "jim-m");
    expect(screen.getByRole("button", { name: "Agregar al pedido" })).toBeDisabled();
  });

  it("sin respuesta de logística ofrece las activas con «stock sin confirmar»", async () => {
    jest.mocked(getStockByVariants).mockRejectedValue(new Error("caído"));
    renderPicker();
    const first = await screen.findByRole("combobox", { name: "Jean Jimena (unidad 1 de 2)" });
    expect(screen.getByText(/No se pudo confirmar el stock del almacén/)).toBeInTheDocument();
    expect(within(first).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Elige variante…",
      "S / Celeste · JIM-S · stock sin confirmar",
      "M / Celeste · JIM-M · stock sin confirmar",
      "L / Celeste · JIM-L · stock sin confirmar",
    ]);
  });

  it("«Cambiar variantes»: arranca con la elección de la línea y la sigue ofreciendo aunque no tenga stock libre", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPicker({
      initialPicks: { 0: ["jim-l", "jim-l"], 1: ["pol-u"] },
      keepVariantIds: new Set(["jim-l", "pol-u"]),
      confirmLabel: "Guardar cambios",
    });
    const first = await screen.findByRole("combobox", { name: "Jean Jimena (unidad 1 de 2)" });
    expect(first).toHaveValue("jim-l");
    expect(within(first).getByRole("option", { name: "L / Celeste · JIM-L · sin stock libre" })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Jean Jimena (unidad 2 de 2)" }), "jim-s");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      choice: [{ slot: 0, variantId: "jim-l", quantity: 1 }, { slot: 0, variantId: "jim-s", quantity: 1 }, { slot: 1, variantId: "pol-u", quantity: 1 }],
    }));
  });

  it("Cancelar cierra sin elegir", async () => {
    const { onClose, onConfirm } = renderPicker();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
