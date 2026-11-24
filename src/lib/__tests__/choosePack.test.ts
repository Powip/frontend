/** FEAT-32 M6b — pack «a elegir»: elección por unidad, identidad canónica de la línea y payload (spec §6.14, §7.17). */
import {
  addChosenPackLine,
  availableInWarehouse,
  canonicalCombination,
  changePackChoice,
  choiceIncomplete,
  choiceSlots,
  chooseLineIdentity,
  chosenPack,
  emptyPicks,
  lineChoiceVariantIds,
  linesWithIncompleteChoice,
  loadedPackChoice,
  offeredVariants,
  packChoicePayload,
  pickUnit,
  picksComplete,
  picksFromLine,
  picksToChoice,
} from "@/lib/packs/choosePack";
import { addPackLine } from "@/lib/packs/salePack";
import { buildOrderItem } from "@/app/registrar-venta/orderItemPricing";
import type { CartItem } from "@/interfaces/IOrder";
import type { PackView } from "@/services/packsService";

const PACK_VARIANT = "aaaaaaaa-0000-4000-8000-000000000001";
const KEY = `${PACK_VARIANT}:0123456789abcdef`;
const variant = (variantId: string, sku: string, attributeValues: Record<string, string>, active = true) => ({ variantId, sku, attributeValues, active, imageUrl: null });

const JEANS: PackView = {
  id: "p-jeans", variantId: PACK_VARIANT, name: "Pack jeans", description: null, sku: "PCK-0002", productSku: "PCK", powipEan: null,
  barcode: null, imageUrl: null, price: 259, active: true, categoryId: null, brandId: null, components: [], packType: "CHOOSE", approvalStatus: null,
  // Desordenados a propósito: se usan por `slot`.
  choiceComponents: [
    { slot: 1, productId: "p-polo", productName: "Polo Luisa", quantity: 1, variants: [variant("pol-u", "POL-U", { Talla: "U" })] },
    {
      slot: 0, productId: "p-jim", productName: "Jean Jimena", quantity: 2,
      variants: [
        variant("jim-s", "JIM-S", { Talla: "S", Color: "Celeste" }),
        variant("jim-m", "JIM-M", { Talla: "M", Color: "Celeste" }),
        variant("jim-x", "JIM-X", { Talla: "XL" }, false),
      ],
    },
  ],
  available: null,
};

const picksOf = (jeans: [string | null, string | null], polo: string | null) => ({ 0: [...jeans], 1: [polo] });
const chosen = (jeans: [string, string], polo = "pol-u") => chosenPack(JEANS, picksOf(jeans, polo))!;

describe("elección por unidad", () => {
  it("ordena los componentes por slot y arranca una posición vacía por unidad", () => {
    expect(choiceSlots(JEANS).map((component) => component.slot)).toEqual([0, 1]);
    expect(emptyPicks(JEANS)).toEqual({ 0: [null, null], 1: [null] });
  });

  it("los selectores arrancan iguales: la primera elección llena las demás unidades; después cada una cambia sola", () => {
    const first = pickUnit(emptyPicks(JEANS), 0, 0, "jim-m");
    expect(first[0]).toEqual(["jim-m", "jim-m"]);
    const second = pickUnit(first, 0, 1, "jim-s");
    expect(second[0]).toEqual(["jim-m", "jim-s"]);
    expect(pickUnit(second, 0, 0, null)[0]).toEqual([null, "jim-s"]);
  });

  it("está completa solo con todas las unidades elegidas", () => {
    expect(picksComplete(JEANS, picksOf(["jim-m", "jim-m"], null))).toBe(false);
    expect(chosenPack(JEANS, picksOf(["jim-m", null], "pol-u"))).toBeNull();
    expect(picksComplete(JEANS, picksOf(["jim-m", "jim-m"], "pol-u"))).toBe(true);
  });

  it("packChoice: una entrada por variante de cada componente con sus unidades", () => {
    expect(picksToChoice(JEANS, picksOf(["jim-m", "jim-m"], "pol-u"))).toEqual([
      { slot: 0, variantId: "jim-m", quantity: 2 },
      { slot: 1, variantId: "pol-u", quantity: 1 },
    ]);
    expect(picksToChoice(JEANS, picksOf(["jim-s", "jim-m"], "pol-u"))).toEqual([
      { slot: 0, variantId: "jim-s", quantity: 1 },
      { slot: 0, variantId: "jim-m", quantity: 1 },
      { slot: 1, variantId: "pol-u", quantity: 1 },
    ]);
  });

  it("lo elegido para la línea lleva producto con talla y color, y SKU", () => {
    expect(chosen(["jim-m", "jim-m"]).components).toEqual([
      { variantId: "jim-m", quantity: 2, sku: "JIM-M", productName: "Jean Jimena M / Celeste" },
      { variantId: "pol-u", quantity: 1, sku: "POL-U", productName: "Polo Luisa U" },
    ]);
  });
});

