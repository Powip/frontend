/**
 * Tests: cargar el costo promedio por Excel (FEAT-24 H3-E, H3-D17).
 *
 * 1. Vista previa: fila buena (con su costo actual), SKU que no existe y costo inválido; solo se carga la buena.
 * 2. Confirmar manda PUT /variant-costs con un operationId; reintentar usa el mismo.
 * 3. Un archivo sin las columnas no muestra vista previa ni deja confirmar.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { readCostWorkbook } from "@/lib/costImport";
import { getVariantCosts, setVariantCosts } from "@/services/purchasesService";
import { lookupVariantsByCodes } from "@/services/variantCodesService";
import CostImportDialog from "../CostImportDialog";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/lib/costImport", () => ({ ...jest.requireActual("@/lib/costImport"), readCostWorkbook: jest.fn() }));
jest.mock("@/services/purchasesService", () => ({ getVariantCosts: jest.fn(), setVariantCosts: jest.fn() }));
jest.mock("@/services/variantCodesService", () => ({ lookupVariantsByCodes: jest.fn() }));

beforeAll(() => {
  if (!File.prototype.arrayBuffer) {
    Object.defineProperty(File.prototype, "arrayBuffer", { value: async () => new ArrayBuffer(8) });
  }
});

const onClose = jest.fn();
const onSaved = jest.fn();

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CostImportDialog companyId="c-1" onClose={onClose} onSaved={onSaved} />
    </QueryClientProvider>,
  );
}

const file = () => new File(["x"], "costos.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(readCostWorkbook).mockResolvedValue({
    error: null,
    rows: [
      { row: 2, code: "POLO-M", rawCost: "18,50" },
      { row: 3, code: "NO-EXISTE", rawCost: 10 },
      { row: 4, code: "GORRA", rawCost: "gratis" },
    ],
  });
  jest.mocked(lookupVariantsByCodes).mockResolvedValue([
    { code: "POLO-M", variantId: "v-1", sku: "POLO-M", companySku: "POLO-M", productId: "p-1", productName: "Polo" },
    { code: "GORRA", variantId: "v-2", sku: "GORRA", companySku: "GORRA", productId: "p-2", productName: "Gorra" },
  ]);
  jest.mocked(getVariantCosts).mockResolvedValue([
    { variantId: "v-1", averageCost: null },
    { variantId: "v-2", averageCost: 7 },
  ]);
});

describe("Excel de costos", () => {
  it("muestra la vista previa con el SKU que no existe y el costo inválido; solo carga la fila buena", async () => {
    const user = userEvent.setup();
    setup();
    await user.upload(screen.getByLabelText("Archivo de costos"), file());
    expect(await screen.findByRole("status")).toHaveTextContent("costos.xlsx: 1 fila se carga · 2 con errores (no se cargan)");
    expect(lookupVariantsByCodes).toHaveBeenCalledWith(["POLO-M", "NO-EXISTE", "GORRA"], "c-1");
    const good = screen.getByTestId("cost-row-2");
    expect(within(good).getByText("Polo")).toBeInTheDocument();
    expect(within(good).getByText("Se carga")).toBeInTheDocument();
    expect(within(good).getByText(/18\.50/)).toBeInTheDocument();
    expect(within(screen.getByTestId("cost-row-3")).getByText("El SKU no existe en tu catálogo.")).toBeInTheDocument();
    const invalid = screen.getByTestId("cost-row-4");
    expect(within(invalid).getByText("Costo inválido: un número de 0 en adelante.")).toBeInTheDocument();
    expect(within(invalid).getByText(/7\.00/)).toBeInTheDocument();
    expect(setVariantCosts).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cargar 1 costo" })).toBeEnabled();
  });

  it("confirma con PUT y un operationId; el reintento usa el mismo", async () => {
    const user = userEvent.setup();
    jest.mocked(setVariantCosts)
      .mockRejectedValueOnce({ response: { status: 409, data: { message: "Otra operación está moviendo ese costo: reintenta." } } })
      .mockResolvedValueOnce({ items: [{ variantId: "v-1", previous: null, averageCost: 18.5 }], duplicate: false });
    setup();
    await user.upload(screen.getByLabelText("Archivo de costos"), file());
    await user.click(await screen.findByRole("button", { name: "Cargar 1 costo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Otra operación está moviendo ese costo");
    await user.click(screen.getByRole("button", { name: "Cargar 1 costo" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Se cargó el costo de 1 variante"));
    const [first, second] = jest.mocked(setVariantCosts).mock.calls;
    expect(first[0]).toEqual({ items: [{ variantId: "v-1", averageCost: 18.5 }], reason: "Carga por Excel", operationId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(second[0].operationId).toBe(first[0].operationId);
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("un archivo sin las columnas avisa y no deja confirmar", async () => {
    const user = userEvent.setup();
    jest.mocked(readCostWorkbook).mockResolvedValue({ rows: [], error: "El archivo necesita las columnas «SKU de la empresa» y «Costo» en la primera fila." });
    setup();
    await user.upload(screen.getByLabelText("Archivo de costos"), file());
    expect(await screen.findByRole("alert")).toHaveTextContent("«SKU de la empresa» y «Costo»");
    expect(lookupVariantsByCodes).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cargar costos" })).toBeDisabled();
  });
});
