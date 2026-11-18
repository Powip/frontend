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
