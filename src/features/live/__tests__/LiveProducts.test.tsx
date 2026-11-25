import { AxiosError, AxiosHeaders } from "axios";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import LiveAddProductsDialog from "../LiveAddProductsDialog";
import LiveProductsTable from "../LiveProductsTable";
import { getLiveCatalog, updateLiveProducts } from "../liveService";
import type { LiveProduct } from "../types";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getLiveCatalog: jest.fn(),
  updateLiveProducts: jest.fn(),
}));
beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
beforeEach(() => jest.clearAllMocks());

const variant = (
  variantId: string,
  Color: string,
  Talla: string,
  availableStock: number,
  extra: Partial<LiveProduct> = {},
): LiveProduct => ({
  variantId,
  productId: "short",
  name: "Short Sastre Luisa",
  sku: `SSL-${Color}-${Talla}`,
  attributes: { Color, Talla },
  variantLabel: `${Color} / ${Talla}`,
  regularPrice: 149,
  livePrice: 149,
  availableStock,
  maxPerCustomer: null,
  enabled: false,
  ...extra,
});
const catalog = [
  variant("g-s", "Gris", "S", 4),
  variant("g-m", "Gris", "M", 6),
  variant("b-s", "Beige", "S", 0),
  variant("b-m", "Beige", "M", 5),
  variant("p", "Único", "Única", 2, {
    productId: "polo",
    name: "Polo Kunca",
    sku: "POLO",
  }),
];
const open = async () => {
  (getLiveCatalog as jest.Mock).mockResolvedValue({
    products: catalog,
    inventory: { id: "inv", name: "Almacén Miraflores" },
  });
  const onAdded = jest.fn();
  render(
    <LiveAddProductsDialog
      storeId="store"
      onClose={jest.fn()}
      onAdded={onAdded}
      onEdit={jest.fn()}
    />,
  );
  await screen.findByText(/Almacén Miraflores/);
  return onAdded;
};

describe("Agregar al live agrupado por producto (FEAT-33 B2/A10)", () => {
  test("one card per product with colors, sizes, price and total stock", async () => {
    await open();
    const card = screen.getByRole("button", { name: /Short Sastre Luisa/ });
    expect(card).toHaveTextContent(
      "2 colores · 2 tallas · S/ 149.00 · 15 disp.",
    );
    expect(
      screen.getByRole("button", { name: /Polo Kunca/ }),
    ).toBeInTheDocument();
  });

  test("search filters by name or SKU", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Buscar producto"), {
      target: { value: "polo" },
    });
    expect(
      screen.queryByRole("button", { name: /Short Sastre Luisa/ }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar producto"), {
      target: { value: "ssl-beige" },
    });
    expect(
      screen.getByRole("button", { name: /Short Sastre Luisa/ }),
    ).toBeInTheDocument();
  });

  test("Color × Talla matrix: zero stock is off; one price and one max for all the chosen variants", async () => {
    const onAdded = await open();
    (updateLiveProducts as jest.Mock).mockResolvedValue({ products: [] });
    fireEvent.click(screen.getByRole("button", { name: /Short Sastre Luisa/ }));
    expect(
      screen.getByRole("button", { name: "Beige talla S, 0 disponibles" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Todas con stock" }));
    expect(
      screen.getByRole("button", { name: "Agregar al live (3 variantes)" }),
    ).toBeEnabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Gris talla M, 6 disponibles" }),
    );
    fireEvent.change(screen.getByLabelText("Precio live"), {
      target: { value: "119.90" },
    });
    fireEvent.change(screen.getByLabelText("Máx. por cliente"), {
      target: { value: "2" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar al live (2 variantes)" }),
    );
    await waitFor(() =>
      expect(updateLiveProducts).toHaveBeenCalledWith("store", {
        variantIds: ["g-s", "b-m"],
        livePrice: 119.9,
        maxPerCustomer: 2,
        enabled: true,
      }),
    );
    expect(onAdded).toHaveBeenCalledTimes(1);
  });

  test("Ninguna clears the selection", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Short Sastre Luisa/ }));
    fireEvent.click(screen.getByRole("button", { name: "Todas con stock" }));
    fireEvent.click(screen.getByRole("button", { name: "Ninguna" }));
    expect(
      screen.getByRole("button", { name: "Agregar al live (0 variantes)" }),
    ).toBeDisabled();
  });

  test("an invalid live price is not sent", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Short Sastre Luisa/ }));
    fireEvent.click(screen.getByRole("button", { name: "Todas con stock" }));
    fireEvent.change(screen.getByLabelText("Precio live"), {
      target: { value: "0" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar al live (3 variantes)" }),
    );
    expect(
      await screen.findByText("Escribe un precio live mayor a 0."),
    ).toBeInTheDocument();
    expect(updateLiveProducts).not.toHaveBeenCalled();
  });

  test("variants already in the live cannot be added twice; a fully added product moves to «Ya están en el live»", async () => {
    (getLiveCatalog as jest.Mock).mockResolvedValue({
      products: [
        variant("g-s", "Gris", "S", 4, { enabled: true }),
        variant("g-m", "Gris", "M", 6),
        variant("p", "Único", "Única", 2, {
          productId: "polo",
          name: "Polo Kunca",
          enabled: true,
        }),
      ],
      inventory: { id: "inv", name: "Local" },
    });
    const onEdit = jest.fn();
    render(
      <LiveAddProductsDialog
        storeId="store"
        onClose={jest.fn()}
        onAdded={jest.fn()}
        onEdit={onEdit}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Short Sastre Luisa/ }),
    );
    expect(
      screen.getByRole("button", { name: "Gris talla S, ya está en el live" }),
    ).toBeDisabled();
    const added = screen.getByRole("region", { name: "Ya están en el live" });
    fireEvent.click(
      within(added).getByRole("button", { name: "Editar Polo Kunca" }),
    );
    expect(onEdit).toHaveBeenCalledWith("polo");
  });

  test("without an active warehouse it explains it and offers Inventario", async () => {
    (getLiveCatalog as jest.Mock).mockRejectedValue(
      new AxiosError("409", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 409,
        statusText: "Conflict",
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {
          code: "LIVE_WAREHOUSE_REQUIRED",
          message:
            "La tienda no tiene un almacén activo. Créalo o actívalo en Inventario para ver su stock.",
        },
      }),
    );
    render(
      <LiveAddProductsDialog
        storeId="store"
        onClose={jest.fn()}
        onAdded={jest.fn()}
        onEdit={jest.fn()}
      />,
    );
    expect(
      await screen.findByText(/no tiene un almacén activo/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir a Inventario" }),
    ).toHaveAttribute("href", "/inventario");
  });

  test("a product with no stock at all points to Inventario instead of a matrix", async () => {
    (getLiveCatalog as jest.Mock).mockResolvedValue({
      products: [
        variant("x", "Oliva", "S", 0, {
          productId: "olivia",
          name: "Vestido Olivia",
        }),
      ],
      inventory: { id: "inv", name: "Local" },
    });
    render(
      <LiveAddProductsDialog
        storeId="store"
        onClose={jest.fn()}
        onAdded={jest.fn()}
        onEdit={jest.fn()}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Vestido Olivia/ }),
    );
    expect(
      screen.getByText(/no tiene stock en el almacén/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Revisar en Inventario" }),
    ).toHaveAttribute("href", "/inventario");
  });
});

