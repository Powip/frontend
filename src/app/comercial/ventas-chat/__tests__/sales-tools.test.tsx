import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as tools from "@/services/crmSalesToolsService";
import CommissionsSection from "@/components/ventas-chat/CommissionsSection";
import CoreProductPicker from "@/components/ventas-chat/CoreProductPicker";
import { FichaAlbum, FichaCoreStock } from "@/components/ventas-chat/FichaCoreSection";
import ObjectionTester from "@/components/ventas-chat/ObjectionTester";
import VentasView, { salesRowPdfSpec } from "@/components/ventas-chat/VentasView";
import type { CatalogItem, CommissionsReport, SalesBoardRow } from "@/types/crmSalesTools";

const access = { level: "admin", isAdmin: true, isSupervisor: true, stores: [], fromServer: true, phoneMasked: false };
jest.mock("@/hooks/useCrmMe", () => ({ useCrmMe: () => access }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      accessToken: "t",
      user: { id: "u1", name: "Jairo", surname: "R" },
      company: { id: "co1", stores: [{ id: "st1", name: "Tienda 1" }] },
    },
  }),
}));
const download = jest.fn().mockResolvedValue(undefined);
jest.mock("@/hooks/usePdfDownload", () => ({ usePdfDownload: () => download }));
jest.mock("@/components/modals/ImportSalesModal", () => ({
  __esModule: true,
  default: (p: { isOpen: boolean; storeId: string }) => (p.isOpen ? <div data-testid="import-modal">{p.storeId}</div> : null),
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn() } }));
jest.mock("@/services/crmSalesToolsService", () => ({
  ...jest.requireActual("@/services/crmSalesToolsService"),
  searchCoreCatalog: jest.fn(),
  getSheetCore: jest.fn(),
  listAlbum: jest.fn(),
  addAlbumItem: jest.fn(),
  createCatalogLink: jest.fn(),
  detectObjection: jest.fn(),
  getCommissions: jest.fn(),
  updateCommissionRule: jest.fn(),
  getSalesBoard: jest.fn(),
  refreshQuote: jest.fn(),
}));
const t = tools as jest.Mocked<typeof tools>;

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const item = (over: Partial<CatalogItem> = {}): CatalogItem => ({
  productVariantId: "v1",
  productId: "p1",
  name: "Polo básico",
  variant: "Negro / M",
  sku: "POLO-N-M",
  unitPrice: 39.9,
  stockAvailable: 12,
  imageUrl: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  access.isAdmin = true;
  access.isSupervisor = true;
});

describe("Ficha con el Core (filas 48 y 49)", () => {
  it("muestra variantes con precio, stock y agotado; marca la demostración", async () => {
    t.getSheetCore.mockResolvedValue({
      linked: true,
      source: "mock",
      items: [item(), item({ productVariantId: "v2", variant: "Negro / L", sku: "POLO-N-L", stockAvailable: 0 })],
    });
    wrap(<FichaCoreStock sheetId="s1" linked />);
    const rows = await screen.findAllByTestId("core-variant");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("S/ 39.90")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Agotado")).toBeInTheDocument();
    expect(screen.getByText("Demostración")).toBeInTheDocument();
  });

  it("sin vínculo no consulta el Core", () => {
    wrap(<FichaCoreStock sheetId="s1" linked={false} />);
    expect(t.getSheetCore).not.toHaveBeenCalled();
  });

  it("la vendedora propone material para el álbum", async () => {
    access.isAdmin = false;
    access.isSupervisor = false;
    t.listAlbum.mockResolvedValue([]);
    t.addAlbumItem.mockResolvedValue({} as never);
    wrap(<FichaAlbum sheetId="s1" sheetName="Polo" />);
    fireEvent.change(await screen.findByLabelText("Título"), { target: { value: "Frente" } });
    fireEvent.change(screen.getByLabelText("Enlace (https)"), { target: { value: "https://img.example/1.jpg" } });
    fireEvent.click(screen.getByRole("button", { name: /Proponer/ }));
    await waitFor(() =>
      expect(t.addAlbumItem).toHaveBeenCalledWith("s1", expect.objectContaining({ title: "Frente", url: "https://img.example/1.jpg" })),
    );
  });

  it("el selector agrupa variantes por producto y vincula al elegir", async () => {
    t.searchCoreCatalog.mockResolvedValue({ source: "core", items: [item(), item({ productVariantId: "v2", unitPrice: 35 })] });
    const onChange = jest.fn();
    wrap(<CoreProductPicker value="" onChange={onChange} />);
    fireEvent.focus(screen.getByPlaceholderText("Buscar en el catálogo…"));
    const option = await screen.findByRole("button", { name: /Polo básico/ });
    expect(option).toHaveTextContent("2 var. · desde S/ 35.00");
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith("p1");
  });
});

describe("Detección de objeciones (fila 50)", () => {
  it("prueba un mensaje y muestra la respuesta sugerida", async () => {
    t.detectObjection.mockResolvedValue({
      objectionId: "o1",
      label: "Precio alto",
      confidence: 0.8,
      suggestedResponse: "Incluye envío gratis.",
      source: "mock",
      text: "muy caro",
    });
    wrap(<ObjectionTester />);
    fireEvent.change(screen.getByLabelText("Mensaje del cliente"), { target: { value: "muy caro" } });
    fireEvent.click(screen.getByRole("button", { name: /Probar/ }));
    const result = await screen.findByTestId("objection-test-result");
    expect(t.detectObjection).toHaveBeenCalledWith({ text: "muy caro" });
    expect(result).toHaveTextContent("Precio alto");
    expect(result).toHaveTextContent("Incluye envío gratis.");
  });
});

