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
  extra: Partial<LiveProduct> = {},
): LiveProduct => ({
  variantId,
  productId: `product-${variantId}`,
  name,
  sku,
  variantLabel,
  regularPrice: 25,
  livePrice: 20,
  availableStock: 4,
  maxPerCustomer: null,
  enabled: false,
  ...extra,
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
const props = {
  storeId: "store-a",
  storeName: "KUNCA",
  onClose: jest.fn(),
  onSave: jest.fn<
    Promise<boolean>,
    [LiveProduct, { livePrice: number; maxPerCustomer: number | null; enabled: boolean }]
  >(),
};
const search = () => screen.getByRole("textbox", { name: "Buscar producto para live" });
const price = () => screen.getByRole("spinbutton", { name: /Precio live/ });
const max = () => screen.getByRole("spinbutton", { name: /Máximo por cliente/ });
async function selectPolo() {
  fireEvent.click(await screen.findByRole("button", { name: /^Configurar Polo algodón, Rojo/ }));
}
beforeEach(() => {
  (getLiveCatalog as jest.Mock).mockReset().mockResolvedValue(response());
  props.onSave.mockReset().mockResolvedValue(true);
  props.onClose.mockReset();
});

test("loads immediately once and filters all accent-insensitive search tokens locally", async () => {
  render(<LiveCatalogDialog {...props} />);
  expect(getLiveCatalog).toHaveBeenCalledTimes(1);
  await screen.findByText("Polo algodón");
  expect(screen.getByText("2 modelos · 2 variantes")).toBeInTheDocument();
  for (const query of [" POLO ", "pol-001", "algodon rojo m", "POL-001 algodón"]) {
    fireEvent.change(search(), { target: { value: query } });
    expect(screen.getByText("Polo algodón")).toBeInTheDocument();
    expect(screen.queryByText("Vestido")).not.toBeInTheDocument();
  }
  fireEvent.change(search(), { target: { value: "polo azul" } });
  expect(screen.getByText("No se encontraron variantes.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
  expect(search()).toHaveValue("");
  expect(screen.getByText("Vestido")).toBeInTheDocument();
  expect(getLiveCatalog).toHaveBeenCalledTimes(1);
});

test("groups variants by product ID, keeping homonyms and missing IDs separate", async () => {
  (getLiveCatalog as jest.Mock).mockResolvedValue(
    response([
      product("a", "Camiseta Básica", "CAM-1", "Rojo", { productId: "one" }),
      product("b", "Camiseta Básica", "CAM-2", "Azul", { productId: "one", regularPrice: 30 }),
      product("c", "Camiseta Básica", "CAM-3", "Blanco", { productId: "two" }),
      product("d", "Sin identificador", "SIN-1", "Uno", { productId: undefined }),
      product("e", "Sin identificador", "SIN-2", "Dos", { productId: undefined }),
    ]),
  );
  render(<LiveCatalogDialog {...props} />);
  await screen.findByText("4 modelos · 5 variantes");
  expect(screen.getAllByText("Camiseta Básica")).toHaveLength(2);
  expect(screen.getAllByText("Sin identificador")).toHaveLength(2);
  const group = screen.getByRole("button", { name: "Ver variantes de Camiseta Básica (CAM-1)" });
  expect(group).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(group);
  expect(group).toHaveAttribute("aria-expanded", "true");
  expect(
    screen.getByRole("button", { name: /Configurar Camiseta Básica, Azul, SKU CAM-2/ }),
  ).toBeInTheDocument();
  expect(screen.getByText("2 variantes")).toBeInTheDocument();
  fireEvent.change(search(), { target: { value: "CAM-2" } });
  expect(screen.getByText("1 modelo · 1 variante")).toBeInTheDocument();
  expect(screen.getByText("1 de 2 variantes")).toBeInTheDocument();
});

test("applies search typed while the initial catalog is loading", async () => {
  const pending = deferred<ReturnType<typeof response>>();
  (getLiveCatalog as jest.Mock).mockReturnValue(pending.promise);
  render(<LiveCatalogDialog {...props} />);
  fireEvent.change(search(), { target: { value: "azul" } });
  expect(screen.getByRole("status")).toHaveTextContent("Cargando productos");
  await act(async () => pending.resolve(response()));
  expect(screen.getByText("Vestido")).toBeInTheDocument();
  expect(screen.queryByText("Polo algodón")).not.toBeInTheDocument();
  expect(getLiveCatalog).toHaveBeenCalledTimes(1);
});

test("aborts an old store request and ignores its late response", async () => {
  const old = deferred<ReturnType<typeof response>>();
  (getLiveCatalog as jest.Mock)
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(response([product("c", "Tienda B", "B-1", "Único")]));
  const view = render(<LiveCatalogDialog {...props} />);
  const signal = (getLiveCatalog as jest.Mock).mock.calls[0][2] as AbortSignal;
  view.rerender(<LiveCatalogDialog {...props} storeId="store-b" />);
  expect(signal.aborted).toBe(true);
  await screen.findByText("Tienda B");
  await act(async () => old.resolve(response()));
  expect(screen.getByText("Tienda B")).toBeInTheDocument();
  expect(screen.queryByText("Polo algodón")).not.toBeInTheDocument();
});

test("unmount aborts and reopening fetches fresh stock", async () => {
  const old = deferred<ReturnType<typeof response>>();
  (getLiveCatalog as jest.Mock)
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(response([{ ...products[0], availableStock: 2 }]));
  const view = render(<LiveCatalogDialog {...props} />);
  const signal = (getLiveCatalog as jest.Mock).mock.calls[0][2] as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  render(<LiveCatalogDialog {...props} />);
  await screen.findByText("2 u. disponibles");
  await act(async () => old.resolve(response()));
  expect(screen.getByText("2 u. disponibles")).toBeInTheDocument();
  expect(screen.queryByText("4 u. disponibles")).not.toBeInTheDocument();
  expect(getLiveCatalog).toHaveBeenCalledTimes(2);
});

test("retries an error without changing the search", async () => {
  (getLiveCatalog as jest.Mock)
    .mockRejectedValueOnce(new Error("Catálogo no disponible"))
    .mockResolvedValueOnce(response());
  render(<LiveCatalogDialog {...props} />);
  await screen.findByRole("alert");
  fireEvent.change(search(), { target: { value: "vestido" } });
  expect(getLiveCatalog).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByText("Vestido");
  expect(screen.queryByText("Polo algodón")).not.toBeInTheDocument();
  expect(getLiveCatalog).toHaveBeenCalledTimes(2);
});

test("saves inline, retains search and open group, updates local state and stays open", async () => {
  const rows = [
    products[0],
    { ...products[0], variantId: "a2", sku: "POL-002", variantLabel: "Azul / L" },
  ];
  (getLiveCatalog as jest.Mock).mockResolvedValue(response(rows));
  render(<LiveCatalogDialog {...props} />);
  const group = await screen.findByRole("button", { name: /^Ver variantes de Polo algodón/ });
  fireEvent.change(search(), { target: { value: "algodon" } });
  fireEvent.click(group);
  await selectPolo();
  expect(screen.getByText("PVP de referencia")).toBeInTheDocument();
  expect(price()).toHaveFocus();
  fireEvent.change(price(), { target: { value: "18.50" } });
  fireEvent.change(max(), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Agregar al Live" }));
  await screen.findByText(/agregado al Live/);
  expect(props.onSave).toHaveBeenCalledWith(products[0], {
    livePrice: 18.5,
    maxPerCustomer: 2,
    enabled: true,
  });
  expect(screen.getByRole("dialog", { name: "Agregar productos al Live" })).toBeInTheDocument();
  expect(screen.queryByRole("spinbutton", { name: /Precio live/ })).not.toBeInTheDocument();
  expect(search()).toHaveValue("algodon");
  expect(search()).toHaveFocus();
  expect(group).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("En Live")).toBeInTheDocument();
  expect(props.onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Configurar Polo algodón, Rojo/ }));
  expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
  expect(price()).toHaveValue(18.5);
  expect(max()).toHaveValue(2);
  expect(getLiveCatalog).toHaveBeenCalledTimes(1);
});

test("failed save preserves drafts and offers another attempt", async () => {
  props.onSave.mockResolvedValueOnce(false);
  render(<LiveCatalogDialog {...props} />);
  await selectPolo();
  fireEvent.change(price(), { target: { value: "19.30" } });
  fireEvent.change(max(), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Agregar al Live" }));
  await screen.findByRole("alert");
  expect(price()).toHaveValue(19.3);
  expect(max()).toHaveValue(3);
  expect(screen.getByRole("button", { name: "Agregar al Live" })).toBeEnabled();
  expect(screen.queryByText(/agregado al Live/)).not.toBeInTheDocument();
  expect(props.onClose).not.toHaveBeenCalled();
});

test("back preserves search and group, while stock-zero variants remain configurable", async () => {
  (getLiveCatalog as jest.Mock).mockResolvedValue(
    response([{ ...products[0], availableStock: 0 }]),
  );
  render(<LiveCatalogDialog {...props} />);
  await screen.findByText("Polo algodón");
  fireEvent.change(search(), { target: { value: "algodon" } });
  await selectPolo();
  expect(screen.getByText(/Puedes configurar esta variante/)).toBeInTheDocument();
  expect(screen.getAllByText("Sin stock").length).toBeGreaterThan(0);
  expect(screen.queryByText(/bajo pedido/i)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Agregar al Live" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Volver a productos" }));
  expect(search()).toHaveValue("algodon");
  expect(search()).toHaveFocus();
  expect(screen.queryByRole("spinbutton", { name: /Precio live/ })).not.toBeInTheDocument();
  expect(getLiveCatalog).toHaveBeenCalledTimes(1);
});

test("configured IDs or server-enabled rows are labelled for editing", async () => {
  (getLiveCatalog as jest.Mock).mockResolvedValue(
    response([products[0], { ...products[1], enabled: true }]),
  );
  render(<LiveCatalogDialog {...props} configuredVariantIds={["a"]} />);
  await screen.findByText("Polo algodón");
  expect(screen.getAllByText("1 en Live")).toHaveLength(2);
  await selectPolo();
  expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
});

test.each(["", "0", "-1", "1.234", "10000000000", "1e3"])(
  "rejects invalid price %s before saving",
  async (value) => {
    render(<LiveCatalogDialog {...props} />);
    await selectPolo();
    fireEvent.change(price(), { target: { value } });
    expect(price()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Agregar al Live" })).toBeDisabled();
    expect(props.onSave).not.toHaveBeenCalled();
  },
);

test.each(["0", "-1", "1.5", "10001"])(
  "rejects invalid maximum %s before saving",
  async (value) => {
    render(<LiveCatalogDialog {...props} />);
    await selectPolo();
    fireEvent.change(max(), { target: { value } });
    expect(max()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Agregar al Live" })).toBeDisabled();
    expect(props.onSave).not.toHaveBeenCalled();
  },
);

test.each([
  ["0.01", "1"],
  ["9999999999.99", "10000"],
])("accepts valid price %s and maximum %s boundaries", async (priceValue, maxValue) => {
  render(<LiveCatalogDialog {...props} />);
  await selectPolo();
  fireEvent.change(price(), { target: { value: priceValue } });
  fireEvent.change(max(), { target: { value: maxValue } });
  fireEvent.click(screen.getByRole("button", { name: "Agregar al Live" }));
  await screen.findByText(/agregado al Live/);
  expect(props.onSave).toHaveBeenCalledWith(products[0], {
    livePrice: Number(priceValue),
    maxPerCustomer: Number(maxValue),
    enabled: true,
  });
});

test("prevents duplicate saves and blocks edits or closing while saving", async () => {
  const pending = deferred<boolean>();
  props.onSave.mockReturnValue(pending.promise);
  render(<LiveCatalogDialog {...props} />);
  await selectPolo();
  const form = screen.getByRole("button", { name: "Agregar al Live" }).closest("form");
  if (!form) throw new Error("Expected inline product form");
  act(() => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });
  expect(props.onSave).toHaveBeenCalledTimes(1);
  expect(price()).toBeDisabled();
  expect(search()).toBeDisabled();
  expect(screen.getByRole("button", { name: "Volver a productos" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cerrar selector de productos" })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(props.onClose).not.toHaveBeenCalled();
  await act(async () => pending.resolve(false));
  expect(price()).toBeEnabled();
});

test("external busy disables selecting a different variant", async () => {
  render(<LiveCatalogDialog {...props} busy />);
  expect(await screen.findByRole("button", { name: /^Configurar Polo algodón/ })).toBeDisabled();
  expect(search()).toBeDisabled();
  expect(props.onSave).not.toHaveBeenCalled();
});

test("a save from another store cannot overwrite or unlock the current save", async () => {
  const old = deferred<boolean>();
  const next = deferred<boolean>();
  props.onSave.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  (getLiveCatalog as jest.Mock)
    .mockResolvedValueOnce(response())
    .mockResolvedValueOnce(response([product("new", "Tienda B", "B-1", "Único")]));
  const view = render(<LiveCatalogDialog {...props} />);
  await selectPolo();
  fireEvent.click(screen.getByRole("button", { name: "Agregar al Live" }));
  view.rerender(<LiveCatalogDialog {...props} storeId="store-b" />);
  fireEvent.click(await screen.findByRole("button", { name: /^Configurar Tienda B/ }));
  fireEvent.change(price(), { target: { value: "39" } });
  fireEvent.click(screen.getByRole("button", { name: "Agregar al Live" }));
  await act(async () => old.resolve(true));
  expect(price()).toHaveValue(39);
  expect(price()).toBeDisabled();
  expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
  expect(screen.queryByText(/Polo algodón/)).not.toBeInTheDocument();
  await act(async () => next.resolve(true));
  expect(screen.getByText(/Tienda B.*agregado al Live/)).toBeInTheDocument();
});
