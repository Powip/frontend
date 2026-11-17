/**
 * Tests: ManualUnificationDialog (FEAT-24 H11 — «Unificar manualmente»)
 *
 * 1. Elegir con el buscador seguro (nunca un UUID), vista previa lado a lado
 *    con foto, tipo y canal (completados con `getVariantPreview`).
 * 2. «Contar ahora» exige la cantidad; con otro modo no se manda.
 * 3. La confirmación dice que no se puede deshacer.
 * 4. El 400/409 del backend se muestra tal cual.
 * 5. Avisos previos: atributos distintos, IMEI o serie, misma variante.
 * 6. «Unir a…» llega con el origen precargado.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => <span data-testid="foto" aria-label={alt} data-src={src} />,
}));
jest.mock("@/services/reconciliationTask.service", () => ({
  ...jest.requireActual("@/services/reconciliationTask.service"),
  searchReconciliationVariants: jest.fn(),
}));
jest.mock("@/services/inventoryItems.service", () => ({ getStockByVariants: jest.fn() }));
jest.mock("@/services/unification.service", () => ({
  createUnification: jest.fn(),
  getVariantPreview: jest.fn(),
}));

import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { searchReconciliationVariants, type VariantSearchResult } from "@/services/reconciliationTask.service";
import { getStockByVariants } from "@/services/inventoryItems.service";
import { createUnification, getVariantPreview, type VariantPreview } from "@/services/unification.service";
import { ManualUnificationDialog } from "../ManualUnificationDialog";
import type { UnificationPick } from "../unificationRules";

const mockSearch = jest.mocked(searchReconciliationVariants);
const mockPreview = jest.mocked(getVariantPreview);
const mockCreate = jest.mocked(createUnification);
const mockStock = jest.mocked(getStockByVariants);

const MADRE: VariantSearchResult = { variant_id: "v-madre", product_name: "Polo Azul", sku: "INT-1", company_sku: "POL-M", attribute_values: { Talla: "M" } };
const OTRA: VariantSearchResult = { variant_id: "v-otra", product_name: "Polo azul Shopify", sku: "SHP-1", company_sku: "SHP-M", attribute_values: { Talla: "M" } };

const preview = (result: VariantSearchResult, overrides: Partial<VariantPreview> = {}): VariantPreview => ({
  variant_id: result.variant_id,
  product_id: `p-${result.variant_id}`,
  product_name: result.product_name,
  product_type: "variantes",
  sku: result.sku,
  company_sku: result.company_sku,
  attribute_values: result.attribute_values,
  image_url: `https://img.test/${result.variant_id}.png`,
  external_source: result.variant_id === "v-otra" ? "shopify" : null,
  tracking_mode: "NONE",
  is_active: true,
  merged_into: null,
  cost: 12.5,
  ...overrides,
});

function mockAuth(role = "ADMINISTRADOR") {
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "t", user: { id: "u-1", email: "admin@fixture.invalid", role, permissions: [] }, company: { id: "c-1", name: "Empresa", stores: [] } },
  } as unknown as ReturnType<typeof useAuth>);
}

function renderDialog(props: { initialOrigin?: UnificationPick | null } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = jest.fn();
  const onUnified = jest.fn();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  render(<ManualUnificationDialog open initialOrigin={props.initialOrigin} onClose={onClose} onUnified={onUnified} />, { wrapper });
  return { onClose, onUnified };
}

const axiosError = (status: number, message: string) =>
  new AxiosError(String(status), "ERR", undefined, undefined, {
    status, statusText: "Error", headers: {}, config: { headers: new AxiosHeaders() }, data: { message },
  });

async function pickBoth(user: ReturnType<typeof userEvent.setup>, otra: VariantSearchResult = OTRA) {
  mockSearch.mockImplementation(async (q) => (q.toLowerCase().includes("shop") ? [otra] : [MADRE]));
  await user.type(screen.getByLabelText("Buscar Variante madre (se queda)"), "polo");
  await user.click(await screen.findByRole("button", { name: /Polo Azul/ }));
  await user.type(screen.getByLabelText("Buscar Variante que se une"), "shop");
  await user.click(await screen.findByRole("button", { name: /Polo azul Shopify/ }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth();
  mockPreview.mockImplementation(async (id) => preview(id === "v-otra" ? OTRA : MADRE));
  mockStock.mockResolvedValue([
    { variant_id: "v-madre", quantity: 5, reserved_quantity: 0, available: 5, inventories: [{ inventory_id: "inv-1", inventory_name: "Principal", store_id: null, quantity: 5, reserved_quantity: 0 }] },
    { variant_id: "v-otra", quantity: 2, reserved_quantity: 0, available: 2, inventories: [{ inventory_id: "inv-1", inventory_name: "Principal", store_id: null, quantity: 2, reserved_quantity: 0 }] },
  ]);
  mockCreate.mockResolvedValue({} as Awaited<ReturnType<typeof createUnification>>);
});

describe("ManualUnificationDialog (FEAT-24 H11)", () => {
  it("elige las dos con el buscador y las muestra lado a lado con foto, SKU, atributos, tipo y canal", async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(screen.getByRole("button", { name: /Continuar/ })).toBeDisabled();
    await pickBoth(user);

    expect(mockSearch).toHaveBeenCalledWith("polo");
    await waitFor(() => expect(mockPreview).toHaveBeenCalledWith("v-otra", "c-1", expect.anything()));
    expect(await screen.findByLabelText("Polo azul Shopify")).toHaveAttribute("data-src", "https://img.test/v-otra.png");
    expect(screen.getByText("SKU: POL-M")).toBeInTheDocument();
    expect(screen.getByText("SKU: SHP-M")).toBeInTheDocument();
    expect(screen.getAllByText("Con variantes")).toHaveLength(2);
    expect(screen.getByText("Shopify")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(await screen.findByText("5 (0 reservado)")).toBeInTheDocument();
    expect(screen.getByText(/«Polo azul Shopify» \(SHP-M\) se unirá a «Polo Azul» \(POL-M\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar/ })).toBeEnabled();
  });

  it("«Contar ahora» sin cantidad no deja seguir; con la cantidad manda countedQuantity y avisa que no se deshace", async () => {
    const user = userEvent.setup();
    const { onUnified, onClose } = renderDialog();
    await pickBoth(user);
    await user.click(screen.getByRole("button", { name: /Continuar/ }));

    await user.click(screen.getByRole("radio", { name: /Contar ahora/ }));
    expect(screen.getByRole("button", { name: /Vista previa/ })).toBeDisabled();
    await user.type(screen.getByLabelText(/Cantidad contada/), "abc");
    expect(screen.getByRole("alert")).toHaveTextContent("Ingresa un número entero entre 0 y 10,000");
    expect(screen.getByRole("button", { name: /Vista previa/ })).toBeDisabled();
    await user.clear(screen.getByLabelText(/Cantidad contada/));
    await user.type(screen.getByLabelText(/Cantidad contada/), "7");
    await user.click(screen.getByRole("button", { name: /Vista previa/ }));

    expect(screen.getByText("Esta unificación no se puede deshacer.")).toBeInTheDocument();
    expect(screen.getByText("7 (conteo físico)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Aplicar unificación" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({
      originVariantId: "v-otra",
      targetVariantId: "v-madre",
      stockMode: "count",
      countedQuantity: 7,
    }));
    await waitFor(() => expect(onUnified).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("«Polo azul Shopify» se unió a «Polo Azul».");
  });

  it("con «Sumar ambos» no manda cantidad y muestra el stock resultante", async () => {
    const user = userEvent.setup();
    renderDialog();
    await pickBoth(user);
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.click(await screen.findByRole("radio", { name: /Sumar ambos \(7\)/ }));
    await user.click(screen.getByRole("button", { name: /Vista previa/ }));
    await user.click(screen.getByRole("button", { name: "Aplicar unificación" }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ originVariantId: "v-otra", targetVariantId: "v-madre", stockMode: "sum" }));
  });

  it.each([
    [400, "Polo Azul (Talla: M) ya recibió otra unificación: elígela como destino, no como origen."],
    [409, "Polo Azul tiene seguimiento por IMEI o serie: los productos con IMEI o serie no se unifican."],
  ])("muestra el %s del backend tal cual y deja el diálogo abierto", async (status, message) => {
    mockCreate.mockRejectedValueOnce(axiosError(status, message));
    const user = userEvent.setup();
    const { onClose, onUnified } = renderDialog();
    await pickBoth(user);
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.click(screen.getByRole("radio", { name: /Quedarse con el stock de la madre/ }));
    await user.click(screen.getByRole("button", { name: /Vista previa/ }));
    await user.click(screen.getByRole("button", { name: "Aplicar unificación" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(toast.error).toHaveBeenCalledWith(message);
    expect(onClose).not.toHaveBeenCalled();
    expect(onUnified).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith({ originVariantId: "v-otra", targetVariantId: "v-madre", stockMode: "winner" });
  });

  it("avisa antes de mandar si los atributos difieren o hay IMEI o serie, sin bloquear", async () => {
    const otraTallaL = { ...OTRA, attribute_values: { Talla: "L" } };
    mockPreview.mockImplementation(async (id) =>
      id === "v-otra" ? preview(otraTallaL, { tracking_mode: "IMEI" }) : preview(MADRE));
    const user = userEvent.setup();
    renderDialog();
    await pickBoth(user, otraTallaL);
    const warnings = await screen.findByRole("status");
    await waitFor(() => expect(within(warnings).getByText(/tiene seguimiento por IMEI o serie/)).toBeInTheDocument());
    expect(within(warnings).getByText(/Los atributos no coinciden/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar/ })).toBeEnabled();
  });

  it("avisa si se eligió la misma variante en los dos lados", async () => {
    mockSearch.mockResolvedValue([MADRE]);
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText("Buscar Variante madre (se queda)"), "polo");
    await user.click(await screen.findByRole("button", { name: /Polo Azul/ }));
    await user.type(screen.getByLabelText("Buscar Variante que se une"), "polo");
    await user.click(await screen.findByRole("button", { name: /Polo Azul/ }));
    expect(await screen.findByText(/Elegiste la misma variante en los dos lados/)).toBeInTheDocument();
  });

  it("«Unir a…» llega con la variante que se une ya elegida y sin pedir sus datos", async () => {
    renderDialog({
      initialOrigin: {
        variant_id: "v-dup", product_name: "Gorra Roja", sku: "INT-9", company_sku: "GOR", attribute_values: {},
        product_id: "p-9", product_type: "simple", image_url: null, external_source: "aliclik", tracking_mode: "NONE",
        is_active: true, merged_into: null, cost: 4,
      },
    });
    expect(screen.getByText("Gorra Roja")).toBeInTheDocument();
    expect(screen.getByText("SKU: GOR")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cambiar Variante que se une" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Buscar Variante que se une")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Buscar Variante madre (se queda)")).toBeInTheDocument();
    expect(screen.getByText("Aliclik")).toBeInTheDocument();
    expect(screen.getByText(/4\.00/)).toBeInTheDocument();
    expect(mockPreview).not.toHaveBeenCalled();
  });

  it("el costo de cada variante solo lo ve quien ve costos", async () => {
    const origin: UnificationPick = {
      variant_id: "v-dup", product_name: "Gorra Roja", sku: "INT-9", company_sku: "GOR", attribute_values: {},
      product_type: "simple", tracking_mode: "NONE", is_active: true, merged_into: null, cost: 4,
    };
    mockAuth("VENTAS");
    renderDialog({ initialOrigin: origin });
    expect(screen.getByText("Gorra Roja")).toBeInTheDocument();
    expect(screen.queryByText(/Costo/)).not.toBeInTheDocument();
  });
});