const report = (over: Partial<CommissionsReport> = {}): CommissionsReport => ({
  days: 30,
  rule: { percent: 5, base: "paid", isDefault: true, updatedByName: null, updatedAt: null },
  members: [
    { userId: "u1", userName: "Ana", orders: 3, cancelled: 1, sold: 300, collected: 200, commission: 10 },
    { userId: "u2", userName: "Bea", orders: 1, cancelled: 0, sold: 100, collected: 100, commission: 5 },
  ],
  totals: { orders: 4, cancelled: 1, sold: 400, collected: 300, commission: 15 },
  onlyMine: false,
  ...over,
});

describe("Comisiones (fila 51)", () => {
  it("lista ventas y comisiones con la regla por defecto", async () => {
    t.getCommissions.mockResolvedValue(report());
    wrap(<CommissionsSection />);
    const rows = await screen.findAllByTestId("commission-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("S/ 10.00")).toBeInTheDocument();
    expect(screen.getByText("Por defecto: 5 % de lo cobrado")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("la supervisora cambia la regla", async () => {
    t.getCommissions.mockResolvedValue(report());
    t.updateCommissionRule.mockResolvedValue(report().rule);
    wrap(<CommissionsSection />);
    fireEvent.change(await screen.findByLabelText("Porcentaje"), { target: { value: "7,5" } });
    fireEvent.change(screen.getByLabelText("Se calcula sobre"), { target: { value: "total" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar regla/ }));
    await waitFor(() => expect(t.updateCommissionRule).toHaveBeenCalledWith(7.5, "total"));
  });

  it("la vendedora ve solo su fila y no edita la regla", async () => {
    access.isAdmin = false;
    access.isSupervisor = false;
    t.getCommissions.mockResolvedValue(report({ members: [report().members[0]], totals: null, onlyMine: true }));
    wrap(<CommissionsSection />);
    expect(await screen.findByText("Ves solo tus ventas.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Porcentaje")).not.toBeInTheDocument();
  });
});

const row = (over: Partial<SalesBoardRow> = {}): SalesBoardRow => ({
  kind: "quote",
  id: "q1",
  coreId: "core-q1",
  number: "COT-001",
  conversationId: "c1",
  contactName: "Ana Pérez",
  channel: "whatsapp",
  sellerId: "u1",
  sellerName: "Jairo R",
  status: "PENDING",
  total: 120,
  paid: 0,
  publicUrl: "https://link.powip.example/q/abc",
  orderId: null,
  createdAt: "2026-11-20T15:00:00.000Z",
  bucket: "pending",
  ...over,
});

describe("Ventas desde el CRM (fila 58)", () => {
  it("lista documentos, filtra anuladas y descarga el PDF", async () => {
    t.getSalesBoard.mockResolvedValue([row(), row({ kind: "order", id: "o1", number: "PED-9", paid: 50, publicUrl: null })]);
    wrap(<VentasView />);
    const rows = await screen.findAllByTestId("sales-row");
    expect(rows).toHaveLength(2);
    expect(t.getSalesBoard).toHaveBeenCalledWith("pending", 60);
    expect(screen.getByRole("link", { name: /Nueva venta/ })).toHaveAttribute("href", "/registrar-venta");
    expect(within(rows[0]).getByRole("link", { name: /Abrir chat/ })).toHaveAttribute("href", expect.stringContaining("c=c1"));

    fireEvent.click(within(rows[0]).getByRole("button", { name: "Descargar PDF de COT-001" }));
    await waitFor(() => expect(download).toHaveBeenCalledWith(expect.objectContaining({ title: "Cotización", number: "COT-001" })));

    fireEvent.click(screen.getByRole("button", { name: "Anuladas" }));
    await waitFor(() => expect(t.getSalesBoard).toHaveBeenCalledWith("cancelled", 60));
  });

  it("actualiza la cotización desde el Core y abre la importación de Excel", async () => {
    t.getSalesBoard.mockResolvedValue([row()]);
    t.refreshQuote.mockResolvedValue({ synced: true });
    wrap(<VentasView />);
    fireEvent.click(await screen.findByRole("button", { name: "Actualizar COT-001 desde el Core" }));
    await waitFor(() => expect(t.refreshQuote).toHaveBeenCalledWith("q1"));
    fireEvent.click(screen.getByRole("button", { name: /Importar Excel/ }));
    expect(screen.getByTestId("import-modal")).toHaveTextContent("st1");
  });

  it("el PDF de un pedido trae pagado y saldo", () => {
    const spec = salesRowPdfSpec(row({ kind: "order", number: "PED-9", total: 100, paid: 40, publicUrl: null }));
    expect(spec.title).toBe("Pedido");
    expect(spec.tables[0].rows).toEqual([
      ["Total", "S/ 100.00"],
      ["Pagado", "S/ 40.00"],
      ["Saldo", "S/ 60.00"],
    ]);
    expect(spec.fileName).toBe("pedido-PED-9.pdf");
  });
});
