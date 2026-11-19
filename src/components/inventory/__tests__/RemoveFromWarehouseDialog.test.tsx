/**
 * Tests: RemoveFromWarehouseDialog (FEAT-24 RMV — «Quitar del almacén»).
 *
 * 1. Paso 1: qué se quita, de qué almacén, que no se elimina, que el historial queda y que se puede volver a
 *    agregar. «Cancelar» cierra sin llamar al servidor.
 * 2. Paso 2: «Sí, quitar» llama con la variante (o el producto) y el almacén; avisa y refresca (`saved` true).
 * 3. Un 409 se muestra tal cual en el diálogo, que queda abierto, y la lista se refresca (`saved` false).
 * 4. Un 403 muestra el mensaje del servidor; «Volver» regresa al paso 1 y limpia el error.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/services/warehouseOpsService", () => ({ removeFromWarehouse: jest.fn() }));
jest.mock("@/lib/offlineStore", () => ({ isNetworkError: () => false }));

import { toast } from "sonner";
import { removeFromWarehouse } from "@/services/warehouseOpsService";
import { RemoveFromWarehouseDialog, type RemoveFromWarehouseItem } from "../RemoveFromWarehouseDialog";

const remove = jest.mocked(removeFromWarehouse);
const warehouse = { id: "inv-1", name: "Almacén Lima", storeName: "Tienda Centro" };
const variant: RemoveFromWarehouseItem = { kind: "variant", variantId: "v-1", name: "Polo · Talla: M", sku: "POLO-M" };
const product: RemoveFromWarehouseItem = { kind: "product", productId: "p-1", name: "Polo" };

function setup(item: RemoveFromWarehouseItem = variant) {
  const onClose = jest.fn();
  const onChanged = jest.fn();
  render(<RemoveFromWarehouseDialog item={item} warehouse={warehouse} onClose={onClose} onChanged={onChanged} />);
  return { onClose, onChanged, user: userEvent.setup() };
}

const conflict = (message: string, status = 409) => Object.assign(new Error("http"), { response: { status, data: { statusCode: status, code: "QUITAR_DEL_ALMACEN_BLOQUEADO", message } } });

describe("RemoveFromWarehouseDialog", () => {
  beforeEach(() => jest.clearAllMocks());

  it("el paso 1 explica qué se quita y de dónde; Cancelar no llama al servidor", async () => {
    const { onClose, user } = setup();
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Vas a quitar la variante Polo · Talla: M (SKU POLO-M) del almacén Almacén Lima (Tienda Centro).");
    expect(dialog).toHaveTextContent("No se elimina: sigue en el catálogo y en los demás almacenes.");
    expect(dialog).toHaveTextContent("Su historial de movimientos se conserva.");
    expect(dialog).toHaveTextContent("Puedes volver a agregarlo");
    expect(screen.queryByRole("button", { name: "Sí, quitar" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("la segunda confirmación quita la variante, avisa y refresca", async () => {
    remove.mockResolvedValue({ inventoryId: "inv-1", removed: [{ variantId: "v-1", inventoryItemId: "ii-1" }], alreadyRemoved: [], notInWarehouse: [] });
    const { onClose, onChanged, user } = setup();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("¿Seguro que quieres quitarlo?");
    expect(remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Sí, quitar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(remove).toHaveBeenCalledWith("inv-1", { variantId: "v-1" });
    expect(toast.success).toHaveBeenCalledWith("Se quitó Polo · Talla: M de Almacén Lima.");
    expect(onChanged).toHaveBeenCalledWith(true);
  });

  it("un producto avisa que es todo o nada y manda el productId", async () => {
    remove.mockResolvedValue({ inventoryId: "inv-1", removed: [{ variantId: "v-1", inventoryItemId: "ii-1" }, { variantId: "v-2", inventoryItemId: "ii-2" }], alreadyRemoved: [], notInWarehouse: [] });
    const { user } = setup(product);
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Vas a quitar el producto Polo del almacén");
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Si alguna no se puede quitar, no se quita ninguna.");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Sí, quitar" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("inv-1", { productId: "p-1" }));
    expect(toast.success).toHaveBeenCalledWith("Se quitó Polo de Almacén Lima (2 variantes).");
  });

  it("si ya estaba quitado, lo dice", async () => {
    remove.mockResolvedValue({ inventoryId: "inv-1", removed: [], alreadyRemoved: ["v-1"], notInWarehouse: [] });
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Sí, quitar" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Polo · Talla: M ya no estaba en Almacén Lima."));
  });

  it("un 409 se muestra tal cual, el diálogo queda abierto y la lista se refresca", async () => {
    const message = "No se puede quitar SKU POLO-M del almacén: tiene 3 u en físico; tiene 1 pedido con reserva.";
    remove.mockRejectedValue(conflict(message));
    const { onClose, onChanged, user } = setup();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Sí, quitar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(onClose).not.toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalledWith(false);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("un 403 muestra el mensaje del servidor sin refrescar; Volver limpia el error", async () => {
    remove.mockRejectedValue(conflict("Solo el Administrador u Operaciones pueden quitar productos de un almacén.", 403));
    const { onChanged, user } = setup();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Sí, quitar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Solo el Administrador u Operaciones pueden quitar productos de un almacén.");
    expect(onChanged).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Volver" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
  });
});