describe("identidad de la línea: pack + combinación canónica", () => {
  it("la combinación canónica no depende del orden ni de mayúsculas y suma repetidas", () => {
    expect(canonicalCombination([{ variantId: "B", quantity: 1 }, { variantId: "a", quantity: 1 }, { variantId: "b", quantity: 1 }])).toBe("a*1,b*2");
  });

  it("la misma combinación suma cantidad (aunque se elija en otro orden); otra combinación es otra línea", () => {
    const once = addChosenPackLine([], JEANS, chosen(["jim-s", "jim-m"]), () => "line-1");
    expect(once).toEqual([
      expect.objectContaining({
        id: "line-1", variantId: PACK_VARIANT, inventoryItemId: PACK_VARIANT, productName: "Pack jeans", sku: "PCK-0002", quantity: 1,
        price: 259, pvp: 259, packId: null, trackingMode: "NONE", packKey: null,
        packChoice: [{ slot: 0, variantId: "jim-s", quantity: 1 }, { slot: 0, variantId: "jim-m", quantity: 1 }, { slot: 1, variantId: "pol-u", quantity: 1 }],
        choosePack: { packProductId: "p-jeans", slots: [{ slot: 0, quantity: 2 }, { slot: 1, quantity: 1 }] },
      }),
    ]);
    const twice = addChosenPackLine(once, JEANS, chosen(["jim-m", "jim-s"]), () => "line-2");
    expect(twice).toEqual([expect.objectContaining({ id: "line-1", quantity: 2 })]);
    const other = addChosenPackLine(twice, JEANS, chosen(["jim-m", "jim-m"]), () => "line-3");
    expect(other.map((line) => [line.id, line.quantity])).toEqual([["line-1", 2], ["line-3", 1]]);
  });

  it("no se junta con una línea del mismo pack agregada como fijo, ni un fijo con un «a elegir»", () => {
    const fixed = { ...JEANS, packType: "FIXED" as const, components: [{ variantId: "jim-m", quantity: 2, productId: "p-jim", productName: "Jean", sku: "JIM-M", attributeValues: {}, imageUrl: null, active: true }] };
    const withChoose = addChosenPackLine([], JEANS, chosen(["jim-m", "jim-m"]), () => "choose");
    expect(addPackLine(withChoose, fixed, () => "fixed")).toHaveLength(2);
  });

  it("una línea cargada de un pedido se identifica por su contenido guardado", () => {
    const loaded = { variantId: PACK_VARIANT, packKey: KEY, choosePack: { packProductId: null, slots: [] }, packComponents: [{ variantId: "POL-U", quantity: 1 }, { variantId: "jim-m", quantity: 2 }] };
    expect(chooseLineIdentity(loaded)).toBe(`${PACK_VARIANT}|jim-m*2,pol-u*1`);
    expect(chooseLineIdentity({ variantId: "v", packComponents: [{ variantId: "x", quantity: 1 }] })).toBeNull();
  });
});

