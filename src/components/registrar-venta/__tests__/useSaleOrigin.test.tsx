import { act, renderHook } from "@testing-library/react";
import { useSaleOrigin } from "../useSaleOrigin";

const stores = [{ id: "a", name: "Tienda A" }, { id: "b", name: "Tienda B" }];
const inventories = [{ id: "shared", name: "Almacén central", storeId: "a" }];
const defaults = { scope: "company:owner:new", editing: false, saved: null, stores, inventories };

describe("Origen comercial de la venta", () => {
  it("completa una única tienda y un único almacén", () => {
    const { result } = renderHook(() => useSaleOrigin({ ...defaults, stores: [stores[0]] }));
    expect(result.current.storeId).toBe("a");
    expect(result.current.inventoryId).toBe("shared");
    expect(result.current.catalogInventoryId).toBe("shared");
    expect(result.current.hasStore && result.current.hasInventory).toBe(true);
  });

  it("exige elegir tienda cuando hay varias, aunque exista un almacén común", () => {
    const { result } = renderHook(() => useSaleOrigin(defaults));
    expect(result.current.storeId).toBe("");
    expect(result.current.hasStore).toBe(false);
    act(() => result.current.chooseStore("b"));
    expect(result.current.storeId).toBe("b");
    expect(result.current.inventoryId).toBe("shared");
  });

  it("permite cambiar la tienda comercial conservando el almacén compartido", () => {
    const { result } = renderHook(() => useSaleOrigin({
      ...defaults,
      inventories: [...inventories, { id: "second", name: "Almacén 2", storeId: "b" }],
    }));
    expect(result.current.inventoryId).toBe("");
    act(() => { result.current.chooseStore("a"); result.current.chooseInventory("second"); });
    act(() => result.current.chooseStore("b"));
    expect(result.current.storeId).toBe("b");
    expect(result.current.inventoryId).toBe("second");
  });

  it("la siguiente venta exige otra selección explícita si hay varias tiendas", () => {
    const { result } = renderHook(() => useSaleOrigin(defaults));
    act(() => result.current.chooseStore("b"));
    act(() => result.current.reset());
    expect(result.current.storeId).toBe("");
    expect(result.current.inventoryId).toBe("shared");
  });

  it("al editar usa el origen guardado y bloquea la reasignación", () => {
    const { result } = renderHook(() => useSaleOrigin({
      ...defaults, editing: true, saved: { storeId: "b", inventoryId: "shared" },
    }));
    act(() => { result.current.chooseStore("a"); result.current.chooseInventory("shared"); });
    expect(result.current.storeId).toBe("b");
    expect(result.current.inventoryId).toBe("shared");
  });

  it("no asigna un almacén a una venta histórica que no lo guardó", () => {
    const { result } = renderHook(() => useSaleOrigin({
      ...defaults, editing: true, saved: { storeId: "a", inventoryId: null },
    }));
    expect(result.current.inventoryId).toBe("");
    expect(result.current.catalogInventoryId).toBe("shared");
    expect(result.current.hasInventory).toBe(true);
  });

  it("al editar historia exige elegir entre varios almacenes sólo para buscar productos", () => {
    const { result } = renderHook(() => useSaleOrigin({
      ...defaults, editing: true, saved: { storeId: "a", inventoryId: null },
      inventories: [...inventories, { id: "second", name: "Almacén 2", storeId: "a" }],
    }));
    expect(result.current.catalogInventoryId).toBe("");
    act(() => result.current.chooseInventory("second"));
    expect(result.current.catalogInventoryId).toBe("second");
    expect(result.current.inventoryId).toBe("");
    expect(result.current.storeId).toBe("a");
    expect(result.current.hasInventory).toBe(true);
    act(() => result.current.chooseInventory("foreign"));
    expect(result.current.catalogInventoryId).toBe("second");
  });

  it("requiere una elección explícita para buscar en el almacén de otra tienda de la empresa", () => {
    const { result } = renderHook(() => useSaleOrigin({
      ...defaults, editing: true, saved: { storeId: "b", inventoryId: null },
    }));
    expect(result.current.catalogInventoryId).toBe("");
    act(() => result.current.chooseInventory("shared"));
    expect(result.current.catalogInventoryId).toBe("shared");
    expect(result.current.inventoryId).toBe("");
    expect(result.current.storeId).toBe("b");
  });

  it("un almacén registrado se conserva aunque ya no esté en el contexto disponible", () => {
    const { result } = renderHook(() => useSaleOrigin({
      ...defaults, editing: true, saved: { storeId: "a", inventoryId: "retired" },
    }));
    act(() => result.current.chooseInventory("shared"));
    expect(result.current.inventoryId).toBe("retired");
    expect(result.current.catalogInventoryId).toBe("retired");
    expect(result.current.browsingHistoricalSale).toBe(false);
  });

  it("historia sin almacenes disponibles permite editar sus datos sin inventar un catálogo", () => {
    const { result } = renderHook(() => useSaleOrigin({
      ...defaults, editing: true, saved: { storeId: "a", inventoryId: null }, inventories: [],
    }));
    expect(result.current.inventoryId).toBe("");
    expect(result.current.catalogInventoryId).toBe("");
    expect(result.current.hasInventory).toBe(true);
  });

  it("no conserva el almacén de búsqueda cuando cambia a otra venta histórica", () => {
    const options = {
      ...defaults, editing: true, saved: { storeId: "a", inventoryId: null },
      inventories: [...inventories, { id: "second", name: "Almacén 2", storeId: "a" }],
    };
    const { result, rerender } = renderHook((props) => useSaleOrigin(props), { initialProps: options });
    act(() => result.current.chooseInventory("second"));
    rerender({ ...options, scope: "company:owner:other-order" });
    expect(result.current.catalogInventoryId).toBe("");
    expect(result.current.inventoryId).toBe("");
  });

  it("no permite crear una venta mientras se carga una edición", () => {
    const { result } = renderHook(() => useSaleOrigin({ ...defaults, editing: true }));
    expect(result.current.hasStore).toBe(false);
    expect(result.current.hasInventory).toBe(false);
  });

  it("no arrastra selecciones a otra empresa o usuario", () => {
    const { result, rerender } = renderHook((options) => useSaleOrigin(options), { initialProps: defaults });
    act(() => result.current.chooseStore("b"));
    rerender({ ...defaults, scope: "other-company:other-owner:new" });
    expect(result.current.storeId).toBe("");
  });

  it("una tienda retirada de las opciones ya no permite guardar", () => {
    const { result, rerender } = renderHook((options) => useSaleOrigin(options), { initialProps: defaults });
    act(() => result.current.chooseStore("b"));
    rerender({ ...defaults, stores: [] });
    expect(result.current.hasStore).toBe(false);
  });

  it("rechaza IDs que no están en el contexto autorizado", () => {
    const { result } = renderHook(() => useSaleOrigin(defaults));
    act(() => { result.current.chooseStore("foreign"); result.current.chooseInventory("foreign"); });
    expect(result.current.storeId).toBe("");
    expect(result.current.inventoryId).toBe("shared");
  });
});
