import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders, type AxiosAdapter } from "axios";
import { toast } from "sonner";
import axiosAuth from "@/lib/axiosAuth";
import { tokenStore } from "@/lib/tokenStore";
import DeleteInventoryItemModal from "../DeleteInventoryItemModal";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

const originalAdapter = axiosAuth.defaults.adapter;
const originalApiUrl = process.env.NEXT_PUBLIC_API_INVENTORY;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function successfulAdapter() {
  return jest.fn<ReturnType<AxiosAdapter>, Parameters<AxiosAdapter>>(
    async (config) => ({
      data: { id: "item-1", deleted: true },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    }),
  );
}

function renderModal(onSuccess = jest.fn(), inventoryItemId: string | null = "item-1") {
  const onClose = jest.fn();
  render(
    <DeleteInventoryItemModal
      open
      inventoryItemId={inventoryItemId}
      productName="Rosario de perlas"
      sku="S/SKU"
      onClose={onClose}
      onSuccess={onSuccess}
    />,
  );
  return { onClose, onSuccess };
}

async function confirmDeletion() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.type(screen.getByLabelText("Escribe ELIMINAR para confirmar"), "eliminar");
  await user.click(screen.getByRole("button", { name: "Eliminar Definitivamente" }));
  return user;
}

beforeEach(() => {
  jest.clearAllMocks();
  tokenStore.set("inventory-session-token");
  process.env.NEXT_PUBLIC_API_INVENTORY = "http://inventory";
});

afterEach(() => {
  axiosAuth.defaults.adapter = originalAdapter;
  tokenStore.set(null);
  if (originalApiUrl === undefined) {
    delete process.env.NEXT_PUBLIC_API_INVENTORY;
  } else {
    process.env.NEXT_PUBLIC_API_INVENTORY = originalApiUrl;
  }
  jest.restoreAllMocks();
});

it("envía la sesión y espera que el almacén se actualice antes de anunciar el éxito", async () => {
  const adapter = successfulAdapter();
  axiosAuth.defaults.adapter = adapter;
  const refresh = deferred<void>();
  const onSuccess = jest.fn(() => refresh.promise);
  const { onClose } = renderModal(onSuccess);

  await confirmDeletion();

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  expect(adapter).toHaveBeenCalledTimes(1);
  const config = adapter.mock.calls[0][0];
  expect(config.method).toBe("delete");
  expect(config.url).toBe("http://inventory/inventory-item/item-1");
  expect(config.headers.get("Authorization")).toBe("Bearer inventory-session-token");
  expect(toast.success).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();

  await act(async () => refresh.resolve());

  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(toast.success).toHaveBeenCalledWith("Producto eliminado del almacén");
  expect(toast.error).not.toHaveBeenCalled();
});

it.each([
  ["No se puede eliminar un producto con stock reservado", "No se puede eliminar un producto con stock reservado"],
  [["El producto tiene reservas", "Libera las reservas primero"], "El producto tiene reservas. Libera las reservas primero"],
  [undefined, "No se pudo eliminar el producto"],
])("muestra el motivo del servidor y conserva la confirmación para reintentar (%s)", async (message, expectedMessage) => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  const adapter = jest.fn<ReturnType<AxiosAdapter>, Parameters<AxiosAdapter>>(
    async (config) => {
      throw new AxiosError("Request failed", "ERR_BAD_REQUEST", config, undefined, {
        data: { message },
        status: 409,
        statusText: "Conflict",
        headers: new AxiosHeaders(),
        config,
      });
    },
  );
  axiosAuth.defaults.adapter = adapter;
  const { onClose, onSuccess } = renderModal();

  await confirmDeletion();

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expectedMessage));
  expect(toast.success).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Eliminar Definitivamente" })).toBeEnabled();
  expect(screen.getByLabelText("Escribe ELIMINAR para confirmar")).toHaveValue("ELIMINAR");
});

it("impide cerrar o repetir la eliminación mientras guarda y actualiza el almacén", async () => {
  const deletion = deferred<Awaited<ReturnType<AxiosAdapter>>>();
  const refresh = deferred<void>();
  const adapter = jest.fn<ReturnType<AxiosAdapter>, Parameters<AxiosAdapter>>(
    () => deletion.promise,
  );
  axiosAuth.defaults.adapter = adapter;
  const { onClose } = renderModal(jest.fn(() => refresh.promise));

  const user = await confirmDeletion();

  const assertCannotClose = async () => {
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Eliminando..." })).toBeDisabled();
    expect(screen.getByLabelText("Escribe ELIMINAR para confirmar")).toBeDisabled();
    await user.keyboard("{Escape}");
    const overlay = document.querySelector('[data-slot="dialog-overlay"]')!;
    fireEvent.pointerDown(overlay, { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(overlay);
    expect(onClose).not.toHaveBeenCalled();
  };
  await assertCannotClose();
  await user.click(screen.getByRole("button", { name: "Eliminando..." }));
  expect(adapter).toHaveBeenCalledTimes(1);

  await act(async () => deletion.resolve({
    data: { deleted: true },
    status: 200,
    statusText: "OK",
    headers: {},
    config: adapter.mock.calls[0][0],
  }));
  await assertCannotClose();
  await act(async () => refresh.resolve());
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
});

it("distingue un fallo al refrescar de una eliminación rechazada", async () => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  axiosAuth.defaults.adapter = successfulAdapter();
  const onSuccess = jest.fn(async () => {
    throw new Error("No se pudo cargar el almacén");
  });
  const { onClose } = renderModal(onSuccess);

  await confirmDeletion();

  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(toast.warning).toHaveBeenCalledWith(
    "Producto eliminado, pero no se pudo actualizar el almacén. Recarga la página.",
  );
  expect(toast.error).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
});

it("requiere la confirmación antes de enviar la eliminación", async () => {
  const adapter = successfulAdapter();
  axiosAuth.defaults.adapter = adapter;
  renderModal();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  const deleteButton = screen.getByRole("button", { name: "Eliminar Definitivamente" });

  expect(deleteButton).toBeDisabled();
  await user.type(screen.getByLabelText("Escribe ELIMINAR para confirmar"), "ELIMINA");
  expect(deleteButton).toBeDisabled();
  await user.click(deleteButton);
  expect(adapter).not.toHaveBeenCalled();
});