describe("payload del ítem", () => {
  const loadedLine = (packKey: string | null): CartItem => ({
    id: "loaded", inventoryItemId: PACK_VARIANT, variantId: PACK_VARIANT, productName: "Pack jeans", sku: "PCK-0002", quantity: 1,
    price: 259, pvp: 259, discount: 0, packId: null,
    packComponents: [{ variantId: "jim-m", quantity: 2, sku: "JIM-M", productName: "Jean Jimena" }, { variantId: "pol-u", quantity: 1, sku: "POL-U", productName: "Polo Luisa" }],
    ...loadedPackChoice({ packKey }),
  });

  it("línea nueva: packChoice (sin packKey), con la variante, el SKU y el precio del pack", () => {
    const [line] = addChosenPackLine([], JEANS, chosen(["jim-m", "jim-m"]), () => "line-1");
    const item = buildOrderItem(line);
    expect(item).toEqual(expect.objectContaining({
      productVariantId: PACK_VARIANT, sku: "PCK-0002", unitPrice: 259, quantity: 1,
      packChoice: [{ slot: 0, variantId: "jim-m", quantity: 2 }, { slot: 1, variantId: "pol-u", quantity: 1 }],
    }));
    expect(item).not.toHaveProperty("packKey");
  });

  it("línea cargada sin cambios: reenvía la packKey; las demás líneas no llevan ninguno", () => {
    const item = buildOrderItem(loadedLine(KEY));
    expect(item).toMatchObject({ packKey: KEY });
    expect(item).not.toHaveProperty("packChoice");
    const plain = buildOrderItem(addPackLine([], { ...JEANS, packType: "FIXED", components: [] }, () => "x")[0]);
    expect(plain).not.toHaveProperty("packKey");
    expect(plain).not.toHaveProperty("packChoice");
    expect(packChoicePayload({})).toEqual({});
  });

  it("al cargar: solo marca las líneas con packKey; una clave con otro formato queda para volver a elegir", () => {
    expect(loadedPackChoice({ packKey: null })).toEqual({});
    expect(loadedPackChoice({ packKey: KEY })).toEqual({ packKey: KEY, choosePack: { packProductId: null, slots: [] } });
    expect(choiceIncomplete(loadedLine(KEY))).toBe(false);
    expect(choiceIncomplete(loadedLine("pack-viejo"))).toBe(true);
    expect(buildOrderItem(loadedLine("pack-viejo"))).not.toHaveProperty("packKey");
  });

  it("«Cambiar variantes»: la misma combinación deja la packKey; otra manda packChoice y no packKey", () => {
    const cart = [loadedLine(KEY)];
    expect(changePackChoice(cart, "loaded", JEANS, chosen(["jim-m", "jim-m"]))).toBe(cart);
    const [changed] = changePackChoice(cart, "loaded", JEANS, chosen(["jim-m", "jim-s"]));
    expect(changed.packKey).toBeNull();
    const item = buildOrderItem(changed);
    expect(item).not.toHaveProperty("packKey");
    expect(item.packChoice).toEqual([{ slot: 0, variantId: "jim-m", quantity: 1 }, { slot: 0, variantId: "jim-s", quantity: 1 }, { slot: 1, variantId: "pol-u", quantity: 1 }]);
    expect(changed.packComponents?.map((component) => component.productName)).toEqual(["Jean Jimena M / Celeste", "Jean Jimena S / Celeste", "Polo Luisa U"]);
  });

  it("«Cambiar variantes» a la combinación de otra línea las junta", () => {
    const cart = [
      { ...addChosenPackLine([], JEANS, chosen(["jim-s", "jim-s"]), () => "a")[0], quantity: 2 },
      ...addChosenPackLine([], JEANS, chosen(["jim-m", "jim-m"]), () => "b"),
    ];
    expect(changePackChoice(cart, "a", JEANS, chosen(["jim-m", "jim-m"])).map((line) => [line.id, line.quantity])).toEqual([["b", 3]]);
  });
});

