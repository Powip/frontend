/**
 * FEAT-32 M6a — motor de promociones en Registrar venta: cuerpo (con almacén), debounce y recálculo, precio solo
 * en las líneas elegibles, regalo, falla sin bloquear, espera al registrar y «Agregar pack».
 */
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSaleEngine } from "@/hooks/useSaleEngine";
import { evaluateSaleEngine, type SaleEngineResult } from "@/services/promotionsService";
import { listPacks } from "@/services/packsService";
import type { CartItem } from "@/interfaces/IOrder";

jest.mock("@/services/promotionsService", () => ({ evaluateSaleEngine: jest.fn() }));
jest.mock("@/services/packsService", () => ({ listPacks: jest.fn() }));

const line = (id: string, variantId: string, patch: Partial<CartItem> = {}): CartItem => ({
  id, inventoryItemId: `inv-${variantId}`, variantId, productName: `Producto ${variantId}`, sku: `SKU-${variantId}`,
  quantity: 1, price: 89, pvp: 89, discount: 0, packId: null, priceSource: "catalog", ...patch,
});

const EMPTY: SaleEngineResult = {
  lines: [], gift: null, giftOptions: [], suggestions: [],
  totals: { listSubtotal: 0, promoDiscount: 0, subtotal: 0 }, priceFallback: false,
};

/** Respuesta del motor: cada línea a `unit` por unidad con la promo `p1`. */
const engineAt = (unit: number) => async (body: Parameters<typeof evaluateSaleEngine>[0]): Promise<SaleEngineResult> => ({
  ...EMPTY,
  lines: body.items.map((item, index) => ({
    index, variantId: item.productVariantId, quantity: item.quantity, listPrice: 89, unitPrice: unit,
    lineTotal: unit * item.quantity, promoId: "p1", promoIds: ["p1"], labels: ["Cyber Wow"], isGift: false,
  })),
});

interface Props {
  cart: CartItem[];
  channel?: string;
  inventoryId?: string;
  enabled?: boolean;
}

function setup(initial: Props) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const hook = renderHook(
    (props: Props) => {
      const [cart, setCart] = useState(props.cart);
      const engine = useSaleEngine({
        cart,
        setCart: setCart as Dispatch<SetStateAction<CartItem[]>>,
        storeId: "store-1",
        channel: props.channel ?? "WHATSAPP",
        inventoryId: props.inventoryId ?? "warehouse-1",
        enabled: props.enabled ?? true,
      });
      return { engine, cart, setCart };
    },
    {
      initialProps: initial,
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    },
  );
  return hook;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(evaluateSaleEngine).mockImplementation(engineAt(71.2));
});

