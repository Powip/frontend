import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PacksView from "@/components/packs/PacksView";
import { PackFormDialog } from "@/components/packs/PackFormDialog";
import {
  createPack,
  getPackMarginRules,
  getVariantSalePrices,
  listPacks,
  replacePackComponents,
  updatePackBasics,
  type PackView,
} from "@/services/packsService";
import { getVariantCosts } from "@/services/purchasesService";
import { searchReconciliationVariants } from "@/services/reconciliationTask.service";
import { packMargin } from "@/lib/packs/packMath";

let mockRole = "ADMINISTRADOR";
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => "/productos/packs" }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", email: "ana@tienda.pe", role: mockRole }, company: { id: "c1" } } }),
}));
jest.mock("@/services/packsService", () => ({
  ...jest.requireActual("@/services/packsService"),
  listPacks: jest.fn(),
  createPack: jest.fn(),
  replacePackComponents: jest.fn(),
  updatePackBasics: jest.fn(),
  getPackMarginRules: jest.fn(),
  getVariantSalePrices: jest.fn(),
  savePackMinMargin: jest.fn(),
}));
jest.mock("@/services/purchasesService", () => ({ getVariantCosts: jest.fn() }));
jest.mock("@/services/reconciliationTask.service", () => ({ searchReconciliationVariants: jest.fn() }));

const KIT: PackView = {
  id: "p-kit", variantId: "v-kit", name: "Kit verano", description: null, sku: "KIT-001", productSku: "KIT", powipEan: "2100000000017",
  barcode: null, imageUrl: null, price: 90, active: true, categoryId: null, brandId: null,
  components: [
    { variantId: "v-polo", quantity: 2, productId: "p-polo", productName: "Polo", sku: "POL-M", attributeValues: { Talla: "M" }, imageUrl: null, active: true, averageCost: 120 },
    { variantId: "v-gorra", quantity: 1, productId: "p-gorra", productName: "Gorra", sku: "GOR", attributeValues: {}, imageUrl: null, active: true, averageCost: 48 },
  ],
  available: { total: 3, byWarehouse: [{ inventoryId: "i1", inventoryName: "Breña", storeId: "s1", available: 3 }] },
  cost: 288, netPrice: 76.2712, igvAffected: true, margin: -2.776, minMargin: 0.15, marginStatus: "bajo_costo", missingCostVariantIds: [],
};
const OK_PACK: PackView = { ...KIT, id: "p-ok", variantId: "v-ok", name: "Dúo básico", price: 200, cost: 100, margin: 0.41, marginStatus: "ok" };
const page = (data: PackView[]) => ({ data, meta: { page: 1, limit: 50, total: data.length, totalPages: 1 } });
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
  jest.mocked(getVariantSalePrices).mockResolvedValue(new Map([["v-polo", 59.9], ["v-gorra", 39.9]]));
});

describe("margen del pack (H9-D3)", () => {
  it("mide sobre el precio sin IGV y marca bajo el mínimo o bajo el costo", () => {
    const costs = new Map([["a", 30]]);
    const rules = { minMargin: 0.15, igvAffected: true };
    expect(packMargin({ price: 118, components: [{ variantId: "a", quantity: 2 }], costs, rules })).toMatchObject({ netPrice: 100, cost: 60, margin: 0.4, status: "ok" });
    expect(packMargin({ price: 70.8, components: [{ variantId: "a", quantity: 2 }], costs, rules })).toMatchObject({ netPrice: 60, status: "bajo_minimo", margin: 0 });
    expect(packMargin({ price: 59, components: [{ variantId: "a", quantity: 2 }], costs, rules }).status).toBe("bajo_costo");
    expect(packMargin({ price: 100, components: [{ variantId: "a", quantity: 2 }], costs, rules: { minMargin: 0.15, igvAffected: false } })).toMatchObject({ netPrice: 100, margin: 0.4 });
    expect(packMargin({ price: 100, components: [{ variantId: "b", quantity: 1 }], costs, rules }).status).toBe("sin_costo");
  });
});

describe("Catálogo › Packs (H9-D1/D3)", () => {
  it("lista los packs con su stock calculado, el margen y la alerta bajo el mínimo", async () => {
    jest.mocked(listPacks).mockResolvedValue(page([KIT, OK_PACK]));
    wrap(<PacksView />);
    const kit = await screen.findByTestId("pack-row-p-kit");
    expect(within(kit).getByText("2 × Polo · M")).toBeInTheDocument();
    expect(within(kit).getByText("3")).toHaveAttribute("title", "Breña: 3");
    expect(within(kit).getByText("S/ 288.00")).toBeInTheDocument();
    expect(within(kit).getByText(/margen bajo/)).toBeInTheDocument();
    expect(within(screen.getByTestId("pack-row-p-ok")).getByText("41 %")).toBeInTheDocument();
    expect(within(screen.getByTestId("pack-row-p-ok")).queryByText(/margen bajo/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nuevo pack/ })).toBeInTheDocument();
    expect(await screen.findByText(/Margen mínimo de los packs/)).toBeInTheDocument();
  });

  it("sin rol de costos muestra «••••» en costo y margen y no deja crear ni editar", async () => {
    mockRole = "VENTAS";
    jest.mocked(listPacks).mockResolvedValue(page([strip(KIT)]));
    wrap(<PacksView />);
    const kit = await screen.findByTestId("pack-row-p-kit");
    expect(within(kit).getAllByText("••••")).toHaveLength(2);
    expect(within(kit).queryByText(/margen bajo/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nuevo pack/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar Kit verano/ })).not.toBeInTheDocument();
    expect(getPackMarginRules).not.toHaveBeenCalled();
  });
});

