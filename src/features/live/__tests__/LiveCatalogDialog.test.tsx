import { act, fireEvent, render, screen } from "@testing-library/react";
import LiveCatalogDialog from "../LiveCatalogDialog";
import { getLiveCatalog } from "../liveService";
import type { LiveProduct } from "../types";

jest.mock("../liveService", () => ({
  getLiveCatalog: jest.fn(),
  liveError: (error: Error) => error.message,
  liveMoney: (amount: number) => `S/ ${amount.toFixed(2)}`,
}));

const product = (
  variantId: string,
  name: string,
  sku: string,
  variantLabel: string,
): LiveProduct => ({
  variantId,
  name,
  sku,
  variantLabel,
  regularPrice: 25,
  livePrice: 20,
  availableStock: 4,
  maxPerCustomer: null,
  enabled: false,
});
const products = [
  product("a", "Polo algodón", "POL-001", "Rojo / M"),
  product("b", "Vestido", "VES-002", "Azul / S"),
];
const response = (rows = products) => ({ products: rows, serverNow: "2026-10-27T12:00:00Z" });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const props = { storeId: "store-a", onClose: jest.fn(), onSelect: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (getLiveCatalog as jest.Mock).mockResolvedValue(response());
});

test("loads immediately once and filters by name, SKU or variant without more requests", async () => {
  render(<LiveCatalogDialog {...props} />);
  expect(getLiveCatalog).toHaveBeenCalledTimes(1);
  await screen.findByText("Polo algodón");
  const search = screen.getByRole("textbox", { name: "Buscar producto para live" });
  for (const query of [" POLO ", "pol-001", "rojo"]) {
    fireEvent.change(search, { target: { value: query } });
    expect(screen.getByText("Polo algodón")).toBeInTheDocument();
    expect(screen.queryByText("Vestido")).not.toBeInTheDocument();
  }
  fireEvent.change(search, { target: { value: "sin coincidencias" } });
  expect(screen.getByText("No se encontraron variantes.")).toBeInTheDocument();
  fireEvent.change(search, { target: { value: "" } });
  expect(screen.getByText("Vestido")).toBeInTheDocument();
  expect(getLiveCatalog).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: /Polo algodón/ }));
  expect(props.onSelect).toHaveBeenCalledWith(products[0]);
});

test("applies the latest search typed while the initial catalog is loading", async () => {
  const pending = deferred<ReturnType<typeof response>>();
  (getLiveCatalog as jest.Mock).mockReturnValue(pending.promise);
  render(<LiveCatalogDialog {...props} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Buscar producto para live" }), {
    target: { value: "azul" },
  });
  expect(screen.getByRole("status")).toHaveTextContent("Cargando productos");
  await act(async () => pending.resolve(response()));
  expect(screen.getByText("Vestido")).toBeInTheDocument();
  expect(screen.queryByText("Polo algodón")).not.toBeInTheDocument();
  expect(getLiveCatalog).toHaveBeenCalledTimes(1);
});

test("aborts a previous store request and ignores its late response", async () => {
  const old = deferred<ReturnType<typeof response>>();
  (getLiveCatalog as jest.Mock)
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(response([product("c", "Tienda B", "B-001", "Único")]));
  const view = render(<LiveCatalogDialog {...props} />);
  const oldSignal = (getLiveCatalog as jest.Mock).mock.calls[0][2] as AbortSignal;
  view.rerender(<LiveCatalogDialog {...props} storeId="store-b" />);
  expect(oldSignal.aborted).toBe(true);
  await screen.findByText("Tienda B");
  await act(async () => old.resolve(response()));
  expect(screen.getByText("Tienda B")).toBeInTheDocument();
  expect(screen.queryByText("Polo algodón")).not.toBeInTheDocument();
  expect(getLiveCatalog).toHaveBeenCalledTimes(2);
});

test("closing aborts the request and reopening fetches fresh stock", async () => {
  const old = deferred<ReturnType<typeof response>>();
  (getLiveCatalog as jest.Mock)
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(response([{ ...products[0], availableStock: 2 }]));
  const view = render(<LiveCatalogDialog {...props} />);
  const signal = (getLiveCatalog as jest.Mock).mock.calls[0][2] as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  render(<LiveCatalogDialog {...props} />);
  await screen.findByText(/2 disp\./);
  await act(async () => old.resolve(response()));
  expect(screen.getByText(/2 disp\./)).toBeInTheDocument();
  expect(screen.queryByText(/4 disp\./)).not.toBeInTheDocument();
  expect(getLiveCatalog).toHaveBeenCalledTimes(2);
});

test("retries a failed load from the error banner without changing the search", async () => {
  (getLiveCatalog as jest.Mock)
    .mockRejectedValueOnce(new Error("No se pudo consultar el catálogo."))
    .mockResolvedValueOnce(response());
  render(<LiveCatalogDialog {...props} />);
  await screen.findByRole("alert");
  fireEvent.change(screen.getByRole("textbox", { name: "Buscar producto para live" }), {
    target: { value: "vestido" },
  });
  expect(getLiveCatalog).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByText("Vestido");
  expect(screen.queryByText("Polo algodón")).not.toBeInTheDocument();
  expect(getLiveCatalog).toHaveBeenCalledTimes(2);
});