describe("useSaleEngine", () => {
  it("manda tienda, canal, almacén de salida y las líneas vendidas, con debounce", async () => {
    const { result } = setup({ cart: [] });
    act(() => result.current.setCart([line("a", "v1", { quantity: 2 }), line("g", "v9", { isGift: true, price: 0, pvp: 0 })]));
    expect(evaluateSaleEngine).not.toHaveBeenCalled();
    expect(result.current.engine.pending).toBe(true);
    await waitFor(() => expect(evaluateSaleEngine).toHaveBeenCalledTimes(1));
    expect(evaluateSaleEngine).toHaveBeenCalledWith(
      {
        storeId: "store-1",
        channel: "WHATSAPP",
        inventoryId: "warehouse-1",
        items: [{ productVariantId: "v1", quantity: 2, unitPrice: 89, discountAmount: 0 }],
      },
      expect.anything(),
    );
    await waitFor(() => expect(result.current.engine.pending).toBe(false));
  });

  it("recalcula al cambiar el canal, el almacén o las cantidades", async () => {
    const { result, rerender } = setup({ cart: [line("a", "v1")] });
    await waitFor(() => expect(evaluateSaleEngine).toHaveBeenCalledTimes(1));

    rerender({ cart: [line("a", "v1")], channel: "INSTAGRAM" });
    await waitFor(() => expect(evaluateSaleEngine).toHaveBeenCalledTimes(2));
    expect(jest.mocked(evaluateSaleEngine).mock.calls[1][0]).toMatchObject({ channel: "INSTAGRAM" });

    rerender({ cart: [line("a", "v1")], channel: "INSTAGRAM", inventoryId: "warehouse-2" });
    await waitFor(() => expect(evaluateSaleEngine).toHaveBeenCalledTimes(3));
    expect(jest.mocked(evaluateSaleEngine).mock.calls[2][0]).toMatchObject({ inventoryId: "warehouse-2" });

    act(() => result.current.setCart((cart) => cart.map((item) => ({ ...item, quantity: 3 }))));
    await waitFor(() => expect(evaluateSaleEngine).toHaveBeenCalledTimes(4));
    expect(jest.mocked(evaluateSaleEngine).mock.calls[3][0].items).toEqual([
      { productVariantId: "v1", quantity: 3, unitPrice: 89, discountAmount: 0 },
    ]);
  });

  it("pone el precio del motor solo en las líneas elegibles", async () => {
    const cart = [
      line("a", "v1"),
      line("b", "v2", { price: 50, discMode: "man", discValue: 50, priceSource: "manual" }),
      line("c", "v3", { price: 60, packId: "bundle-1" }),
    ];
    const { result } = setup({ cart });
    await waitFor(() => expect(result.current.engine.cart[0].lineTotal).toBe(71.2));
    expect(result.current.engine.cart[0]).toMatchObject({ pvp: 89, price: 71.2, listPrice: 89, promoId: "p1", promoLabels: ["Cyber Wow"] });
    expect(result.current.engine.cart[1]).toBe(result.current.cart[1]);
    expect(result.current.engine.cart[2]).toBe(result.current.cart[2]);
    // El carrito guardado no se pisa: sigue con su precio sugerido.
    expect(result.current.cart[0]).toMatchObject({ price: 89, pvp: 89 });
    expect(result.current.cart[0].lineTotal).toBeUndefined();
  });

  it("separa el regalo que se suma de los que no («no se suma», sin stock)", async () => {
    const gift = { promoId: "g1", name: "Regalo Short Luisa", variantId: "lui-s", quantity: 1, sku: "LUI-S-GRI", giftName: "Short Luisa", minAmount: 450 };
    jest.mocked(evaluateSaleEngine).mockImplementation(async (body) => ({
      ...(await engineAt(89)(body)),
      gift: { ...gift, status: "GIVEN" },
      giftOptions: [
        { ...gift, status: "GIVEN" },
        { ...gift, promoId: "g2", name: "Regalo Aclari", variantId: "acl", sku: "ACL0356", giftName: "Aclari", minAmount: 300, status: "NOT_SUMMED" },
        { ...gift, promoId: "g3", name: "Regalo Gorra", variantId: "gor", sku: "GOR", giftName: "Gorra", minAmount: 200, status: "NO_STOCK" },
      ],
    }));
    const { result } = setup({ cart: [line("a", "v1")] });
    await waitFor(() => expect(result.current.engine.gifts).toHaveLength(1));
    expect(result.current.engine.gifts[0]).toMatchObject({ sku: "LUI-S-GRI", giftName: "Short Luisa" });
    expect(result.current.engine.skippedGifts.map((item) => item.status)).toEqual(["NOT_SUMMED", "NO_STOCK"]);
  });

  it("si el motor falla, las líneas quedan con su precio sugerido y no hay sugerencias", async () => {
    jest.mocked(evaluateSaleEngine).mockRejectedValue(new Error("caído"));
    const { result } = setup({ cart: [line("a", "v1")] });
    await waitFor(() => expect(result.current.engine.failed).toBe(true));
    expect(result.current.engine.cart).toBe(result.current.cart);
    expect(result.current.engine.suggestions).toEqual([]);
    expect(result.current.engine.pending).toBe(false);
    await expect(result.current.engine.settle()).resolves.toEqual({ cart: result.current.cart, changed: false });
  });

  it("sin motor (edición o lead) no consulta y devuelve el mismo carrito", async () => {
    const { result } = setup({ cart: [line("a", "v1")], enabled: false });
    await act(() => new Promise((resolve) => setTimeout(resolve, 500)));
    expect(evaluateSaleEngine).not.toHaveBeenCalled();
    expect(result.current.engine.cart).toBe(result.current.cart);
    expect(result.current.engine.pending).toBe(false);
    await expect(result.current.engine.settle()).resolves.toEqual({ cart: result.current.cart, changed: false });
  });

  it("al registrar con el motor recalculando espera su precio y avisa si cambió el total", async () => {
    const { result } = setup({ cart: [line("a", "v1")] });
    await waitFor(() => expect(result.current.engine.cart[0].lineTotal).toBe(71.2));
    expect((await act(() => result.current.engine.settle())).changed).toBe(false);

    // Sube la cantidad y registra antes del debounce: el volumen baja el precio por unidad.
    jest.mocked(evaluateSaleEngine).mockImplementation(engineAt(70));
    act(() => result.current.setCart((cart) => cart.map((item) => ({ ...item, quantity: 3 }))));
    let settled: { cart: CartItem[]; changed: boolean } | undefined;
    await act(async () => {
      settled = await result.current.engine.settle();
    });
    expect(settled?.changed).toBe(true);
    expect(settled?.cart[0]).toMatchObject({ quantity: 3, lineTotal: 210, promoDiscountAmount: 57 });
    await waitFor(() => expect(result.current.engine.cart[0].lineTotal).toBe(210));
  });

  it("«Agregar pack» suma la línea del pack con el contenido de ms-products; sin SKU no hace nada", async () => {
    jest.mocked(listPacks).mockResolvedValue({
      data: [{ variantId: "pk1", imageUrl: null, components: [{ variantId: "jim-m", quantity: 1, productName: "Pantalón Jimena", sku: "JIM-M-CEL" }] }],
      meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
    } as unknown as Awaited<ReturnType<typeof listPacks>>);
    const suggestion = {
      kind: "PACK" as const, packVariantId: "pk1", name: "Pack Jimena", packPrice: 199, looseTotal: 238, sku: "PK1",
      components: [{ variantId: "jim-m", quantity: 1 }], text: "Pack Jimena a S/ 199.00 (suelto S/ 238.00).",
    };
    const { result } = setup({ cart: [line("a", "v1")] });
    await act(() => result.current.engine.addPack({ ...suggestion, sku: null }));
    expect(listPacks).not.toHaveBeenCalled();
    expect(result.current.cart).toHaveLength(1);

    await act(() => result.current.engine.addPack(suggestion));
    expect(listPacks).toHaveBeenCalledWith({ q: "PK1", active: true, limit: 12 });
    expect(result.current.cart[1]).toMatchObject({
      variantId: "pk1", sku: "PK1", price: 199, productName: "Pack Jimena",
      packComponents: [{ variantId: "jim-m", quantity: 1, productName: "Pantalón Jimena", sku: "JIM-M-CEL" }],
    });
  });
});
