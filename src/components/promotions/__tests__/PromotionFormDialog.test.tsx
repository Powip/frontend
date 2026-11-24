import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PromotionFormDialog } from "@/components/promotions/PromotionFormDialog";
import { createPromotion, deletePromotion, resolvePrices, updatePromotion, type Promotion } from "@/services/promotionsService";
import { getVariantCosts, listProductVariants, type PurchasableProduct } from "@/services/purchasesService";
import { fetchVariantsByIds } from "@/services/variantCodesService";
import { getStockByVariants } from "@/services/inventoryItems.service";
import { searchReconciliationVariants } from "@/services/reconciliationTask.service";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", email: "ana@tienda.pe", role: "ADMINISTRADOR" }, company: { id: "c1" } } }),
}));
jest.mock("@/services/promotionsService", () => ({
  createPromotion: jest.fn(),
  updatePromotion: jest.fn(),
  deletePromotion: jest.fn(),
  resolvePrices: jest.fn(),
}));
jest.mock("@/services/purchasesService", () => ({ listProductVariants: jest.fn(), getVariantCosts: jest.fn() }));
jest.mock("@/services/variantCodesService", () => ({ fetchVariantsByIds: jest.fn() }));
jest.mock("@/services/inventoryItems.service", () => ({ getStockByVariants: jest.fn() }));
jest.mock("@/services/reconciliationTask.service", () => ({ searchReconciliationVariants: jest.fn() }));

const STORES = [{ id: "s1", name: "KUNCA" }, { id: "s2", name: "LIVII" }];
const PRODUCTS = [{ id: "p-sofia", name: "Blusa Sofía", sku: "SOF", companySku: "SOF", status: true, purchaseUnit: null, purchaseFactor: 1 }] as PurchasableProduct[];
const PRICES: Record<string, number> = { "v-s": 89, "v-m": 89, "v-l": 89, "v-xl": 99 };

const VOLUME = {
  id: "vol-1", name: "Lleva 3 blusas Sofía", type: "VOLUME", isActive: true, channels: ["SHOPIFY"], storeIds: ["s1"],
  startsAt: "2026-11-24T05:00:00.000Z", endsAt: null, productId: "p-sofia", variantIds: ["v-s", "v-m"], minQty: 3, maxQty: 6, packPrice: 210,
  giftCondition: null, minAmount: null, triggerVariantId: null, giftVariantId: null, giftQuantity: null, status: "ACTIVE", combinable: false,
  discountType: null, discountValue: null, allProducts: false, products: [], manualPrices: [],
} as unknown as Promotion;

function renderDialog(props: Partial<Parameters<typeof PromotionFormDialog>[0]> = {}) {
  const onClose = jest.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PromotionFormDialog promo={null} initialType="VOLUME" stores={STORES} products={PRODUCTS} variantNames={new Map()} onClose={onClose} {...props} />
    </QueryClientProvider>,
  );
  return { onClose };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(resolvePrices).mockImplementation(async (body) =>
    body.variantIds.map((variantId) => ({ variantId, price: PRICES[variantId] ?? 50, compareAtPrice: null, listId: null })),
  );
  jest.mocked(getVariantCosts).mockResolvedValue([]);
  jest.mocked(createPromotion).mockResolvedValue(VOLUME);
  jest.mocked(updatePromotion).mockResolvedValue(undefined);
  jest.mocked(deletePromotion).mockResolvedValue(undefined);
  jest.mocked(listProductVariants).mockResolvedValue([
    { id: "v-s", sku: "a", companySku: "SOF-S-CRE", attributeValues: { Talla: "S" }, isActive: true, mergedInto: null },
    { id: "v-m", sku: "b", companySku: "SOF-M-CRE", attributeValues: { Talla: "M" }, isActive: true, mergedInto: null },
    { id: "v-l", sku: "c", companySku: "SOF-L-CRE", attributeValues: { Talla: "L" }, isActive: true, mergedInto: null },
    { id: "v-off", sku: "d", companySku: "SOF-XS", attributeValues: { Talla: "XS" }, isActive: false, mergedInto: null },
    { id: "v-old", sku: "e", companySku: "SOF-VIEJO", attributeValues: { Talla: "U" }, isActive: true, mergedInto: "v-s" },
  ]);
  jest.mocked(fetchVariantsByIds).mockResolvedValue([
    { id: "v-s", sku: "a", companySku: "SOF-S-CRE", barcode: null, powipEan: null, attributeValues: { Talla: "S" }, productName: "Blusa Sofía" },
    { id: "v-m", sku: "b", companySku: "SOF-M-CRE", barcode: null, powipEan: null, attributeValues: { Talla: "M" }, productName: "Blusa Sofía" },
  ]);
});

async function addSofiaVariants(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Agregar las variantes de un producto…" }));
  await user.type(screen.getByLabelText("Producto"), "sof");
  await user.click(await screen.findByRole("button", { name: /Blusa Sofía/ }));
  await screen.findByText("Se agregaron 3 SKUs de Blusa Sofía.");
}