describe("alta y edición del pack", () => {
  it("calcula el margen en vivo y exige confirmar un margen bajo antes de crear", async () => {
    jest.mocked(getVariantCosts).mockResolvedValue([{ variantId: "v-polo", averageCost: 120 }, { variantId: "v-gorra", averageCost: 48 }]);
    jest.mocked(searchReconciliationVariants).mockResolvedValue([
      { variant_id: "v-polo", product_name: "Polo", sku: "INT-1", company_sku: "POL-M", attribute_values: { Talla: "M" }, product_type: "variantes", tracking_mode: "NONE" },
      { variant_id: "v-imei", product_name: "Celular", sku: "CEL", company_sku: null, attribute_values: {}, product_type: "simple", tracking_mode: "IMEI" },
      { variant_id: "v-pack", product_name: "Otro pack", sku: "PK", company_sku: null, attribute_values: {}, product_type: "pack", tracking_mode: "NONE" },
    ]);
    jest.mocked(createPack).mockResolvedValue(KIT);
    const user = userEvent.setup();
    const onClose = jest.fn();
    wrap(<PackFormDialog pack={null} onClose={onClose} />);
    await user.type(screen.getByLabelText("Nombre"), "Kit verano");
    await user.type(screen.getByLabelText("Precio (con IGV)"), "90");
    await user.type(screen.getByLabelText("Agregar componente"), "pol");
    const results = await screen.findByRole("list", { name: "Resultados de Agregar componente" });
    expect(within(results).queryByText("Celular")).not.toBeInTheDocument();
    expect(within(results).queryByText("Otro pack")).not.toBeInTheDocument();
    await user.click(within(results).getByText("Polo · M"));
    const qty = screen.getByLabelText("Cantidad de Polo · M");
    await user.clear(qty);
    await user.type(qty, "2");

    await waitFor(() => expect(screen.getByTestId("pack-margin")).toHaveTextContent("-215 %"));
    expect(screen.getByText("S/ 119.80")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/menor que el costo/);

    await user.click(screen.getByRole("button", { name: "Guardar pack" }));
    expect(createPack).not.toHaveBeenCalled();
    expect(screen.getByText("Confirma que quieres guardar el pack con este margen.")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Guardar igual con este margen"));
    await user.click(screen.getByRole("button", { name: "Guardar pack" }));
    await waitFor(() => expect(createPack).toHaveBeenCalledWith({
      name: "Kit verano", price: 90, components: [{ variantId: "v-polo", quantity: 2 }], confirmLowMargin: true,
    }));
    expect(onClose).toHaveBeenCalled();
  });

  it("al editar guarda precio y componentes; un 409 PACK_LOW_MARGIN pide confirmar y reintenta con confirmLowMargin", async () => {
    jest.mocked(getVariantCosts).mockResolvedValue([{ variantId: "v-polo", averageCost: 10 }, { variantId: "v-gorra", averageCost: 5 }]);
    const conflict = new AxiosError("409", "ERR", undefined, undefined, {
      status: 409, statusText: "Conflict", headers: {}, config: { headers: new AxiosHeaders() },
      data: { code: "PACK_LOW_MARGIN", message: "El margen del pack (10.0 %) queda bajo el mínimo (15.0 %). Para guardarlo igual, confírmalo.", marginStatus: "bajo_minimo" },
    });
    jest.mocked(replacePackComponents).mockRejectedValueOnce(conflict).mockResolvedValueOnce(KIT);
    jest.mocked(updatePackBasics).mockResolvedValue(undefined);
    const user = userEvent.setup();
    wrap(<PackFormDialog pack={KIT} onClose={jest.fn()} />);
    const price = screen.getByLabelText("Precio (con IGV)");
    await user.clear(price);
    await user.type(price, "95");
    await user.click(screen.getByRole("button", { name: "Guardar pack" }));
    await waitFor(() => expect(replacePackComponents).toHaveBeenCalledTimes(1));
    expect(updatePackBasics).toHaveBeenCalledWith(KIT, { price: 95 });
    expect(await screen.findByRole("alert")).toHaveTextContent("queda bajo el mínimo (15.0 %)");

    await user.click(screen.getByLabelText("Guardar igual con este margen"));
    await user.click(screen.getByRole("button", { name: "Guardar pack" }));
    await waitFor(() => expect(replacePackComponents).toHaveBeenLastCalledWith("p-kit", {
      components: [{ variantId: "v-polo", quantity: 2 }, { variantId: "v-gorra", quantity: 1 }], confirmLowMargin: true,
    }));
    // El precio ya quedó guardado en el primer intento: no se vuelve a mandar.
    expect(updatePackBasics).toHaveBeenLastCalledWith(KIT, {});
  });
});
