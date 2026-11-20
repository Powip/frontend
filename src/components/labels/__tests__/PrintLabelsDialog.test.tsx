import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import axiosAuth from "@/lib/axiosAuth";
import { downloadLabelsPdf } from "@/lib/labels/pdf";
import type { LabelsSource } from "@/lib/labels/request";
import { SAMPLE_LABEL_LINE, type LabelFormat, type LabelLine } from "@/lib/labels/types";
import { fetchLabelLines, listLabelFormats } from "@/services/labelsService";
import { listPurchasableProducts } from "@/services/purchasesService";
import { lookupVariantsByCodes } from "@/services/variantCodesService";
import { PrintLabelsDialog } from "../PrintLabelsDialog";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/services/labelsService", () => ({
  ...jest.requireActual("@/services/labelsService"),
  listLabelFormats: jest.fn(),
  fetchLabelLines: jest.fn(),
}));
jest.mock("@/services/purchasesService", () => ({ listPurchasableProducts: jest.fn().mockResolvedValue([]) }));
jest.mock("@/services/variantCodesService", () => ({ lookupVariantsByCodes: jest.fn().mockResolvedValue([]) }));
jest.mock("@/hooks/useBusinessInventories", () => ({
  useBusinessInventories: () => ({
    inventories: [
      { id: "w1", name: "Almacén central", storeId: "s1", storeName: "Tienda Centro" },
      { id: "w2", name: "Depósito Norte", storeId: "s2", storeName: "Tienda Norte" },
    ],
  }),
}));
jest.mock("@/hooks/useCompanyBrands", () => ({ useCompanyBrands: () => ({ brands: [{ id: "b1", name: "Mi marca" }] }) }));
// FEAT-24 H4: las categorías del filtro son las propias de la empresa (árbol de GET /catalog-categories).
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({
      data: [
        {
          id: "c1",
          name: "Ropa",
          parentId: null,
          active: true,
          level: 1,
          children: [
            { id: "c2", name: "Polos", parentId: "c1", active: true, level: 2, children: [] },
            { id: "c3", name: "Vieja", parentId: "c1", active: false, level: 2, children: [] },
          ],
        },
      ],
    }),
  },
}));
jest.mock("@/lib/labels/pdf", () => ({ downloadLabelsPdf: jest.fn(() => 3) }));

const formats: LabelFormat[] = [
  { id: "f1", name: "Básica", widthMm: 50, heightMm: 25, output: "termica", fields: ["name", "variant", "sku", "barcode"], priceSource: "price_vta", isDefault: true },
  { id: "f3", name: "Completa", widthMm: 100, heightMm: 50, output: "a4", fields: ["name", "store", "price", "qr"], priceSource: "price_vta", isDefault: false },
];

const line = (variantId: string, sku: string, quantity: number): LabelLine => ({
  ...SAMPLE_LABEL_LINE,
  variantId,
  productId: "p1",
  sku,
  qrText: sku,
  variant: sku.slice(-5),
  quantity,
});

function renderDialog(source: LabelsSource = { kind: "products", productIds: ["p1"], title: "Polo básico" }) {
  const onOpenChange = jest.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PrintLabelsDialog open source={source} onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

const downloadButton = () => screen.getByRole("button", { name: /Descargar PDF/ });

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({
    auth: {
      accessToken: "t",
      company: { id: "c-1", name: "LIVII", stores: [{ id: "s1", name: "Tienda Centro" }, { id: "s2", name: "Tienda Norte" }] },
      user: { id: "u-1", email: "user@example.test", role: "VENTAS", permissions: [] },
    },
  });
  (listLabelFormats as jest.Mock).mockResolvedValue(formats);
  (fetchLabelLines as jest.Mock).mockResolvedValue([line("v1", "POLO-M-NEG", 1), line("v2", "POLO-L-NEG", 1)]);
});

