import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { PACK_SAVED_CHOOSE_MESSAGE, PACK_SAVED_MESSAGE, PackFormDialog } from "@/components/packs/PackFormDialog";
import {
  createPack,
  getPackMarginRules,
  listPackComponentProducts,
  listPackProductVariants,
  updatePack,
  type PackProductVariant,
  type PackView,
} from "@/services/packsService";
import { getVariantCosts } from "@/services/purchasesService";
import { getStockByVariants } from "@/services/inventoryItems.service";
import { getProductChannels, saveProductChannel, type ProductChannelsView } from "@/services/productChannelsService";
import { convertBundle } from "@/services/bundlePromos.service";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => "/packs-promos" }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      accessToken: "t",
      user: { id: "u1", email: "ana@tienda.pe", role: "ADMINISTRADOR" },
      company: { id: "c1", stores: [{ id: "s1", name: "KUNCA" }, { id: "s2", name: "LIVII" }] },
    },
  }),
}));
jest.mock("@/hooks/useMyWarehouses");
jest.mock("@/services/packsService", () => ({
  ...jest.requireActual("@/services/packsService"),
  createPack: jest.fn(),
  updatePack: jest.fn(),
  getPackMarginRules: jest.fn(),
  listPackComponentProducts: jest.fn(),
  listPackProductVariants: jest.fn(),
}));
jest.mock("@/services/purchasesService", () => ({ getVariantCosts: jest.fn() }));
jest.mock("@/services/inventoryItems.service", () => ({ getStockByVariants: jest.fn() }));
jest.mock("@/services/productChannelsService", () => ({ getProductChannels: jest.fn(), saveProductChannel: jest.fn() }));
jest.mock("@/services/bundlePromos.service", () => ({ convertBundle: jest.fn() }));

const variant = (id: string, attributes: Record<string, string>, sku: string, price: number): PackProductVariant => ({ id, sku, attributeValues: attributes, price, active: true });
const VARIANTS: Record<string, PackProductVariant[]> = {
  "p-polo": [variant("v-polo-m", { Talla: "M" }, "POL-M", 59.9), variant("v-polo-l", { Talla: "L" }, "POL-L", 59.9)],
  "p-gorra": [variant("v-gorra", {}, "GOR", 39.9)],
  "p-jean": [variant("v-28", { Talla: "28" }, "JIM-28", 119), variant("v-30", { Talla: "30" }, "JIM-30", 119), variant("v-32", { Talla: "32" }, "JIM-32", 109)],
};
const STOCK: Record<string, number> = { "v-polo-m": 8, "v-polo-l": 0, "v-gorra": 3, "v-28": 1, "v-30": 0, "v-32": 5 };
let costs: Record<string, number | null> = {};

const KIT: PackView = {
  id: "p-kit", variantId: "v-kit", name: "Kit verano", description: null, sku: "PK-0001", productSku: "PK-0001", powipEan: null,
  barcode: null, imageUrl: null, price: 90, active: true, categoryId: null, brandId: null, packType: "FIXED", approvalStatus: null, creatorId: null,
  components: [
    { variantId: "v-polo-m", quantity: 2, productId: "p-polo", productName: "Polo", sku: "POL-M", attributeValues: { Talla: "M" }, imageUrl: null, active: true },
    { variantId: "v-gorra", quantity: 1, productId: "p-gorra", productName: "Gorra", sku: "GOR", attributeValues: {}, imageUrl: null, active: true },
  ],
  choiceComponents: [], componentsTotal: 159.7, available: { total: 3, byWarehouse: [] },
};

