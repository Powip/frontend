import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SalePackResults from "@/components/registrar-venta/SalePackResults";
import { listPacks, type PackView } from "@/services/packsService";
import { addPackLine, packAvailableIn } from "@/lib/packs/salePack";
import { buildOrderItem } from "@/app/registrar-venta/orderItemPricing";
import { applySuggestedPrices } from "@/hooks/useSuggestedPrices";
import type { CartItem } from "@/interfaces/IOrder";

jest.mock("next/image", () => ({ __esModule: true, default: () => null }));
jest.mock("@/services/packsService", () => ({
  ...jest.requireActual("@/services/packsService"),
  listPacks: jest.fn(),
}));

const KIT: PackView = {
  id: "p-kit", variantId: "v-kit", name: "Kit verano", description: null, sku: "KIT-001", productSku: "KIT", powipEan: "2100000000017",
  barcode: null, imageUrl: null, price: 90, active: true, categoryId: null, brandId: null,
  components: [
    { variantId: "v-polo", quantity: 2, productId: "p-polo", productName: "Polo", sku: "POL-M", attributeValues: { Talla: "M" }, imageUrl: null, active: true },
    { variantId: "v-gorra", quantity: 1, productId: "p-gorra", productName: "Gorra", sku: "GOR", attributeValues: {}, imageUrl: null, active: true },
  ],
  available: {
    total: 7,
    byWarehouse: [
      { inventoryId: "i1", inventoryName: "Breña", storeId: "s1", available: 3 },
      { inventoryId: "i2", inventoryName: "Surco", storeId: "s1", available: 4 },
    ],
  },
};
const page = (data: PackView[], total = data.length) => ({ data, meta: { page: 1, limit: 12, total, totalPages: 1 } });

function renderResults(props: Partial<React.ComponentProps<typeof SalePackResults>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const onAddPack = jest.fn();
  render(
    <QueryClientProvider client={client}>
      <SalePackResults query="" inventoryId="i1" qtyInCartByVariant={() => 0} onAddPack={onAddPack} {...props} />
    </QueryClientProvider>,
  );
  return { onAddPack };
}

beforeEach(() => jest.mocked(listPacks).mockReset());

describe("packs en el buscador de la venta manual (FEAT-24 H9)", () => {
  it("lista los packs activos con «Pack», su contenido y el disponible del almacén elegido", async () => {
    jest.mocked(listPacks).mockResolvedValue(page([KIT]));
    renderResults();
    const row = await screen.findByRole("button", { name: "Agregar el pack Kit verano" });
    expect(within(row).getByText("Pack")).toBeInTheDocument();
    expect(within(row).getByText("3 u.")).toBeInTheDocument();
    expect(within(row).getByText("S/ 90.00")).toBeInTheDocument();
    expect(within(row).getByTestId("pack-line-contents")).toHaveTextContent("2 × Polo");
    expect(within(row).getByTestId("pack-line-contents")).toHaveTextContent("1 × Gorra");
    expect(listPacks).toHaveBeenCalledWith({ q: undefined, active: true, limit: 12 }, expect.anything());
  });

  it("FEAT-32 M5: un pack «a elegir» o de creadora sin aprobar aparece deshabilitado con el motivo", async () => {
    const choose: PackView = { ...KIT, id: "p-jeans", name: "2 jeans", packType: "CHOOSE", components: [] };
    const creator: PackView = { ...KIT, id: "p-cre", name: "Look Vale", approvalStatus: "REJECTED" };
    jest.mocked(listPacks).mockResolvedValue(page([KIT, choose, creator]));
    const user = userEvent.setup();
    const { onAddPack } = renderResults();
    const jeans = await screen.findByRole("button", { name: "Agregar el pack 2 jeans" });
    expect(jeans).toBeDisabled();
    expect(jeans).toHaveTextContent("Pack a elegir: pronto se podrá vender aquí.");
    expect(screen.getByRole("button", { name: "Agregar el pack Look Vale" })).toHaveTextContent("Pack de creadora sin aprobar: no se vende.");
    expect(screen.getByRole("button", { name: "Agregar el pack Look Vale" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Agregar el pack Kit verano" })).toBeEnabled();
    await user.click(jeans);
    expect(onAddPack).not.toHaveBeenCalled();
  });

  it("al tocarlo avisa con el pack", async () => {
    jest.mocked(listPacks).mockResolvedValue(page([KIT]));
    const { onAddPack } = renderResults();
    await userEvent.click(await screen.findByRole("button", { name: "Agregar el pack Kit verano" }));
    expect(onAddPack).toHaveBeenCalledWith(KIT);
  });

  it("sin componentes en el almacén queda «Bajo pedido»; sin respuesta de logística, «Stock sin dato»", async () => {
    jest.mocked(listPacks).mockResolvedValue(page([KIT, { ...KIT, id: "p-2", variantId: "v-2", name: "Dúo", available: null }]));
    renderResults({ inventoryId: "i9" });
    expect(within(await screen.findByRole("button", { name: "Agregar el pack Kit verano" })).getByText("Bajo pedido")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: "Agregar el pack Dúo" })).getByText("Stock sin dato")).toBeInTheDocument();
  });

  it("busca con el texto del buscador", async () => {
    jest.mocked(listPacks).mockResolvedValue(page([KIT], 15));
    renderResults({ query: "  kit " });
    await waitFor(() => expect(listPacks).toHaveBeenCalledWith({ q: "kit", active: true, limit: 12 }, expect.anything()));
    expect(await screen.findByText("Hay 14 pack(s) más: busca por nombre o SKU.")).toBeInTheDocument();
  });

  it("si la búsqueda falla o no hay almacén, no muestra nada", async () => {
    jest.mocked(listPacks).mockRejectedValue(new Error("caído"));
    renderResults();
    await waitFor(() => expect(listPacks).toHaveBeenCalled());
    expect(screen.queryByRole("region", { name: "Packs" })).not.toBeInTheDocument();
    jest.mocked(listPacks).mockClear();
    renderResults({ inventoryId: null });
    expect(listPacks).not.toHaveBeenCalled();
  });
});

