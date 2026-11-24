import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import PacksView, { packFilterParams } from "@/components/packs/PacksView";
import { getPackMarginRules, listPacks, setPackApproval, type PackView } from "@/services/packsService";
import { getChannelSummary } from "@/services/productChannelsService";
import { packMargin, packStockPreview, packWarnings } from "@/lib/packs/packMath";

let mockRole = "ADMINISTRADOR";
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => "/packs-promos" }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", email: "ana@tienda.pe", role: mockRole }, company: { id: "c1" } } }),
}));
jest.mock("@/services/packsService", () => ({
  ...jest.requireActual("@/services/packsService"),
  listPacks: jest.fn(),
  setPackApproval: jest.fn(),
  getPackMarginRules: jest.fn(),
  savePackMinMargin: jest.fn(),
}));
jest.mock("@/services/productChannelsService", () => ({ getChannelSummary: jest.fn() }));
// La ventana del pack tiene su propio test.
jest.mock("@/components/packs/PackFormDialog", () => ({
  PackFormDialog: ({ pack }: { pack: { name: string } | null }) => <div role="dialog">ventana de {pack ? pack.name : "pack nuevo"}</div>,
}));

const KIT: PackView = {
  id: "p-kit", variantId: "v-kit", name: "Kit verano", description: null, sku: "KIT-001", productSku: "KIT", powipEan: "2100000000017",
  barcode: null, imageUrl: null, price: 90, active: true, categoryId: null, brandId: null, packType: "FIXED", approvalStatus: null, creatorId: null,
  components: [
    { variantId: "v-polo", quantity: 2, productId: "p-polo", productName: "Polo", sku: "POL-M", attributeValues: { Talla: "M" }, imageUrl: null, active: true, averageCost: 120 },
    { variantId: "v-gorra", quantity: 1, productId: "p-gorra", productName: "Gorra", sku: "GOR", attributeValues: {}, imageUrl: null, active: true, averageCost: 48 },
  ],
  choiceComponents: [],
  componentsTotal: 159.7,
  available: {
    total: 3,
    byWarehouse: [{ inventoryId: "i1", inventoryName: "Breña", storeId: "s1", available: 3, limiting: { productId: "p-gorra", variantId: "v-gorra", label: "Gorra" } }],
    limiting: { productId: "p-gorra", variantId: "v-gorra", label: "Gorra" },
  },
  cost: 288, netPrice: 76.2712, igvAffected: true, margin: -2.776, minMargin: 0.15, marginStatus: "bajo_costo", missingCostVariantIds: [],
};
const OK_PACK: PackView = { ...KIT, id: "p-ok", variantId: "v-ok", name: "Dúo básico", price: 200, cost: 100, margin: 0.41, marginStatus: "ok" };
const JEANS: PackView = {
  ...KIT, id: "p-jeans", variantId: "v-jeans", name: "2 jeans Jimena", packType: "CHOOSE", components: [], componentsTotal: 238, marginStatus: "ok", margin: 0.3,
  choiceComponents: [{
    slot: 0, productId: "p-jean", productName: "Jean Jimena", quantity: 2,
    variants: ["28", "30", "32"].map((talla) => ({ variantId: `v-${talla}`, sku: `JIM-${talla}`, attributeValues: { Talla: talla }, active: true, imageUrl: null })),
  }],
  available: { total: 0, byWarehouse: [], limiting: { productId: "p-jean", variantId: null, label: "Jean Jimena" } },
};
const CREATOR: PackView = { ...OK_PACK, id: "p-cre", variantId: "v-cre", name: "Look de Vale", approvalStatus: "PENDING", creatorId: "cr-1", active: false };
const page = (data: PackView[], pendingCount = 0) => ({ data, meta: { page: 1, limit: 50, total: data.length, totalPages: 1, pendingCount } });
const strip = (pack: PackView): PackView => {
  const { cost, netPrice, margin, minMargin, marginStatus, missingCostVariantIds, igvAffected, ...rest } = pack;
  void cost; void netPrice; void margin; void minMargin; void marginStatus; void missingCostVariantIds; void igvAffected;
  return { ...rest, components: rest.components.map(({ averageCost, ...component }) => { void averageCost; return component; }) };
};

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = "ADMINISTRADOR";
  jest.mocked(getPackMarginRules).mockResolvedValue({ minMargin: 0.15, igvAffected: true });
  jest.mocked(getChannelSummary).mockResolvedValue({ channels: [{ productId: "p-kit", storeId: "s1", channel: "CATALOGO_WEB", active: false, ruleMode: "same" }], ownPrices: [] });
});