const channelsView = (storeId: string, crm: { active: boolean; rule: ProductChannelsView["channels"][number]["rule"] }): ProductChannelsView => ({
  productId: "p-kit", storeId, canEdit: true, igvIncluded: true, variants: [],
  channels: [
    { channel: "POWIP_CRM", name: "POWIP CRM", active: crm.active, saved: true, rule: crm.rule, ruleLabel: "", listId: null, prices: [], ownPriceCount: 0, updatedAt: null, updatedBy: null },
    { channel: "CATALOGO_WEB", name: "Catálogo web", active: true, saved: false, rule: { mode: "same" }, ruleLabel: "", listId: null, prices: [], ownPriceCount: 0, updatedAt: null, updatedBy: null },
  ],
});

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  costs = { "v-polo-m": 20, "v-polo-l": 20, "v-gorra": 10, "v-28": 50, "v-30": 60, "v-32": 40 };
  jest.mocked(getPackMarginRules).mockResolvedValue({ minMargin: 0.15, igvAffected: true });
  jest.mocked(listPackComponentProducts).mockResolvedValue([
    { id: "p-polo", name: "Polo", sku: "POL", companySku: null, imageUrl: null },
    { id: "p-gorra", name: "Gorra", sku: "GOR", companySku: null, imageUrl: null },
    { id: "p-jean", name: "Jean Jimena", sku: "JIM", companySku: null, imageUrl: null },
  ]);
  jest.mocked(listPackProductVariants).mockImplementation(async (productId: string) => VARIANTS[productId] ?? []);
  jest.mocked(getVariantCosts).mockImplementation(async (ids: string[]) => ids.map((variantId) => ({ variantId, averageCost: costs[variantId] ?? null })));
  jest.mocked(getStockByVariants).mockImplementation(async (ids: string[]) =>
    ids.map((id) => ({
      variant_id: id, quantity: STOCK[id] ?? 0, reserved_quantity: 0, available: STOCK[id] ?? 0,
      inventories: [{ inventory_id: "i1", inventory_name: "Breña", store_id: "s1", quantity: (STOCK[id] ?? 0) + 2, reserved_quantity: 2 }],
    })),
  );
  jest.mocked(createPack).mockResolvedValue({ ...KIT, id: "p-new" });
  jest.mocked(saveProductChannel).mockResolvedValue(channelsView("s2", { active: true, rule: { mode: "same" } }));
});

async function addProduct(user: UserEvent, index: number, search: string, product: string) {
  await user.click(screen.getByRole("button", { name: "＋ Agregar producto" }));
  await user.type(screen.getByLabelText(`Producto del componente ${index}`), search);
  const results = await screen.findByRole("list", { name: `Resultados de Producto del componente ${index}` });
  await user.click(within(results).getByText(product));
}

async function setQuantity(user: UserEvent, label: string, value: string) {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, value);
}