describe("Volumen por SKUs (FEAT-32 M4, spec §7.14 y §6.16)", () => {
  it("sin datos no guarda y dice qué falta bajo cada campo", async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(screen.getByRole("heading", { name: "Nueva promoción · Volumen" })).toBeInTheDocument();
    expect(screen.getByText("Ningún SKU elegido.")).toBeInTheDocument();
    expect(screen.getByText("Se cuentan las unidades de estos SKUs en el pedido (pueden mezclarse tallas y colores).")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Cantidad mínima"));
    await user.type(screen.getByLabelText("Cantidad mínima"), "1");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("Ponle un nombre.")).toBeInTheDocument();
    expect(screen.getByText("Elige al menos un SKU.")).toBeInTheDocument();
    expect(screen.getByText("Mínimo 2 unidades.")).toBeInTheDocument();
    expect(screen.getByText("Escribe el precio.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Cantidad mínima"));
    await user.type(screen.getByLabelText("Cantidad mínima"), "3");
    await user.type(screen.getByLabelText(/^Cantidad máxima/), "2");
    expect(screen.getByText("No puede ser menor que la mínima.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2026-11-30T10:00" } });
    fireEvent.change(screen.getByLabelText(/^Hasta/), { target: { value: "2026-11-30T09:00" } });
    expect(screen.getByText("La fecha de fin debe ser después del inicio.")).toBeInTheDocument();
    expect(createPromotion).not.toHaveBeenCalled();
  });

  it("agrega las variantes vivas de un producto y SKUs sueltos, muestra el resumen y guarda con fecha, hora y Live", async () => {
    jest.mocked(searchReconciliationVariants).mockResolvedValue([
      { variant_id: "v-xl", product_name: "Blusa Sofía", sku: "f", company_sku: "SOF-XL-CRE", attribute_values: { Talla: "XL" }, product_type: "simple", tracking_mode: "NONE" },
      { variant_id: "v-pack", product_name: "Pack verano", sku: "PK1", company_sku: null, attribute_values: {}, product_type: "pack", tracking_mode: "NONE" },
    ]);
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText("Nombre"), "Lleva 3 blusas Sofía");
    await addSofiaVariants(user);
    const list = screen.getByRole("list", { name: "SKUs elegidos" });
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "SOF-S-CREBlusa Sofía · S", "SOF-M-CREBlusa Sofía · M", "SOF-L-CREBlusa Sofía · L",
    ]);
    expect(listProductVariants).toHaveBeenCalledWith("p-sofia");

    await user.type(screen.getByLabelText("Precio por las 3 unidades"), "210");
    const summary = screen.getByTestId("volume-summary");
    await waitFor(() => expect(summary).toHaveTextContent("Precio normalS/ 267.00"));
    expect(summary).toHaveTextContent("Precio con volumenS/ 210.00S/ 70.00 c/u");
    expect(summary).toHaveTextContent("Ahorro del clienteS/ 57.00");
    expect(resolvePrices).toHaveBeenLastCalledWith({ storeId: undefined, variantIds: ["v-l", "v-m", "v-s"] }, expect.anything());

    // Buscador por variante: un pack no se ofrece; con otro precio el resumen pasa a rango.
    await user.type(screen.getByLabelText("Buscar SKU"), "sof");
    expect(await screen.findByRole("button", { name: /Blusa Sofía · XL/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pack verano/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Blusa Sofía · XL/ }));
    await waitFor(() => expect(summary).toHaveTextContent("Precio normalS/ 267.00–S/ 297.00"));
    expect(summary).toHaveTextContent("Ahorro del clienteS/ 57.00–S/ 87.00");
    await user.click(screen.getByRole("button", { name: "Quitar SOF-M-CRE" }));

    await user.click(within(screen.getByRole("group", { name: "Canales" })).getByRole("button", { name: "POWIP Live" }));
    await user.click(within(screen.getByRole("group", { name: "Tiendas" })).getByRole("button", { name: "KUNCA" }));
    fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2026-11-28T18:00" } });
    await user.click(screen.getByRole("checkbox", { name: "Se puede combinar con otras promociones" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(createPromotion).toHaveBeenCalledWith({
        name: "Lleva 3 blusas Sofía", type: "VOLUME", channels: ["POWIP_LIVE"], storeIds: ["s1"], startsAt: "2026-11-28T18:00:00-05:00", endsAt: null,
        combinable: true, variantIds: ["v-s", "v-l", "v-xl"], minQty: 3, maxQty: null, packPrice: 210,
      }),
    );
  });

  it("avisa (sin bloquear) si el precio por unidad sin IGV queda bajo el costo, y si no hay ahorro", async () => {
    jest.mocked(getVariantCosts).mockResolvedValue([{ variantId: "v-s", averageCost: 65 }, { variantId: "v-m", averageCost: 30 }, { variantId: "v-l", averageCost: null }]);
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText("Nombre"), "Volumen bajo costo");
    await addSofiaVariants(user);
    await user.type(screen.getByLabelText("Precio por las 3 unidades"), "210");
    expect(await screen.findByText(/Bajo el costo: S\/ 70.00 por unidad \(S\/ 59.32 sin IGV\) queda bajo el costo de 1 SKU/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Precio por las 3 unidades"));
    await user.type(screen.getByLabelText("Precio por las 3 unidades"), "300");
    expect(await screen.findByText("Con este precio el cliente no ahorra: el volumen no se aplicará.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(createPromotion).toHaveBeenCalledWith(expect.objectContaining({ packPrice: 300 })));
  });

  it("al editar carga los SKUs guardados, reemplaza la lista, quita el tope y no manda el tipo; Eliminar pide confirmación", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog({ promo: VOLUME });
    expect(screen.getByRole("heading", { name: "Editar promoción · Volumen" })).toBeInTheDocument();
    expect(await screen.findByText("Blusa Sofía · S")).toBeInTheDocument();
    expect(fetchVariantsByIds).toHaveBeenCalledWith(["v-s", "v-m"], "c1");
    // SHOPIFY viejo se muestra como Web / Shopify.
    expect(within(screen.getByRole("group", { name: "Canales" })).getByRole("button", { name: "Web / Shopify" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/^Desde/)).toHaveValue("2026-11-24T00:00");
    expect(resolvePrices).toHaveBeenCalledWith({ storeId: "s1", variantIds: ["v-m", "v-s"] }, expect.anything());

    await user.click(screen.getByRole("button", { name: "Quitar SOF-M-CRE" }));
    await user.clear(screen.getByLabelText(/^Cantidad máxima/));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(updatePromotion).toHaveBeenCalledWith("vol-1", {
        name: "Lleva 3 blusas Sofía", channels: ["WEB"], storeIds: ["s1"], startsAt: "2026-11-24T00:00:00-05:00", endsAt: null,
        combinable: false, variantIds: ["v-s"], minQty: 3, maxQty: null, packPrice: 210,
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("Eliminar abre la confirmación y borra la promoción", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog({ promo: VOLUME });
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("La promoción está activa: los precios vuelven al normal en todos sus canales al eliminarla.");
    await user.click(within(confirm).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(deletePromotion).toHaveBeenCalledWith("vol-1"));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Regalo como SKU con stock (FEAT-32 M4, spec §7.14 y §6.17)", () => {
  beforeEach(() => {
    jest.mocked(searchReconciliationVariants).mockResolvedValue([
      { variant_id: "v-acl", product_name: "Aclari", sku: "x", company_sku: "ACL0356", attribute_values: {}, product_type: "simple", tracking_mode: "NONE" },
    ]);
  });

  it("monto primero: «Compras desde (S/)»; sin datos dice qué falta", async () => {
    const user = userEvent.setup();
    renderDialog({ initialType: "GIFT" });
    expect(screen.getByRole("heading", { name: "Nueva promoción · Regalo" })).toBeInTheDocument();
    expect(screen.getByLabelText("Condición")).toHaveValue("AMOUNT");
    expect(within(screen.getByLabelText("Condición")).getAllByRole("option")[0]).toHaveTextContent("Por monto de compra");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("Escribe el monto mínimo de compra.")).toBeInTheDocument();
    expect(screen.getByText("Elige el SKU que se regala.")).toBeInTheDocument();
    expect(createPromotion).not.toHaveBeenCalled();
  });

  it("con 0 en stock avisa en ámbar que no se ofrecerá, pero se puede guardar", async () => {
    jest.mocked(getStockByVariants).mockResolvedValue([{ variant_id: "v-acl", quantity: 3, reserved_quantity: 3, available: 0, inventories: [] }]);
    const user = userEvent.setup();
    renderDialog({ initialType: "GIFT" });
    await user.type(screen.getByLabelText("Nombre"), "Regalo Aclari");
    await user.type(screen.getByLabelText("Compras desde (S/)"), "300");
    await user.type(screen.getByLabelText("SKU que se regala"), "acl");
    await user.click(await screen.findByRole("button", { name: /Aclari/ }));
    expect(await screen.findByText("El regalo tiene 0 en stock: no se ofrecerá hasta que haya")).toBeInTheDocument();
    expect(screen.getByText("ACL0356")).toBeInTheDocument();
    expect(getStockByVariants).toHaveBeenCalledWith(["v-acl"]);
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(createPromotion).toHaveBeenCalledWith({
        name: "Regalo Aclari", type: "GIFT", channels: [], storeIds: [], startsAt: null, endsAt: null, combinable: false,
        giftCondition: "AMOUNT", giftVariantId: "v-acl", giftQuantity: 1, minAmount: 300,
      }),
    );
  });

  it("con stock muestra cuántas unidades hay (un SKU sin filas de inventario cuenta como 0)", async () => {
    jest.mocked(getStockByVariants).mockResolvedValueOnce([{ variant_id: "v-acl", quantity: 5, reserved_quantity: 1, available: 4, inventories: [] }]);
    const user = userEvent.setup();
    renderDialog({ initialType: "GIFT" });
    await user.type(screen.getByLabelText("SKU que se regala"), "acl");
    await user.click(await screen.findByRole("button", { name: /Aclari/ }));
    expect(await screen.findByText(/en stock\. En la venta entra como línea a S\/ 0/)).toHaveTextContent("El regalo tiene 4 en stock.");
  });
});