describe("cálculos del pack (H9-D3 y FEAT-32 M5 §6.14)", () => {
  it("mide el margen sobre el precio sin IGV y marca bajo el mínimo o bajo el costo", () => {
    const costs = new Map([["a", 30]]);
    const rules = { minMargin: 0.15, igvAffected: true };
    expect(packMargin({ price: 118, components: [{ variantId: "a", quantity: 2 }], costs, rules })).toMatchObject({ netPrice: 100, cost: 60, margin: 0.4, status: "ok" });
    expect(packMargin({ price: 70.8, components: [{ variantId: "a", quantity: 2 }], costs, rules })).toMatchObject({ netPrice: 60, status: "bajo_minimo", margin: 0 });
    expect(packMargin({ price: 59, components: [{ variantId: "a", quantity: 2 }], costs, rules }).status).toBe("bajo_costo");
    expect(packMargin({ price: 100, components: [{ variantId: "a", quantity: 2 }], costs, rules: { minMargin: 0.15, igvAffected: false } })).toMatchObject({ netPrice: 100, margin: 0.4 });
    expect(packMargin({ price: 100, components: [{ variantId: "b", quantity: 1 }], costs, rules }).status).toBe("sin_costo");
  });

  it("avisa si el pack no es más barato que suelto o si queda bajo el costo (no bloquean)", () => {
    expect(packWarnings({ price: 200, componentsTotal: 200, netPrice: 169.49, cost: 100 })).toEqual(["El pack sale igual o más caro que comprar suelto."]);
    expect(packWarnings({ price: 199, componentsTotal: 238, netPrice: 168.64, cost: 100 })).toEqual([]);
    expect(packWarnings({ price: 59, componentsTotal: 100, netPrice: 50, cost: 60 })).toEqual(["El precio del pack está por debajo del costo de sus componentes."]);
    expect(packWarnings({ price: 59, componentsTotal: null, netPrice: null, cost: null })).toEqual([]);
  });

  it("stock: por almacén el mínimo de (disponible ÷ cantidad); en «a elegir» se suman las permitidas; dice cuál limita", () => {
    const row = (inventoryId: string, available: number) => ({ inventoryId, inventoryName: inventoryId === "a1" ? "Breña" : "Surco", storeId: "s1", available });
    const stock = new Map([
      ["blusa-m", [row("a1", 5), row("a2", 1)]],
      ["jean-28", [row("a1", 2)]],
      ["jean-30", [row("a1", 3), row("a2", 4)]],
    ]);
    const preview = packStockPreview(
      [
        { productId: "blusa", variantIds: ["blusa-m"], quantity: 1, label: "Blusa Sofía · M" },
        { productId: "jean", variantIds: ["jean-28", "jean-30"], quantity: 2, label: "Jean Jimena" },
      ],
      stock,
    );
    // Breña: blusa 5, jean (2+3)/2 = 2 → 2. Surco: blusa 1, jean 4/2 = 2 → 1.
    expect(preview.byWarehouse.map((item) => [item.inventoryId, item.available, item.limiting?.label])).toEqual([["a1", 2, "Jean Jimena"], ["a2", 1, "Blusa Sofía · M"]]);
    expect(preview.total).toBe(3);
    // Total: blusa 6, jean 9/2 = 4 → limita el jean.
    expect(preview.limiting?.label).toBe("Jean Jimena");
    expect(packStockPreview([], stock)).toEqual({ total: 0, byWarehouse: [], limiting: null });
  });

  it("cada filtro pide lo suyo a GET /packs", () => {
    expect(packFilterParams("all")).toEqual({});
    expect(packFilterParams("FIXED")).toEqual({ packType: "FIXED" });
    expect(packFilterParams("CHOOSE")).toEqual({ packType: "CHOOSE" });
    expect(packFilterParams("creators")).toEqual({ origin: "creators" });
  });
});

