import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import AdjustStockModal from "@/components/modals/AdjustStockModal";
import { adjustStock } from "@/services/stockAdjustmentService";
import type { InventoryItemForSale } from "@/interfaces/IProduct";

jest.mock("@/services/stockAdjustmentService", () => ({
  ...jest.requireActual("@/services/stockAdjustmentService"),
  adjustStock: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));

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
  render(<AdjustStockModal open item={item(overrides)} onClose={onClose} onSuccess={onSuccess} />);
  return { onSuccess, onClose };
}

const choose = (direction: "Entrada" | "Salida", quantity: string, reason: string, note?: string) => {
  fireEvent.click(screen.getByRole("button", { name: direction }));
  fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: quantity } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: reason } });
  if (note !== undefined) fireEvent.change(screen.getByLabelText(/Nota/), { target: { value: note } });
};

describe("AdjustStockModal (FEAT-24 H0)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(adjustStock).mockResolvedValue({ inventoryItemId: "item-1", quantity: 13, reservedQuantity: 0, reservedWithoutStock: 0 });
  });

  it("entrada con motivo: muestra el resultado y llama al servicio", async () => {
    const { onSuccess } = setup();
    choose("Entrada", "3", "dano");
    expect(screen.getByText("El físico queda en 13")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    await waitFor(() => expect(adjustStock).toHaveBeenCalledWith({ inventoryItemId: "item-1", direction: "IN", quantity: 3, reason: "dano" }));
    expect(onSuccess).toHaveBeenCalled();
  });

  it("una salida que deja negativo no se puede confirmar", () => {
    setup();
    choose("Salida", "11", "robo");
    expect(screen.getByText("La salida deja el físico en negativo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar ajuste" })).toBeDisabled();
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
