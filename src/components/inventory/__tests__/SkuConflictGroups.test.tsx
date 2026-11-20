/**
 * Tests: SkuConflictGroups (FEAT-24 H11 — «Por unificar» › SKU repetido)
 *
 * Grupos de `GET /reconciliation-tasks/sku-conflicts` con Renombrar
 * (SkuRenameField), Desactivar (VariantStatusControl) y «Unir a…»; el costo
 * solo para quien ve costos; IMEI o serie no se une.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("next/image", () => ({ __esModule: true, default: ({ alt }: { alt: string }) => <span aria-label={alt} /> }));
jest.mock("@/services/unification.service", () => ({ listSkuConflictGroups: jest.fn() }));
jest.mock("@/services/catalogProductService", () => ({ updateCatalogProduct: jest.fn(), updateCatalogVariant: jest.fn() }));
jest.mock("@/services/variantStatusService", () => ({ setVariantActive: jest.fn() }));
jest.mock("@/services/inventoryItems.service", () => ({ getStockByVariants: jest.fn() }));

import { useAuth } from "@/contexts/AuthContext";
import { listSkuConflictGroups, type SkuConflictPage, type SkuConflictVariant } from "@/services/unification.service";
import { updateCatalogVariant } from "@/services/catalogProductService";
import { setVariantActive } from "@/services/variantStatusService";
import { getStockByVariants } from "@/services/inventoryItems.service";
import { SkuConflictGroups } from "../SkuConflictGroups";

const mockList = jest.mocked(listSkuConflictGroups);

const variant = (overrides: Partial<SkuConflictVariant>): SkuConflictVariant => ({
  variant_id: "v-1", product_id: "p-1", product_name: "Polo", product_type: "variantes", sku: "INT-1", company_sku: "POL-M",
  attribute_values: { Talla: "M" }, image_url: null, price: 39.9, cost: 15.5, sku_conflict: true, tracking_mode: "NONE",
  external_source: null, created_at: "2026-11-01T00:00:00.000Z", ...overrides,
});

const PAGE: SkuConflictPage = {
  data: [{
    sku_key: "POL-M",
    variants: [
      variant({}),
      variant({ variant_id: "v-2", product_id: "p-2", product_name: "Polo Shopify", external_source: "shopify", cost: 18 }),
      variant({ variant_id: "v-3", product_id: "p-3", product_name: "Celular", product_type: "simple", attribute_values: {}, tracking_mode: "IMEI", cost: 900 }),
    ],
  }],
  meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
};

function mockAuth(role: string) {
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "t", user: { id: "u-1", role, permissions: [] }, company: { id: "c-1", stores: [] } },
  } as unknown as ReturnType<typeof useAuth>);
}

function renderGroups(onUnite = jest.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  render(<SkuConflictGroups companyId="c-1" onUnite={onUnite} />, { wrapper });
  return { onUnite };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth("ADMINISTRADOR");
  mockList.mockResolvedValue(PAGE);
  jest.mocked(updateCatalogVariant).mockResolvedValue({});
  jest.mocked(setVariantActive).mockResolvedValue();
  jest.mocked(getStockByVariants).mockResolvedValue([]);
});

describe("SkuConflictGroups (FEAT-24 H11)", () => {
  it("lista cada grupo con sus variantes, tipo, canal y costo para quien ve costos", async () => {
    renderGroups();
    expect(await screen.findByRole("heading", { name: "SKU repetido (1)" })).toBeInTheDocument();
    expect(mockList).toHaveBeenCalledWith({ page: 1, limit: 10, q: "" });
    const group = screen.getByRole("article", { name: "SKU POL-M" });
    expect(within(group).getByText("3 variantes con este SKU")).toBeInTheDocument();
    expect(within(group).getByText("Polo Shopify")).toBeInTheDocument();
    expect(within(group).getByText("Shopify")).toBeInTheDocument();
    expect(within(group).getAllByText("Con variantes")).toHaveLength(2);
    expect(within(group).getByText(/Costo S\/\s*15\.50/)).toBeInTheDocument();
  });

  it("oculta el costo a un rol que no ve costos", async () => {
    mockAuth("VENTAS");
    renderGroups();
    await screen.findByRole("heading", { name: "SKU repetido (1)" });
    expect(screen.getAllByText(/Precio S\/\s*39\.90/)).toHaveLength(3);
    expect(screen.queryByText(/Costo/)).not.toBeInTheDocument();
  });

  it("«Unir a…» entrega la variante para precargarla como origen; con IMEI o serie no se une", async () => {
    const user = userEvent.setup();
    const { onUnite } = renderGroups();
    await user.click(await screen.findByRole("button", { name: "Unir a… Polo Shopify · Talla: M" }));
    expect(onUnite).toHaveBeenCalledWith(expect.objectContaining({ variant_id: "v-2", product_name: "Polo Shopify" }));
    expect(screen.getByRole("button", { name: "Unir a… Celular · Sin atributos" })).toBeDisabled();
    expect(screen.getByText("Con IMEI o serie no se unifica: renómbrala o desactívala.")).toBeInTheDocument();
  });

  it("renombra con el mismo campo del panel de SKU repetido y vuelve a pedir los grupos", async () => {
    const user = userEvent.setup();
    renderGroups();
    await user.type(await screen.findByLabelText("SKU nuevo de Polo Shopify · Talla: M"), "POL-M-SHP");
    await user.click(screen.getByRole("button", { name: "Guardar SKU de Polo Shopify · Talla: M" }));
    await waitFor(() => expect(updateCatalogVariant).toHaveBeenCalledWith("v-2", { companySku: "POL-M-SHP" }));
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  });

  it("desactiva la variante que sobra con el control de siempre y vuelve a pedir los grupos", async () => {
    const user = userEvent.setup();
    renderGroups();
    await screen.findByRole("heading", { name: "SKU repetido (1)" });
    await user.click(screen.getAllByRole("button", { name: "Desactivar" })[1]);
    await user.click(await screen.findByRole("button", { name: "Desactivar variante" }));
    await waitFor(() => expect(setVariantActive).toHaveBeenCalledWith("v-2", false));
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  });

  it("sin SKU repetidos no muestra nada", async () => {
    mockList.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });
    renderGroups();
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: /SKU repetido/ })).not.toBeInTheDocument();
  });
});