describe("Comercial › Packs y promociones › Packs (H9-D1/D3, FEAT-32 M5 §7.15)", () => {
  it("lista tipo, componentes, precio, suma de componentes, margen, stock con lo que limita, canales y estado", async () => {
    jest.mocked(listPacks).mockResolvedValue(page([KIT, OK_PACK]));
    wrap(<PacksView />);
    const kit = await screen.findByTestId("pack-row-p-kit");
    expect(within(kit).getByText("Fijo")).toBeInTheDocument();
    expect(within(kit).getByText("2 × Polo · M")).toBeInTheDocument();
    expect(within(kit).getByText("POL-M")).toBeInTheDocument();
    expect(within(kit).getByText("S/ 90.00")).toBeInTheDocument();
    expect(within(kit).getByText("S/ 159.70")).toBeInTheDocument();
    expect(within(kit).getByText("3")).toHaveAttribute("title", "Breña: 3");
    expect(within(kit).getByText("Limita: Gorra")).toBeInTheDocument();
    expect(within(kit).getByText(/margen bajo/)).toBeInTheDocument();
    expect(within(kit).getByText("Activo")).toBeInTheDocument();
    // Catálogo web desactivado en su única tienda: solo queda POWIP CRM.
    expect(await within(kit).findByRole("img", { name: "POWIP CRM" })).toBeInTheDocument();
    expect(within(kit).queryByRole("img", { name: "Catálogo web" })).not.toBeInTheDocument();
    expect(within(kit).getByRole("link", { name: "Ver ficha de Kit verano" })).toHaveAttribute("href", "/productos/p-kit");
    expect(within(screen.getByTestId("pack-row-p-ok")).getByText("41 %")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nuevo pack/ })).toBeInTheDocument();
    expect(await screen.findByText(/Margen mínimo de los packs/)).toBeInTheDocument();
  });

  it("un pack «a elegir» muestra cada producto con sus variantes permitidas", async () => {
    jest.mocked(listPacks).mockResolvedValue(page([JEANS]));
    wrap(<PacksView />);
    const row = await screen.findByTestId("pack-row-p-jeans");
    expect(within(row).getByText("A elegir")).toBeInTheDocument();
    expect(row).toHaveTextContent("2 × Jean Jimena (3 variantes)");
    expect(within(row).getByText("Limita: Jean Jimena")).toBeInTheDocument();
  });

  it("sin rol para gestionar: margen enmascarado, sin crear, editar ni aprobar; sí Ver ficha", async () => {
    mockRole = "VENTAS";
    jest.mocked(listPacks).mockResolvedValue(page([strip(KIT), strip(CREATOR)], 1));
    wrap(<PacksView />);
    const kit = await screen.findByTestId("pack-row-p-kit");
    expect(within(kit).getByText("••••")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nuevo pack/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar Kit verano/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Aprobar/ })).not.toBeInTheDocument();
    expect(within(kit).getByRole("link", { name: "Ver ficha de Kit verano" })).toBeInTheDocument();
    expect(getPackMarginRules).not.toHaveBeenCalled();
  });

  it("filtros Todos · Fijos · A elegir · De creadoras (con los pendientes)", async () => {
    jest.mocked(listPacks).mockResolvedValue(page([KIT], 2));
    const user = userEvent.setup();
    wrap(<PacksView />);
    await screen.findByTestId("pack-row-p-kit");
    const filters = screen.getByRole("group", { name: "Filtrar packs" });
    expect(within(filters).getAllByRole("button").map((button) => button.textContent)).toEqual(["Todos", "Fijos", "A elegir", "De creadoras (2 pendientes)"]);
    expect(within(filters).getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");

    await user.click(within(filters).getByRole("button", { name: "A elegir" }));
    await waitFor(() => expect(listPacks).toHaveBeenLastCalledWith(expect.objectContaining({ packType: "CHOOSE", page: 1 }), expect.anything()));
    await user.click(within(filters).getByRole("button", { name: "Fijos" }));
    await waitFor(() => expect(listPacks).toHaveBeenLastCalledWith(expect.objectContaining({ packType: "FIXED" }), expect.anything()));
    await user.click(within(filters).getByRole("button", { name: /De creadoras/ }));
    await waitFor(() => expect(listPacks).toHaveBeenLastCalledWith(expect.objectContaining({ origin: "creators" }), expect.anything()));
    expect(within(filters).getByRole("button", { name: /De creadoras/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("un pack de creadora pendiente se aprueba directo y se rechaza con confirmación", async () => {
    jest.mocked(listPacks).mockResolvedValue(page([CREATOR], 1));
    jest.mocked(setPackApproval).mockResolvedValue({ ...CREATOR, approvalStatus: "APPROVED", active: true });
    const user = userEvent.setup();
    wrap(<PacksView />);
    const row = await screen.findByTestId("pack-row-p-cre");
    expect(within(row).getByText("Por aprobar")).toBeInTheDocument();
    expect(within(row).getByText("De creadora")).toBeInTheDocument();
    // Pendiente: se decide primero (no se edita).
    expect(within(row).queryByRole("button", { name: "Editar Look de Vale" })).not.toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: "Rechazar Look de Vale" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("Un pack rechazado no se vende ni se publica.");
    expect(setPackApproval).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole("button", { name: "Sí, rechazar" }));
    await waitFor(() => expect(setPackApproval).toHaveBeenCalledWith("p-cre", "REJECTED"));
    expect(toast.success).toHaveBeenCalledWith("«Look de Vale» rechazado: no se vende ni se publica.");

    await user.click(within(row).getByRole("button", { name: "Aprobar Look de Vale" }));
    await waitFor(() => expect(setPackApproval).toHaveBeenLastCalledWith("p-cre", "APPROVED"));
    expect(toast.success).toHaveBeenLastCalledWith("«Look de Vale» aprobado: ya se vende y se publica.");
  });

  it("Editar abre la ventana del pack", async () => {
    jest.mocked(listPacks).mockResolvedValue(page([KIT]));
    const user = userEvent.setup();
    wrap(<PacksView />);
    await user.click(await screen.findByRole("button", { name: "Editar Kit verano" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("ventana de Kit verano");
  });
});