describe("línea del pack en el carrito (FEAT-24 H9)", () => {
  it("disponible por almacén: el del almacén, 0 si no está y null si logística no respondió", () => {
    expect(packAvailableIn(KIT, "i2")).toBe(4);
    expect(packAvailableIn(KIT, "i9")).toBe(0);
    expect(packAvailableIn({ available: null }, "i1")).toBeNull();
  });

  it("agrega la variante del pack con su precio y contenido, y la segunda vez suma 1", () => {
    const once = addPackLine([], KIT, () => "line-1");
    expect(once).toEqual([
      expect.objectContaining({
        id: "line-1", variantId: "v-kit", inventoryItemId: "v-kit", trackingMode: "NONE", productName: "Kit verano", sku: "KIT-001",
        quantity: 1, price: 90, pvp: 90, packId: null, priceSource: "catalog",
        packComponents: [
          { variantId: "v-polo", quantity: 2, sku: "POL-M", productName: "Polo" },
          { variantId: "v-gorra", quantity: 1, sku: "GOR", productName: "Gorra" },
        ],
      }),
    ]);
    expect(addPackLine(once, KIT, () => "line-2")).toEqual([expect.objectContaining({ id: "line-1", quantity: 2 })]);
  });

  it("no se junta con una línea de promo ni con un regalo de la misma variante", () => {
    const promoLine = { ...addPackLine([], KIT, () => "promo")[0], packId: "promo-1" } as CartItem;
    expect(addPackLine([promoLine], KIT, () => "nuevo")).toHaveLength(2);
  });

  it("va al backend como la variante del pack, sin unidades (ms-ventas lo expande)", () => {
    const [line] = addPackLine([], KIT, () => "line-1");
    const item = buildOrderItem(line);
    expect(item).toEqual(expect.objectContaining({ productVariantId: "v-kit", quantity: 1, unitPrice: 90, discountAmount: 0, packId: null, isGift: false }));
    expect(item).not.toHaveProperty("unitIds");
  });

  it("toma el precio de la lista si aplica", () => {
    const cart = addPackLine([], KIT, () => "line-1");
    expect(applySuggestedPrices(cart, [{ variantId: "v-kit", price: 79.9, compareAtPrice: null, listId: "l1" }])).toEqual([
      expect.objectContaining({ price: 79.9, pvp: 79.9, priceSource: "list" }),
    ]);
  });
});
