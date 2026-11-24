import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PriceListsView from "@/components/price-lists/PriceListsView";
import {
  createPriceList,
  getPriceListItems,
  listPriceLists,
  savePriceListItems,
  type PriceList,
  type PriceListItem,
  type PriceListItemsPage,
} from "@/services/priceListsService";
import { buildPriceWrites, inheritedPrice, mergePriceRows } from "@/lib/priceLists/priceMatrix";
import { listPromotions, type Promotion } from "@/services/promotionsService";

let mockRole = "ADMINISTRADOR";
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      accessToken: "t",
      user: { id: "u1", email: "ana@tienda.pe", role: mockRole },
      company: { id: "c1", stores: [{ id: "s1", name: "Livii" }, { id: "s2", name: "Sisi" }] },
    },
  }),
}));
jest.mock("@/services/priceListsService", () => ({
  listPriceLists: jest.fn(),
  getPriceListItems: jest.fn(),
  savePriceListItems: jest.fn(),
  createPriceList: jest.fn(),
}));
jest.mock("@/services/promotionsService", () => ({ listPromotions: jest.fn() }));

const STORE_LIST: PriceList = { id: "l-store", name: "Precios de Livii", storeId: "s1", channel: null, isDefault: false, active: true, itemCount: 1 };
const WSP_LIST: PriceList = { id: "l-wsp", name: "Livii · WhatsApp", storeId: "s1", channel: "WHATSAPP", isDefault: false, active: true, itemCount: 0 };
const OTHER_STORE: PriceList = { id: "l-sisi", name: "Precios de Sisi", storeId: "s2", channel: null, isDefault: false, active: true, itemCount: 0 };

const item = (variantId: string, name: string, base: number, own: number | null, compare: number | null = null): PriceListItem => ({
  variantId, productId: `p-${variantId}`, productName: name, productType: "simple", companySku: `SKU-${variantId}`, attributeValues: {}, imageUrl: null,
  inheritedPrice: base, inList: own !== null, price: own, compareAtPrice: compare, effectivePrice: own ?? base,
});
const pageOf = (list: PriceList, data: PriceListItem[]): PriceListItemsPage => ({ list, data, meta: { page: 1, limit: 50, total: data.length, totalPages: 1 } });

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PriceListsView /></QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = "ADMINISTRADOR";
  jest.mocked(listPromotions).mockResolvedValue([]);
  jest.mocked(listPriceLists).mockResolvedValue([WSP_LIST, STORE_LIST, OTHER_STORE]);
  jest.mocked(getPriceListItems).mockImplementation(async (listId) =>
    listId === "l-store"
      ? pageOf(STORE_LIST, [item("v1", "Polo", 59.9, 49.9, 69.9), item("v2", "Gorra", 39.9, null)])
      : pageOf(WSP_LIST, [item("v1", "Polo", 59.9, null), item("v2", "Gorra", 39.9, 35)]),
  );
  jest.mocked(savePriceListItems).mockResolvedValue({ created: 1, updated: 0, unchanged: 0, removed: 0 });
});

describe("matriz de precios (H9-D6)", () => {
  it("un canal sin precio hereda el de la tienda; la tienda sin precio hereda el precio base", () => {
    const rows = mergePriceRows([
      { listId: "l-store", page: pageOf(STORE_LIST, [item("v1", "Polo", 59.9, 49.9)]) },
      { listId: "l-wsp", page: pageOf(WSP_LIST, [item("v1", "Polo", 59.9, null)]) },
    ]);
    expect(inheritedPrice(rows[0], [STORE_LIST, WSP_LIST], "l-wsp")).toBe(49.9);
    expect(inheritedPrice(rows[0], [STORE_LIST, WSP_LIST], "l-store")).toBe(59.9);
  });

  it("arma solo los cambios: precio vacío vuelve a heredar y el tachado tiene que superar al precio", () => {
    const rows = mergePriceRows([{ listId: "l-store", page: pageOf(STORE_LIST, [item("v1", "Polo", 59.9, 49.9), item("v2", "Gorra", 39.9, null)]) }]);
    const { writes, errors } = buildPriceWrites({ "l-store": { v1: { price: "", compareAtPrice: "" }, v2: { price: "35", compareAtPrice: "30" } } }, rows);
    expect(writes.get("l-store")).toEqual([{ variantId: "v1", price: null }]);
    expect(errors).toEqual(["Gorra: el precio tachado tiene que ser mayor que el precio."]);
    expect(buildPriceWrites({ "l-store": { v1: { price: "49.90", compareAtPrice: "" } } }, rows).writes.size).toBe(0);
  });
});

