import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import AdjustStockModal from "@/components/modals/AdjustStockModal";
import { adjustStock } from "@/services/stockAdjustmentService";
import { getInventoryRules } from "@/services/warehousesService";
import type { InventoryItemForSale } from "@/interfaces/IProduct";

jest.mock("@/services/stockAdjustmentService", () => ({
  ...jest.requireActual("@/services/stockAdjustmentService"),
  adjustStock: jest.fn(),
}));
jest.mock("@/services/warehousesService", () => ({ getInventoryRules: jest.fn() }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", company: { id: "c-1" }, user: { id: "u-1", role: "ADMINISTRADOR" } } }),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));

const rules = (stockControl: "flexible" | "estricto") =>
  ({ releaseAfterDays: null, pickingRequired: false, igvAffected: true, allowPurchaseToCourier: false, stockControl }) as const;

const item = (overrides: Partial<InventoryItemForSale> = {}) =>
  ({
    inventoryItemId: "item-1",
    variantId: "v-1",
    productName: "Polo",
    sku: "ROPREM-AB12",
    price: 20,
    priceVta: 20,
    priceBase: 12,
    attributes: { Title: "Default Title" },
    physicalStock: 10,
    reservedStock: 0,
    availableStock: 10,
    ...overrides,
  }) as InventoryItemForSale;

function setup(overrides: Partial<InventoryItemForSale> = {}) {
  const onSuccess = jest.fn();
  const onClose = jest.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AdjustStockModal open item={item(overrides)} onClose={onClose} onSuccess={onSuccess} />
    </QueryClientProvider>,
  );
  return { onSuccess, onClose };
}

/** Espera a que se lean las reglas de inventario (el control de stock). */
const rulesLoaded = () => waitFor(() => expect(getInventoryRules).toHaveBeenCalled());

const choose = (direction: "Entrada" | "Salida" | "Fijar en", quantity: string, reason: string, note?: string) => {
  fireEvent.click(screen.getByRole("button", { name: direction }));
  fireEvent.change(screen.getByLabelText(direction === "Fijar en" ? "Cantidad real" : "Cantidad"), { target: { value: quantity } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: reason } });
  if (note !== undefined) fireEvent.change(screen.getByLabelText(/Nota/), { target: { value: note } });
};