describe("Imprimir etiquetas (FEAT-24 H7)", () => {
  it("from the product: one per variant with the default format, editable quantities and the PDF", async () => {
    renderDialog();
    expect(await screen.findByLabelText("Etiquetas de POLO-M-NEG")).toBeInTheDocument();
    expect(fetchLabelLines).toHaveBeenCalledWith({ origin: "products", ids: ["p1"] }, expect.anything());
    expect(screen.getByRole("heading", { name: "Imprimir etiquetas · Polo básico" })).toBeInTheDocument();
    expect(screen.getByLabelText("Formato")).toHaveValue("f1");
    expect(screen.getByRole("img", { name: "Vista previa de la etiqueta de 50×25 mm" })).toBeInTheDocument();
    expect(downloadButton()).toHaveTextContent("Descargar PDF · 2 etiquetas");

    fireEvent.change(screen.getByLabelText("Etiquetas de POLO-L-NEG"), { target: { value: "4" } });
    expect(downloadButton()).toHaveTextContent("Descargar PDF · 5 etiquetas");
    fireEvent.click(downloadButton());

    await waitFor(() => expect(downloadLabelsPdf).toHaveBeenCalledTimes(1));
    const input = (downloadLabelsPdf as jest.Mock).mock.calls[0][0];
    expect(input.format).toEqual(formats[0]);
    expect(input.lines.map((l: LabelLine) => [l.variantId, l.quantity])).toEqual([
      ["v1", 1],
      ["v2", 4],
    ]);
    expect(input).toMatchObject({ storeName: "Tienda Centro", companyName: "LIVII", logoDataUrl: null });
    expect(toast.success).toHaveBeenCalledWith("PDF con 3 etiquetas listo");
  });

  it("by warehouse stock: asks for the warehouse, then brings what is available", async () => {
    (fetchLabelLines as jest.Mock).mockResolvedValue([line("v1", "POLO-M-NEG", 7), line("v2", "POLO-L-NEG", 0)]);
    renderDialog();
    await screen.findByLabelText("Etiquetas de POLO-M-NEG");
    fireEvent.click(screen.getByRole("radio", { name: /Según el stock disponible del almacén/ }));
    expect(screen.getByText("Elige el almacén para traer su stock.")).toBeInTheDocument();
    expect(downloadButton()).toBeDisabled();

    fireEvent.change(screen.getByRole("combobox", { name: "Almacén" }), { target: { value: "w2" } });
    await waitFor(() =>
      expect(fetchLabelLines).toHaveBeenLastCalledWith({ origin: "stock", inventoryId: "w2", ids: ["p1"] }, expect.anything()),
    );
    expect(await screen.findByLabelText("Etiquetas de POLO-L-NEG")).toHaveValue(0);
    expect(screen.getByLabelText("Etiquetas de POLO-M-NEG")).toHaveValue(7);
    expect(downloadButton()).toHaveTextContent("Descargar PDF · 7 etiquetas");
    expect(downloadButton()).toBeEnabled();
  });

  it("blocks more than 2000 labels and zero labels", async () => {
    renderDialog();
    await screen.findByLabelText("Etiquetas de POLO-M-NEG");
    fireEvent.change(screen.getByLabelText("Etiquetas de POLO-M-NEG"), { target: { value: "2000" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Son 2001 etiquetas y el máximo por impresión es 2000. Baja las cantidades.");
    expect(downloadButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Etiquetas de POLO-M-NEG"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Etiquetas de POLO-L-NEG"), { target: { value: "" } });
    expect(screen.getByRole("alert")).toHaveTextContent("No hay etiquetas para imprimir.");
    expect(downloadButton()).toBeDisabled();
    expect(downloadLabelsPdf).not.toHaveBeenCalled();
  });

  it("another format: its preview and, when it carries the store, the store to print", async () => {
    renderDialog();
    await screen.findByLabelText("Etiquetas de POLO-M-NEG");
    expect(screen.queryByLabelText("Tienda")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Formato"), { target: { value: "f3" } });
    expect(screen.getByText("Hoja A4")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Vista previa de la etiqueta de 100×50 mm" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tienda"), { target: { value: "s2" } });
    expect(within(screen.getByTestId("label-preview")).getByText(/Tienda Norte/)).toBeInTheDocument();

    fireEvent.click(downloadButton());
    await waitFor(() => expect(downloadLabelsPdf).toHaveBeenCalledTimes(1));
    expect((downloadLabelsPdf as jest.Mock).mock.calls[0][0]).toMatchObject({ format: formats[1], storeName: "Tienda Norte" });
  });

  it("from the catalog: filters by the company's own category (H4) and brand", async () => {
    renderDialog({ kind: "catalog" });
    await screen.findByLabelText("Etiquetas de POLO-M-NEG");
    expect(fetchLabelLines).toHaveBeenCalledWith({ origin: "products" }, expect.anything());
    expect(screen.getByRole("heading", { name: "Imprimir etiquetas · Catálogo" })).toBeInTheDocument();
    await screen.findByRole("option", { name: "Ropa" });
    expect(axiosAuth.get).toHaveBeenCalledWith(expect.stringMatching(/\/catalog-categories$/), expect.anything());
    expect(screen.getByRole("option", { name: "Polos" })).toHaveAttribute("title", "Ropa › Polos");
    expect(screen.queryByRole("option", { name: "Vieja" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "c2" } });
    fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "b1" } });
    await waitFor(() =>
      expect(fetchLabelLines).toHaveBeenLastCalledWith({ origin: "products", categoryId: "c2", brandId: "b1" }, expect.anything()),
    );
  });

  it("from a received purchase order: what came in that reception, without the quantity mode (H3)", async () => {
    (fetchLabelLines as jest.Mock).mockResolvedValue([line("v1", "POLO-M-NEG", 4), line("v2", "POLO-L-NEG", 2)]);
    renderDialog({ kind: "purchase_order", purchaseOrderId: "oc-1", receiptId: "rec-1", title: "OC-0001 · REC-0001" });
    expect(await screen.findByLabelText("Etiquetas de POLO-M-NEG")).toHaveValue(4);
    expect(fetchLabelLines).toHaveBeenCalledWith(
      { origin: "purchase_order", purchaseOrderId: "oc-1", receiptId: "rec-1" },
      expect.anything(),
    );
    expect(screen.getByRole("heading", { name: "Imprimir etiquetas · OC-0001 · REC-0001" })).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Categoría")).not.toBeInTheDocument();
    expect(axiosAuth.get).not.toHaveBeenCalled();
    expect(downloadButton()).toHaveTextContent("Descargar PDF · 6 etiquetas");
  });

  // Correcciones 11-20 (B2): buscador, quitar líneas y filtro por almacén. Lo de arriba sigue igual por defecto.
  const lineOf = (variantId: string, productId: string, sku: string, quantity: number): LabelLine => ({ ...line(variantId, sku, quantity), productId });
  const casaca = { id: "p2", name: "Casaca", sku: "CAS", companySku: null, status: true, purchaseUnit: null, purchaseFactor: 1 };

  it("busca por nombre y agrega el producto con sus variantes; se quitan líneas y se pueden volver a poner", async () => {
    jest.mocked(listPurchasableProducts).mockResolvedValue([casaca, { ...casaca, id: "p9", name: "Casaca vieja", status: false }]);
    (fetchLabelLines as jest.Mock).mockImplementation(async (request: { ids?: string[] }) =>
      request.ids?.[0] === "p2" ? [lineOf("v3", "p2", "CAS-M", 1), lineOf("v4", "p2", "CAS-L", 1)] : [line("v1", "POLO-M-NEG", 1), line("v2", "POLO-L-NEG", 1)],
    );
    renderDialog();
    await screen.findByLabelText("Etiquetas de POLO-M-NEG");
    fireEvent.change(screen.getByLabelText("Agregar a la lista"), { target: { value: "casa" } });
    expect(screen.queryByRole("button", { name: /Casaca vieja/ })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Agregar Casaca · CAS" }));
    await waitFor(() => expect(fetchLabelLines).toHaveBeenCalledWith({ origin: "products", ids: ["p2"] }, expect.anything()));
    expect(await screen.findByLabelText("Etiquetas de CAS-M")).toHaveValue(1);
    expect(downloadButton()).toHaveTextContent("Descargar PDF · 4 etiquetas");

    fireEvent.click(screen.getByRole("button", { name: "Quitar POLO-M-NEG" }));
    fireEvent.click(screen.getByRole("button", { name: "Quitar CAS-L" }));
    expect(screen.queryByLabelText("Etiquetas de POLO-M-NEG")).not.toBeInTheDocument();
    expect(downloadButton()).toHaveTextContent("Descargar PDF · 2 etiquetas");
    fireEvent.click(downloadButton());
    await waitFor(() => expect(downloadLabelsPdf).toHaveBeenCalledTimes(1));
    expect((downloadLabelsPdf as jest.Mock).mock.calls[0][0].lines.map((l: LabelLine) => l.variantId)).toEqual(["v2", "v3"]);

    fireEvent.click(screen.getByRole("button", { name: "Volver a poner las 2 quitadas" }));
    expect(downloadButton()).toHaveTextContent("Descargar PDF · 4 etiquetas");
  });

  it("con el lector: el código de barras agrega solo esa variante, y avisa si no existe", async () => {
    jest.mocked(listPurchasableProducts).mockResolvedValue([casaca]);
    jest.mocked(lookupVariantsByCodes).mockResolvedValueOnce([
      { code: "7750000000017", variantId: "v4", sku: "CAS-L", companySku: null, productId: "p2", productName: "Casaca", matchedBy: "barcode" },
    ]);
    (fetchLabelLines as jest.Mock).mockImplementation(async (request: { ids?: string[] }) =>
      request.ids?.[0] === "p2" ? [lineOf("v3", "p2", "CAS-M", 1), lineOf("v4", "p2", "CAS-L", 1)] : [line("v1", "POLO-M-NEG", 1)],
    );
    renderDialog();
    await screen.findByLabelText("Etiquetas de POLO-M-NEG");
    const search = screen.getByLabelText("Agregar a la lista");
    fireEvent.change(search, { target: { value: "7750000000017" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(await screen.findByLabelText("Etiquetas de CAS-L")).toHaveValue(1);
    expect(lookupVariantsByCodes).toHaveBeenCalledWith(["7750000000017"], "c-1");
    expect(screen.queryByLabelText("Etiquetas de CAS-M")).not.toBeInTheDocument();
    expect(search).toHaveValue("");

    jest.mocked(lookupVariantsByCodes).mockResolvedValueOnce([]);
    fireEvent.change(search, { target: { value: "XYZ-404" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(await screen.findByText("No encontramos «XYZ-404». Elige el producto en la lista.")).toBeInTheDocument();
  });

  it("filtro de almacén con «1 de cada una»: solo lo que hay en ese almacén, una etiqueta por variante", async () => {
    (fetchLabelLines as jest.Mock).mockImplementation(async (request: { origin: string }) =>
      request.origin === "stock" ? [line("v1", "POLO-M-NEG", 7), line("v2", "POLO-L-NEG", 0)] : [line("v1", "POLO-M-NEG", 1), line("v2", "POLO-L-NEG", 1)],
    );
    renderDialog();
    await screen.findByLabelText("Etiquetas de POLO-L-NEG");
    fireEvent.change(screen.getByRole("combobox", { name: "Almacén" }), { target: { value: "w1" } });
    await waitFor(() => expect(fetchLabelLines).toHaveBeenLastCalledWith({ origin: "stock", inventoryId: "w1", ids: ["p1"] }, expect.anything()));
    await waitFor(() => expect(screen.queryByLabelText("Etiquetas de POLO-L-NEG")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Etiquetas de POLO-M-NEG")).toHaveValue(1);

    // «Según el stock»: el mismo almacén pone la cantidad.
    fireEvent.click(screen.getByRole("radio", { name: /Según el stock disponible del almacén/ }));
    expect(await screen.findByLabelText("Etiquetas de POLO-L-NEG")).toHaveValue(0);
    expect(screen.getByLabelText("Etiquetas de POLO-M-NEG")).toHaveValue(7);
  });

  it("shows the backend message when the lines cannot be loaded", async () => {
    (fetchLabelLines as jest.Mock).mockRejectedValue(
      new AxiosError("Bad Request", "400", undefined, undefined, {
        status: 400,
        statusText: "Bad Request",
        data: { message: "Son más de 2000 variantes y el máximo por impresión es 2000 etiquetas. Acota la selección." },
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );
    renderDialog();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Son más de 2000 variantes y el máximo por impresión es 2000 etiquetas. Acota la selección.",
    );
    expect(downloadButton()).toBeDisabled();
  });
});