describe("Catálogo › Listas de precios", () => {
  it("muestra por tienda el precio heredado contra la excepción de cada canal y guarda lo editado", async () => {
    const user = userEvent.setup();
    renderView();
    const polo = await screen.findByTestId("price-row-v1");
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Variante", "Precio base", "Todos los canales", "WhatsApp"]);
    expect(within(polo).getByLabelText("Precio de Polo en todos los canales")).toHaveValue("49.90");
    expect(within(polo).getByLabelText("Precio tachado de Polo en todos los canales")).toHaveValue("69.90");
    expect(within(polo).getByText("Precio propio")).toBeInTheDocument();
    // WhatsApp sin precio propio hereda el de la lista de la tienda.
    expect(within(polo).getByText("hereda S/ 49.90")).toBeInTheDocument();
    const gorra = screen.getByTestId("price-row-v2");
    expect(within(gorra).getByText("hereda S/ 39.90")).toBeInTheDocument();
    expect(getPriceListItems).not.toHaveBeenCalledWith("l-sisi", expect.anything(), expect.anything());

    await user.type(within(gorra).getByLabelText("Precio de Gorra en todos los canales"), "34.5");
    await user.click(screen.getByRole("button", { name: "Guardar precios" }));
    await waitFor(() => expect(savePriceListItems).toHaveBeenCalledWith("l-store", [{ variantId: "v2", price: 34.5, compareAtPrice: null }]));
  });

  it("quitar una excepción la manda en null y la variante vuelve a heredar", async () => {
    const user = userEvent.setup();
    renderView();
    const gorra = await screen.findByTestId("price-row-v2");
    await user.click(within(gorra).getByRole("button", { name: "Quitar precio de Gorra en WhatsApp" }));
    await waitFor(() => expect(savePriceListItems).toHaveBeenCalledWith("l-wsp", [{ variantId: "v2", price: null }]));
  });

  it("sin rol de Administrador solo lee y una tienda sin lista ofrece crearla solo al Administrador", async () => {
    mockRole = "VENTAS";
    renderView();
    const polo = await screen.findByTestId("price-row-v1");
    expect(within(polo).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(polo).getByText("S/ 69.90")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar precios" })).not.toBeInTheDocument();
    expect(createPriceList).not.toHaveBeenCalled();
  });
});

describe("FEAT-32 M2 — canal con regla en Listas de precios", () => {
  const CRM_LIST: PriceList = { id: "l-crm", name: "POWIP CRM", storeId: "s1", channel: "POWIP_CRM", isDefault: false, active: true, itemCount: 1 };
  const rule = { mode: "more" as const, unit: "amount" as const, value: 10 };
  const withChannel = (row: PriceListItem, channel: PriceListItem["channel"]): PriceListItem => ({ ...row, channel });

  beforeEach(() => {
    jest.mocked(listPriceLists).mockResolvedValue([STORE_LIST, CRM_LIST]);
    jest.mocked(getPriceListItems).mockImplementation(async (listId) =>
      listId === "l-store"
        ? pageOf(STORE_LIST, [item("v1", "Polo", 59.9, null), item("v2", "Gorra", 39.9, null), item("v3", "Medias", 9.9, null)])
        : pageOf(CRM_LIST, [
            withChannel(item("v1", "Polo", 59.9, null), { active: true, rule, ruleLabel: "Tienda + S/ 10.00", storePrice: 59.9, rulePrice: 69.9 }),
            withChannel(item("v2", "Gorra", 39.9, 35), { active: true, rule, ruleLabel: "Tienda + S/ 10.00", storePrice: 39.9, rulePrice: 49.9 }),
            withChannel(item("v3", "Medias", 9.9, null), { active: false, rule, ruleLabel: "Tienda + S/ 10.00", storePrice: 9.9, rulePrice: null }),
          ]),
    );
  });

  it("verde agua = sale de la regla, morado = precio propio con «Volver a la regla», y «No activado»", async () => {
    const user = userEvent.setup();
    renderView();
    const polo = await screen.findByTestId("price-row-v1");
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Variante", "Precio base", "Todos los canales", "POWIP CRM"]);
    const poloCell = within(polo).getByTestId("price-cell-l-crm-v1");
    expect(poloCell.className).toMatch(/bg-\[#e7f3f3\]/);
    expect(within(poloCell).getByText("regla: tienda + s/ 10.00")).toBeInTheDocument();
    expect(within(poloCell).getByLabelText("Precio de Polo en POWIP CRM")).toHaveAttribute("placeholder", "69.90");

    const gorraCell = within(screen.getByTestId("price-row-v2")).getByTestId("price-cell-l-crm-v2");
    expect(gorraCell.className).toMatch(/bg-\[#efecfb\]/);
    expect(within(gorraCell).getByText(/precio propio/)).toBeInTheDocument();
    await user.click(within(gorraCell).getByRole("button", { name: "Volver a la regla" }));
    await waitFor(() => expect(savePriceListItems).toHaveBeenCalledWith("l-crm", [{ variantId: "v2", price: null }]));

    const medias = screen.getByTestId("price-row-v3");
    expect(within(medias).getByText("No activado")).toBeInTheDocument();
    expect(within(medias).queryByLabelText("Precio de Medias en POWIP CRM")).not.toBeInTheDocument();

    await user.type(within(poloCell).getByLabelText("Precio de Polo en POWIP CRM"), "65");
    expect(within(poloCell).getByText("cambio sin guardar")).toBeInTheDocument();
    expect(poloCell.className).toMatch(/bg-\[#efecfb\]/);
  });
});

describe("FEAT-32 M3 — campaña activa en Listas de precios", () => {
  it("la columna del canal muestra «Cyber Wow: S/ X» sobre el precio del canal; la lista no cambia", async () => {
    const campaign = {
      id: "c-1", name: "Cyber Wow", type: "CAMPAIGN", isActive: true, channels: ["WHATSAPP"], storeIds: ["s1"],
      startsAt: "2020-01-01T05:00:00.000Z", endsAt: "2099-01-01T05:00:00.000Z", status: "ACTIVE", combinable: false,
      discountType: "PERCENT", discountValue: 20, allProducts: false,
      products: [{ productId: "p-v1", discountType: null, discountValue: null }, { productId: "p-v2", discountType: null, discountValue: null }], manualPrices: [],
    } as unknown as Promotion;
    jest.mocked(listPromotions).mockResolvedValue([campaign]);
    renderView();
    const polo = await screen.findByTestId("price-row-v1");
    // Polo: WhatsApp hereda de la tienda (49.90) → −20% = 39.92. Gorra: precio propio en WhatsApp 35 → 28.00.
    await waitFor(() => expect(within(polo).getByTestId("price-cell-l-wsp-v1")).toHaveTextContent("Cyber Wow: S/ 39.92"));
    expect(within(screen.getByTestId("price-row-v2")).getByTestId("price-cell-l-wsp-v2")).toHaveTextContent("Cyber Wow: S/ 28.00");
    // La columna de todos los canales no lleva la etiqueta (la campaña es por canal).
    expect(within(polo).getByTestId("price-cell-l-store-v1")).not.toHaveTextContent("Cyber Wow");
  });
});