describe("elección incompleta (no se registra)", () => {
  const line = (packChoice: CartItem["packChoice"]): CartItem => ({
    ...addChosenPackLine([], JEANS, chosen(["jim-m", "jim-m"]), () => "x")[0],
    packChoice,
  });

  it("falta una unidad, un componente o la elección entera", () => {
    expect(choiceIncomplete(line([{ slot: 0, variantId: "jim-m", quantity: 2 }, { slot: 1, variantId: "pol-u", quantity: 1 }]))).toBe(false);
    expect(choiceIncomplete(line([{ slot: 0, variantId: "jim-m", quantity: 1 }, { slot: 1, variantId: "pol-u", quantity: 1 }]))).toBe(true);
    expect(choiceIncomplete(line([{ slot: 0, variantId: "jim-m", quantity: 2 }]))).toBe(true);
    expect(choiceIncomplete(line([{ slot: 0, variantId: "jim-m", quantity: 2 }, { slot: 7, variantId: "pol-u", quantity: 1 }]))).toBe(true);
    expect(choiceIncomplete(line(null))).toBe(true);
    expect(linesWithIncompleteChoice([line(null), { ...line(null), id: "gift", isGift: true }]).map((entry) => entry.id)).toEqual(["x"]);
  });

  it("una línea que no es «a elegir» nunca está incompleta", () => {
    expect(choiceIncomplete({})).toBe(false);
  });
});

describe("«Cambiar variantes»: prellenado y stock", () => {
  it("reparte por unidad la elección de la línea o, en una cargada, su contenido guardado", () => {
    const [fresh] = addChosenPackLine([], JEANS, chosen(["jim-s", "jim-m"]), () => "x");
    expect(picksFromLine(JEANS, fresh)).toEqual({ 0: ["jim-s", "jim-m"], 1: ["pol-u"] });
    expect(picksFromLine(JEANS, { packComponents: [{ variantId: "JIM-M", quantity: 2 }, { variantId: "pol-u", quantity: 1 }] })).toEqual({ 0: ["jim-m", "jim-m"], 1: ["pol-u"] });
    // Una variante que ya no se permite queda sin elegir.
    expect(picksFromLine(JEANS, { packComponents: [{ variantId: "jim-x", quantity: 2 }] })).toEqual({ 0: [null, null], 1: [null] });
    expect([...lineChoiceVariantIds(fresh)]).toEqual(["jim-s", "jim-m", "pol-u"]);
  });

  it("disponible del almacén = físico − reservado (0 si no está en ese almacén)", () => {
    const rows = [
      { variant_id: "jim-s", quantity: 5, reserved_quantity: 0, available: 5, inventories: [{ inventory_id: "w2", inventory_name: "B", store_id: null, quantity: 5, reserved_quantity: 0 }] },
      { variant_id: "jim-m", quantity: 9, reserved_quantity: 2, available: 7, inventories: [{ inventory_id: "w1", inventory_name: "A", store_id: null, quantity: 4, reserved_quantity: 1 }] },
      { variant_id: "pol-u", quantity: 1, reserved_quantity: 3, available: 0, inventories: [{ inventory_id: "w1", inventory_name: "A", store_id: null, quantity: 1, reserved_quantity: 3 }] },
    ];
    expect([...availableInWarehouse(rows, "w1")]).toEqual([["jim-s", 0], ["jim-m", 3], ["pol-u", 0]]);
  });

  it("se ofrecen las permitidas activas con stock; sin dato de stock, todas las activas; la elección actual siempre", () => {
    const [, jeans] = JEANS.choiceComponents!;
    const stock = new Map([["jim-s", 0], ["jim-m", 3]]);
    expect(offeredVariants(jeans, stock).map((option) => [option.variantId, option.available])).toEqual([["jim-m", 3]]);
    expect(offeredVariants(jeans, null).map((option) => [option.variantId, option.available])).toEqual([["jim-s", null], ["jim-m", null]]);
    expect(offeredVariants(jeans, stock, new Set(["jim-s"])).map((option) => option.variantId)).toEqual(["jim-s", "jim-m"]);
  });
});