describe("AdjustStockModal (FEAT-24 H0)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(adjustStock).mockResolvedValue({ inventoryItemId: "item-1", quantity: 13, reservedQuantity: 0, reservedWithoutStock: 0 });
    jest.mocked(getInventoryRules).mockResolvedValue(rules("estricto"));
  });

  it("entrada con motivo: muestra el resultado y llama al servicio", async () => {
    const { onSuccess } = setup();
    choose("Entrada", "3", "dano");
    expect(screen.getByText("El físico queda en 13")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    await waitFor(() => expect(adjustStock).toHaveBeenCalledWith({ inventoryItemId: "item-1", direction: "IN", quantity: 3, reason: "dano" }));
    expect(onSuccess).toHaveBeenCalled();
  });

  it("estricto: una salida que deja negativo no se puede confirmar", async () => {
    setup();
    await rulesLoaded();
    choose("Salida", "11", "robo");
    expect(
      screen.getByText("Tu empresa usa control de stock estricto: la salida no puede dejar el físico en negativo."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar ajuste" })).toBeDisabled();
  });

  it("si no se pueden leer las reglas, no bloquea ni pide por adelantado: decide el servidor", async () => {
    jest.mocked(getInventoryRules).mockRejectedValue(new Error("503"));
    jest.mocked(adjustStock).mockRejectedValueOnce({
      response: { status: 409, data: { statusCode: 409, code: "STOCK_NEGATIVO_CONFIRMAR", message: "La salida deja el físico en −1." } },
    });
    setup();
    await rulesLoaded();
    choose("Salida", "11", "robo");
    expect(screen.queryByText(/control de stock estricto/)).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    await waitFor(() => expect(adjustStock).toHaveBeenCalledWith({ inventoryItemId: "item-1", direction: "OUT", quantity: 11, reason: "robo" }));
    // Empresa flexible: el 409 con code trae la casilla.
    expect(await screen.findByText("La salida deja el físico en −1.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("flexible: una salida que deja negativo pide la casilla y manda allowNegative (FEAT-24 C-D3)", async () => {
    jest.mocked(getInventoryRules).mockResolvedValue(rules("flexible"));
    const { onSuccess } = setup({ physicalStock: 10, reservedStock: 2 });
    await rulesLoaded();
    choose("Salida", "13", "error_registro");
    const box = await screen.findByRole("checkbox", { name: "Confirmo que el físico quedará en −3" });
    expect(screen.getByText("El físico queda en −3")).toBeInTheDocument();
    expect(screen.queryByText(/control de stock estricto/)).not.toBeInTheDocument();
    // Las reservas siguen avisando: las 2 quedan sin stock.
    expect(screen.getByText("2 unidades reservadas quedan sin stock")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar ajuste" })).toBeDisabled();
    fireEvent.click(box);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    await waitFor(() =>
      expect(adjustStock).toHaveBeenCalledWith({
        inventoryItemId: "item-1",
        direction: "OUT",
        quantity: 13,
        reason: "error_registro",
        allowNegative: true,
      }),
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it("flexible: cambiar la cantidad vuelve a pedir la casilla", async () => {
    jest.mocked(getInventoryRules).mockResolvedValue(rules("flexible"));
    setup();
    await rulesLoaded();
    choose("Salida", "12", "dano");
    fireEvent.click(await screen.findByRole("checkbox", { name: "Confirmo que el físico quedará en −2" }));
    expect(screen.getByRole("button", { name: "Confirmar ajuste" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "15" } });
    expect(screen.getByRole("checkbox", { name: "Confirmo que el físico quedará en −5" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Confirmar ajuste" })).toBeDisabled();
  });

  it("flexible: una salida que no deja negativo no manda allowNegative", async () => {
    jest.mocked(getInventoryRules).mockResolvedValue(rules("flexible"));
    setup();
    await rulesLoaded();
    choose("Salida", "4", "dano");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    await waitFor(() => expect(adjustStock).toHaveBeenCalledWith({ inventoryItemId: "item-1", direction: "OUT", quantity: 4, reason: "dano" }));
  });

  it("si el servidor pide confirmar (409 STOCK_NEGATIVO_CONFIRMAR), muestra su mensaje y la casilla, y reintenta con allowNegative", async () => {
    jest.mocked(adjustStock).mockRejectedValueOnce({
      response: { status: 409, data: { statusCode: 409, code: "STOCK_NEGATIVO_CONFIRMAR", message: "La salida deja el físico en −1: confirma para seguir." } },
    });
    setup();
    await rulesLoaded();
    choose("Salida", "10", "dano");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    expect(await screen.findByText("La salida deja el físico en −1: confirma para seguir.")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirmar ajuste" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Confirmo que el físico quedará en negativo" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    await waitFor(() => expect(adjustStock).toHaveBeenCalledTimes(2));
    expect(jest.mocked(adjustStock).mock.calls[0][0]).not.toHaveProperty("allowNegative");
    expect(jest.mocked(adjustStock).mock.calls[1][0]).toEqual(expect.objectContaining({ direction: "OUT", quantity: 10, allowNegative: true }));
  });

  it("«Fijar en» calcula la entrada o la salida y manda direction/quantity (FEAT-24 C-D6)", async () => {
    setup({ physicalStock: 10, reservedStock: 0 });
    await rulesLoaded();
    choose("Fijar en", "7", "error_registro");
    expect(screen.getByText("Salida de 3")).toBeInTheDocument();
    expect(screen.getByText("El físico queda en 7")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Cantidad real"), { target: { value: "25" } });
    expect(screen.getByText("Entrada de 15")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    await waitFor(() =>
      expect(adjustStock).toHaveBeenCalledWith({ inventoryItemId: "item-1", direction: "IN", quantity: 15, reason: "error_registro" }),
    );
  });

  it("«Fijar en» desde un físico negativo registra la entrada que lo lleva a lo contado", async () => {
    setup({ physicalStock: -215, reservedStock: 173 });
    await rulesLoaded();
    choose("Fijar en", "25", "error_registro");
    expect(screen.getByText("Entrada de 240")).toBeInTheDocument();
    expect(screen.getByText("148 unidades reservadas quedan sin stock")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    await waitFor(() => expect(adjustStock).toHaveBeenCalledWith(expect.objectContaining({ direction: "IN", quantity: 240 })));
  });

  it("«Fijar en» con la misma cantidad o fuera de 0..10.000 no deja confirmar", async () => {
    setup({ physicalStock: 10 });
    await rulesLoaded();
    choose("Fijar en", "10", "dano");
    expect(screen.getByText("El físico ya está en 10: no hay nada que ajustar.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar ajuste" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Cantidad real"), { target: { value: "10001" } });
    expect(screen.getByText("La cantidad máxima por variante y almacén es 10,000 unidades.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar ajuste" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Cantidad real"), { target: { value: "-1" } });
    expect(screen.getByText("Escribe un número entero de 0 a 10,000.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar ajuste" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Cantidad real"), { target: { value: "0" } });
    expect(screen.getByText("Salida de 10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar ajuste" })).toBeEnabled();
  });

  it("«Fijar en» con más de 10.000 de diferencia (desde un físico negativo) no deja confirmar", async () => {
    setup({ physicalStock: -200 });
    await rulesLoaded();
    choose("Fijar en", "9900", "error_registro");
    expect(screen.getByText("La cantidad máxima por variante y almacén es 10,000 unidades.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar ajuste" })).toBeDisabled();
  });

  it("«Fijar en»: si el servidor pide confirmar un negativo, el físico de la pantalla estaba viejo: no ofrece confirmar, avisa, refresca y cierra", async () => {
    jest.mocked(getInventoryRules).mockResolvedValue(rules("flexible"));
    jest.mocked(adjustStock).mockRejectedValueOnce({
      response: { status: 409, data: { statusCode: 409, code: "STOCK_NEGATIVO_CONFIRMAR", message: "La salida deja el físico en −5." } },
    });
    const { onSuccess, onClose } = setup({ physicalStock: 10 });
    await rulesLoaded();
    choose("Fijar en", "3", "error_registro");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("El físico cambió desde que abriste esta ventana")));
    expect(adjustStock).toHaveBeenCalledTimes(1);
    expect(jest.mocked(adjustStock).mock.calls[0][0]).not.toHaveProperty("allowNegative");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("«Fijar en»: si el resultado no es lo fijado (alguien movió el físico), avisa en vez de dar por bueno", async () => {
    jest.mocked(adjustStock).mockResolvedValueOnce({ inventoryItemId: "item-1", quantity: 4, reservedQuantity: 0, reservedWithoutStock: 0 });
    setup({ physicalStock: 10 });
    await rulesLoaded();
    choose("Fijar en", "6", "error_registro");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("quedó en 4, no en 6")));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("mientras se envía, el tipo de ajuste y la cantidad quedan deshabilitados", async () => {
    let resolve: (value: Awaited<ReturnType<typeof adjustStock>>) => void = () => {};
    jest.mocked(adjustStock).mockReturnValueOnce(new Promise((done) => (resolve = done)));
    setup();
    await rulesLoaded();
    choose("Entrada", "3", "dano");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salida" })).toBeDisabled());
    expect(screen.getByLabelText("Cantidad")).toBeDisabled();
    resolve({ inventoryItemId: "item-1", quantity: 13, reservedQuantity: 0, reservedWithoutStock: 0 });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("«Fijar en» con más de 1.000 unidades de diferencia pide confirmar la cantidad", async () => {
    setup({ physicalStock: 0 });
    await rulesLoaded();
    choose("Fijar en", "1500", "error_registro");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    expect(screen.getByText("Estás cargando 1,500 unidades. ¿Confirmas la cantidad?")).toBeInTheDocument();
    expect(adjustStock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sí, confirmar" }));
    await waitFor(() => expect(adjustStock).toHaveBeenCalledWith(expect.objectContaining({ direction: "IN", quantity: 1500 })));
  });

  it("una salida bajo lo reservado avisa y deja confirmar", async () => {
    setup({ physicalStock: 5, reservedStock: 3, availableStock: 2 });
    choose("Salida", "4", "dano");
    expect(screen.getByText("2 unidades reservadas quedan sin stock")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    await waitFor(() => expect(adjustStock).toHaveBeenCalled());
  });

  it("con Otro la nota es obligatoria", async () => {
    setup();
    choose("Salida", "1", "otro", "   ");
    expect(screen.getByRole("button", { name: "Confirmar ajuste" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Nota/), { target: { value: "caja 3 - rota" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    await waitFor(() => expect(adjustStock).toHaveBeenCalledWith(expect.objectContaining({ reason: "otro", note: "caja 3 - rota" })));
  });

  it("más de 1.000 unidades pide confirmar antes de llamar", async () => {
    setup();
    choose("Entrada", "1500", "error_registro");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    expect(screen.getByText("Estás cargando 1,500 unidades. ¿Confirmas la cantidad?")).toBeInTheDocument();
    expect(adjustStock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sí, confirmar" }));
    await waitFor(() => expect(adjustStock).toHaveBeenCalled());
  });

  it("una entrada que supera el máximo muestra el error", () => {
    setup({ physicalStock: 9995 });
    choose("Entrada", "6", "dano");
    expect(screen.getByText("La cantidad máxima por variante y almacén es 10,000 unidades.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar ajuste" })).toBeDisabled();
  });

  it("no muestra el precio base ni Default Title", () => {
    setup();
    expect(screen.queryByText(/Base/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Default Title/)).not.toBeInTheDocument();
  });

  it("muestra el error del backend", async () => {
    jest.mocked(adjustStock).mockRejectedValue({ response: { data: { message: "La salida deja el físico en negativo: hay 0 unidades." } } });
    setup();
    choose("Salida", "1", "dano");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La salida deja el físico en negativo: hay 0 unidades."));
  });
});