describe("Productos del live agrupados (FEAT-33)", () => {
  const products = [
    variant("g-s", "Gris", "S", 4, {
      enabled: true,
      livePrice: 119,
      maxPerCustomer: 2,
    }),
    variant("g-m", "Gris", "M", 0, {
      enabled: true,
      livePrice: 119,
      maxPerCustomer: 2,
    }),
    variant("p", "Único", "Única", 2, {
      productId: "polo",
      name: "Polo Kunca",
      enabled: false,
    }),
  ];

  test("one row per product with its variants folded", () => {
    render(
      <LiveProductsTable
        products={products}
        hideSoldOut
        disabled={false}
        onEdit={jest.fn()}
        onPublish={jest.fn()}
      />,
    );
    const row = screen.getByRole("row", { name: /Short Sastre Luisa/ });
    expect(row).toHaveTextContent("2 variantes");
    expect(row).toHaveTextContent("S/ 149.00");
    expect(row).toHaveTextContent("S/ 119.00");
    expect(row).toHaveTextContent("2 unid.");
    expect(screen.queryByText("SSL-Gris-M")).not.toBeInTheDocument();
    fireEvent.click(
      within(row).getByRole("button", {
        name: "Ver variantes de Short Sastre Luisa",
      }),
    );
    expect(screen.getByText("SSL-Gris-M")).toBeInTheDocument();
    expect(screen.getByText("Oculta · sin stock")).toBeInTheDocument();
  });

  test("the product switch publishes or retires all its variants at once", () => {
    const onPublish = jest.fn();
    render(
      <LiveProductsTable
        products={products}
        hideSoldOut={false}
        disabled={false}
        onEdit={jest.fn()}
        onPublish={onPublish}
      />,
    );
    fireEvent.click(
      screen.getByRole("switch", { name: "Publicar Short Sastre Luisa" }),
    );
    expect(onPublish).toHaveBeenCalledWith(["g-s", "g-m"], false);
    fireEvent.click(
      screen.getByRole("switch", { name: "Publicar Polo Kunca" }),
    );
    expect(onPublish).toHaveBeenCalledWith(["p"], true);
  });

  test("Editar opens the whole product", () => {
    const onEdit = jest.fn();
    render(
      <LiveProductsTable
        products={products}
        hideSoldOut
        disabled={false}
        onEdit={onEdit}
        onPublish={jest.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Editar Short Sastre Luisa" }),
    );
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ key: "short", name: "Short Sastre Luisa" }),
    );
  });
});
