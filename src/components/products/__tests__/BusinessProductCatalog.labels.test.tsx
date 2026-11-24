import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fetchBusinessProducts } from "@/services/businessProductsService";
import BusinessProductCatalog from "../BusinessProductCatalog";

// FEAT-24 H7 — elegir productos del listado e imprimir sus etiquetas.

jest.mock("next/navigation", () => ({ usePathname: () => "/productos", useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", company: { id: "c-1" }, user: { id: "u-1" } } }),
}));
jest.mock("@/contexts/BusinessScopeContext", () => ({
  useBusinessScope: () => ({ scope: "business", storeIds: [], canFetch: true }),
}));
jest.mock("@/hooks/useBusinessInventories", () => ({
  useBusinessInventories: () => ({ inventories: [], isSuccess: true, isPending: false, error: null, refetch: jest.fn() }),
}));
jest.mock("@/services/businessProductsService", () => ({
  ...jest.requireActual("@/services/businessProductsService"),
  fetchBusinessProducts: jest.fn(),
}));
jest.mock("@/services/businessInventoryItemsService", () => ({ fetchBusinessInventoryItems: jest.fn().mockResolvedValue([]) }));
jest.mock("@/services/productChannelsService", () => ({ getChannelSummary: jest.fn().mockResolvedValue({ channels: [], ownPrices: [] }) }));
jest.mock("@/services/promotionsService", () => ({ listPromotions: jest.fn().mockResolvedValue([]) }));
jest.mock("@/components/labels/PrintLabelsDialog", () => ({
  PrintLabelsDialog: ({ source }: { source: { productIds: string[] } }) => <div>etiquetas de: {source.productIds.join(",")}</div>,
}));

const product = (n: number) => ({
  id: `p${n}`,
  name: `Producto ${String(n).padStart(2, "0")}`,
  sku: `SKU-${n}`,
  status: true,
  priceVta: 10,
  variants: [{ id: `v${n}`, status: true }],
});

function renderCatalog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BusinessProductCatalog onCreate={jest.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  (fetchBusinessProducts as jest.Mock).mockResolvedValue(Array.from({ length: 22 }, (_, i) => product(i + 1)));
});

describe("Lista de productos › Imprimir etiquetas (FEAT-24 H7)", () => {
  it("prints the labels of the chosen products", async () => {
    renderCatalog();
    expect(screen.getByRole("button", { name: "Imprimir etiquetas" })).toBeDisabled();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Seleccionar Producto 01" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Producto 03" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Producto 01" }));
    fireEvent.click(screen.getByRole("button", { name: "Imprimir etiquetas (1)" }));
    expect(screen.getByText("etiquetas de: p3")).toBeInTheDocument();
  });

  it("selects the whole page (20 products) and keeps the others out", async () => {
    renderCatalog();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Seleccionar los productos de la página" }));
    expect(screen.getByRole("checkbox", { name: "Seleccionar Producto 20" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Imprimir etiquetas (20)" }));
    expect(screen.getByText(/etiquetas de: /)).toHaveTextContent(
      `etiquetas de: ${Array.from({ length: 20 }, (_, i) => `p${i + 1}`).join(",")}`,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar los productos de la página" }));
    expect(screen.getByRole("button", { name: "Imprimir etiquetas" })).toBeDisabled();
  });
});