describe("ventana del pack (FEAT-32 M5, spec §7.15)", () => {
  it("fijo: producto → «Variante (SKU)…» → cantidad; resumen con stock, lo que limita, suma y margen; el margen bajo exige confirmar", async () => {
    costs = { ...costs, "v-polo-m": 120, "v-gorra": 48 };
    const user = userEvent.setup();
    const onClose = jest.fn();
    wrap(<PackFormDialog pack={null} onClose={onClose} />);
    expect(screen.getByRole("button", { name: "Fijo: variantes definidas" })).toHaveAttribute("aria-pressed", "true");
    await user.type(screen.getByLabelText("Nombre del pack"), "Kit verano");
    await addProduct(user, 1, "pol", "Polo");
    const select = await screen.findByLabelText("Variante de Polo");
    expect(within(select).getByRole("option", { name: "Variante (SKU)…" })).toBeInTheDocument();
    await waitFor(() => expect(within(select).getByRole("option", { name: "Talla: M · POL-M · 8 disp." })).toBeInTheDocument());
    await user.selectOptions(select, "v-polo-m");
    await setQuantity(user, "Cantidad de Polo", "2");
    await addProduct(user, 2, "gor", "Gorra");
    await user.selectOptions(await screen.findByLabelText("Variante de Gorra"), "v-gorra");
    await user.type(screen.getByLabelText("Precio del pack (S/)"), "90");

    await waitFor(() => expect(screen.getByTestId("pack-margin")).toHaveTextContent("S/ -211.73 · -278 %"));
    expect(screen.getByTestId("pack-components-total")).toHaveTextContent("S/ 159.70");
    // Polo M: 8 ÷ 2 = 4; Gorra: 3 → 3, limita la gorra.
    expect(screen.getByTestId("pack-stock")).toHaveTextContent("3");
    expect(screen.getByText("Limita: Gorra")).toBeInTheDocument();
    expect(screen.getByTestId("pack-warnings")).toHaveTextContent("El precio del pack está por debajo del costo de sus componentes.");
    expect(screen.getByRole("alert")).toHaveTextContent(/menor que el costo/);

    await user.click(screen.getByRole("button", { name: "Guardar pack" }));
    expect(createPack).not.toHaveBeenCalled();
    expect(screen.getByText("Confirma que quieres guardar el pack con este margen.")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Guardar igual con este margen"));
    await user.click(screen.getByRole("button", { name: "Guardar pack" }));
    await waitFor(() => expect(createPack).toHaveBeenCalledWith({
      name: "Kit verano", price: 90, packType: "FIXED", components: [{ variantId: "v-polo-m", quantity: 2 }, { variantId: "v-gorra", quantity: 1 }], confirmLowMargin: true,
    }));
    expect(toast.success).toHaveBeenCalledWith(PACK_SAVED_MESSAGE);
    expect(PACK_SAVED_MESSAGE).toBe("✓ Pack guardado. Ya aparece en Productos (tipo Pack) y se vende en tus canales.");
    expect(saveProductChannel).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("valida nombre, precio, producto, variante y las 2 unidades antes de guardar", async () => {
    const user = userEvent.setup();
    wrap(<PackFormDialog pack={null} onClose={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: "Guardar pack" }));
    expect(screen.getByText("Ponle un nombre.")).toBeInTheDocument();
    expect(screen.getByText("Escribe el precio del pack.")).toBeInTheDocument();
    expect(screen.getByText("Agrega al menos un componente.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "＋ Agregar producto" }));
    expect(screen.getByText("Elige el producto.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar componente 1" }));
    await addProduct(user, 1, "pol", "Polo");
    expect(await screen.findByText("Elige la variante (SKU): sin SKU el almacén no sabe qué sacar.")).toBeInTheDocument();
    await user.selectOptions(await screen.findByLabelText("Variante de Polo"), "v-polo-m");
    expect(screen.getByText("Un pack necesita al menos 2 unidades en total.")).toBeInTheDocument();
    expect(createPack).not.toHaveBeenCalled();
  });

  it("a elegir: casillas de «Variantes permitidas» con su stock; suma con el mayor precio; no se vende todavía", async () => {
    const user = userEvent.setup();
    wrap(<PackFormDialog pack={null} onClose={jest.fn()} />);
    await user.type(screen.getByLabelText("Nombre del pack"), "2 jeans Jimena");
    await addProduct(user, 1, "jim", "Jean Jimena");
    // Elegida en fijo, pasa a permitida al cambiar a «a elegir».
    await user.selectOptions(await screen.findByLabelText("Variante de Jean Jimena"), "v-28");
    await user.click(screen.getByRole("button", { name: "A elegir: el cliente elige talla y color" }));
    expect(screen.getByRole("button", { name: "A elegir: el cliente elige talla y color" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Un pack a elegir todavía no se vende: pronto podrás venderlo desde Registrar venta.")).toBeInTheDocument();
    expect(screen.getByText("Variantes permitidas. Las que no tienen stock no se ofrecen al vender.")).toBeInTheDocument();
    const t28 = screen.getByRole("checkbox", { name: /Talla: 28/ });
    expect(t28).toBeChecked();
    await user.click(t28);
    await user.type(screen.getByLabelText("Precio del pack (S/)"), "199");
    await user.click(screen.getByRole("button", { name: "Guardar pack" }));
    expect(screen.getByText("Elige al menos una variante permitida.")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /Talla: 28/ }));
    await user.click(screen.getByRole("checkbox", { name: /Talla: 30/ }));
    await setQuantity(user, "Cantidad de Jean Jimena", "2");
    // Suma: el mayor precio de las permitidas (119) × 2; stock: (1 + 0) ÷ 2 = 0.
    expect(screen.getByTestId("pack-components-total")).toHaveTextContent("S/ 238.00");
    await waitFor(() => expect(screen.getByTestId("pack-stock")).toHaveTextContent("0"));
    expect(screen.getByText("Limita: Jean Jimena")).toBeInTheDocument();
    // Costo: el mayor de las permitidas (60) × 2 = 120 → margen sobre 199 ÷ 1.18.
    await waitFor(() => expect(screen.getByTestId("pack-margin")).toHaveTextContent("S/ 48.64 · 29 %"));

    await user.click(screen.getByRole("button", { name: "Guardar pack" }));
    await waitFor(() => expect(createPack).toHaveBeenCalledWith({
      name: "2 jeans Jimena", price: 199, packType: "CHOOSE", components: [{ productId: "p-jean", allowedVariantIds: ["v-28", "v-30"], quantity: 2 }],
    }));
    expect(toast.success).toHaveBeenCalledWith(PACK_SAVED_CHOOSE_MESSAGE);
  });

  it("«igual o más caro que suelto» avisa pero no bloquea", async () => {
    const user = userEvent.setup();
    wrap(<PackFormDialog pack={null} onClose={jest.fn()} />);
    await user.type(screen.getByLabelText("Nombre del pack"), "Dúo polo");
    await addProduct(user, 1, "pol", "Polo");
    await user.selectOptions(await screen.findByLabelText("Variante de Polo"), "v-polo-m");
    await setQuantity(user, "Cantidad de Polo", "2");
    await user.type(screen.getByLabelText("Precio del pack (S/)"), "119.80");
    expect(await screen.findByText("El pack sale igual o más caro que comprar suelto.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar pack" }));
    await waitFor(() => expect(createPack).toHaveBeenCalledWith(expect.objectContaining({ price: 119.8, packType: "FIXED" })));
    expect(createPack).not.toHaveBeenCalledWith(expect.objectContaining({ confirmLowMargin: true }));
  });

  it("SKU del pack opcional: «Se genera solo; único en tu empresa.»", () => {
    wrap(<PackFormDialog pack={null} onClose={jest.fn()} />);
    expect(screen.getByLabelText(/^SKU del pack/)).toHaveAccessibleDescription(
      "Se genera solo; único en tu empresa. Si lo vendes en Shopify, usa el mismo SKU que tiene allá: así sus pedidos descuentan los componentes.",
    );
  });

  it("al editar manda un solo PATCH; un 409 PACK_LOW_MARGIN pide confirmar y reintenta con confirmLowMargin", async () => {
    const conflict = new AxiosError("409", "ERR", undefined, undefined, {
      status: 409, statusText: "Conflict", headers: {}, config: { headers: new AxiosHeaders() },
      data: { code: "PACK_LOW_MARGIN", message: "El margen del pack (10.0 %) queda bajo el mínimo (15.0 %). Para guardarlo igual, confírmalo.", marginStatus: "bajo_minimo" },
    });
    jest.mocked(updatePack).mockRejectedValueOnce(conflict).mockResolvedValueOnce(KIT);
    jest.mocked(getProductChannels).mockImplementation(async (_id: string, storeId: string) => channelsView(storeId, { active: true, rule: { mode: "same" } }));
    const user = userEvent.setup();
    wrap(<PackFormDialog pack={KIT} onClose={jest.fn()} />);
    expect(screen.getByLabelText("Nombre del pack")).toHaveValue("Kit verano");
    expect(screen.getByLabelText(/^SKU del pack/)).toHaveValue("PK-0001");
    await waitFor(() => expect(screen.getByLabelText("Variante de Polo")).toHaveValue("v-polo-m"));
    const price = screen.getByLabelText("Precio del pack (S/)");
    await user.clear(price);
    await user.type(price, "95");
    await user.click(screen.getByRole("button", { name: "Guardar pack" }));
    const components = [{ variantId: "v-polo-m", quantity: 2 }, { variantId: "v-gorra", quantity: 1 }];
    await waitFor(() => expect(updatePack).toHaveBeenCalledWith("p-kit", { components, price: 95 }));
    expect(await screen.findByRole("alert")).toHaveTextContent("queda bajo el mínimo (15.0 %)");

    await user.click(screen.getByLabelText("Guardar igual con este margen"));
    await user.click(screen.getByRole("button", { name: "Guardar pack" }));
    await waitFor(() => expect(updatePack).toHaveBeenLastCalledWith("p-kit", { components, price: 95, confirmLowMargin: true }));
    expect(createPack).not.toHaveBeenCalled();
  });

  it("Canales y tiendas: los de POWIP por tienda; se guardan después del pack solo los que cambiaron, con su regla", async () => {
    jest.mocked(updatePack).mockResolvedValue(KIT);
    jest.mocked(getProductChannels).mockImplementation(async (_id: string, storeId: string) =>
      channelsView(storeId, storeId === "s1" ? { active: false, rule: { mode: "less", unit: "percent", value: 10 } } : { active: true, rule: { mode: "same" } }),
    );
    const user = userEvent.setup();
    wrap(<PackFormDialog pack={KIT} onClose={jest.fn()} />);
    const crmKunca = screen.getByRole("checkbox", { name: "POWIP CRM en KUNCA" });
    await waitFor(() => expect(crmKunca).toBeEnabled());
    expect(crmKunca).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Catálogo web en LIVII" })).toBeChecked();
    await user.click(crmKunca);
    await user.click(screen.getByRole("checkbox", { name: "Catálogo web en LIVII" }));
    await user.click(screen.getByRole("button", { name: "Guardar pack" }));
    await waitFor(() => expect(saveProductChannel).toHaveBeenCalledTimes(2));
    expect(saveProductChannel).toHaveBeenCalledWith("p-kit", { storeId: "s1", channel: "POWIP_CRM", active: true, rule: { mode: "less", unit: "percent", value: 10 } });
    expect(saveProductChannel).toHaveBeenCalledWith("p-kit", { storeId: "s2", channel: "CATALOGO_WEB", active: false, rule: { mode: "same" } });
    expect(jest.mocked(updatePack).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(saveProductChannel).mock.invocationCallOrder[0]);
  });

  describe("Convertir bundle (spec §6.18, §7.16)", () => {
    const seed = {
      name: "Combo verano",
      price: 80,
      packType: "FIXED" as const,
      components: [
        { productId: "p-polo", productName: "Polo", variantId: null, quantity: 1 },
        // Bundle viejo: solo el nombre del producto.
        { productId: null, productName: "Gorra", variantId: null, quantity: 1 },
      ],
    };
    const bundle = { id: "b-1", name: "Combo verano", channels: ["WHATSAPP"] };

    async function fillAndSave(user: UserEvent) {
      expect(screen.getByRole("note")).toHaveTextContent("Convertir bundle: elige la variante de cada producto. Al guardar, el bundle se desactiva y queda este pack.");
      expect(screen.getByRole("note")).toHaveTextContent("El bundle se vendía en: WhatsApp.");
      expect(screen.getByLabelText("Nombre del pack")).toHaveValue("Combo verano");
      expect(screen.getByLabelText("Precio del pack (S/)")).toHaveValue("80");
      await user.selectOptions(await screen.findByLabelText("Variante de Polo"), "v-polo-m");
      expect(screen.getByText("Del bundle: «Gorra». Elige el producto.")).toBeInTheDocument();
      const results = await screen.findByRole("list", { name: "Resultados de Producto del componente 2" });
      await user.click(within(results).getByText("Gorra"));
      await user.selectOptions(await screen.findByLabelText("Variante de Gorra"), "v-gorra");
      await user.click(screen.getByRole("button", { name: "Guardar pack" }));
      await waitFor(() => expect(createPack).toHaveBeenCalledWith({
        name: "Combo verano", price: 80, packType: "FIXED", components: [{ variantId: "v-polo-m", quantity: 1 }, { variantId: "v-gorra", quantity: 1 }],
      }));
    }

    it("abre la ventana con los productos y el precio del bundle; al crear el pack desactiva el bundle", async () => {
      jest.mocked(convertBundle).mockResolvedValue({ id: "b-1", type: "BUNDLE", name: "Combo verano", active: false, channels: [], items: [], packPrice: 80, convertedToPackId: "p-new" });
      const user = userEvent.setup();
      const onClose = jest.fn();
      wrap(<PackFormDialog pack={null} seed={seed} bundle={bundle} onClose={onClose} />);
      await fillAndSave(user);
      await waitFor(() => expect(convertBundle).toHaveBeenCalledWith("b-1", "p-new"));
      expect(toast.success).toHaveBeenCalledWith(`${PACK_SAVED_MESSAGE} El bundle «Combo verano» quedó desactivado.`);
      expect(onClose).toHaveBeenCalled();
    });

    it("si no se puede desactivar el bundle, avisa (el pack ya quedó creado)", async () => {
      jest.mocked(convertBundle).mockRejectedValue(new Error("Pack no encontrado."));
      const user = userEvent.setup();
      wrap(<PackFormDialog pack={null} seed={seed} bundle={bundle} onClose={jest.fn()} />);
      await fillAndSave(user);
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("el bundle «Combo verano» sigue activo: Pack no encontrado.")));
      expect(toast.success).toHaveBeenCalledWith(PACK_SAVED_MESSAGE);
      expect(createPack).toHaveBeenCalledTimes(1);
    });
  });
});
