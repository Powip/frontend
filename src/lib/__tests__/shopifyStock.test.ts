/**
 * Tests: lógica de la pantalla de stock de Shopify (FEAT-24 H1-D, H1D-5).
 * Contadores, listas del reporte, lectura del 422 del cambio de modo, rechazo
 * de «Generar reporte», sondeo de la corrida y ayudas (tiendas del mismo
 * almacén, URL de re-autorización, ubicaciones).
 */

import {
  findLocation,
  locationKey,
  parseModeChangeError,
  parseRunRequestError,
  pollStockRun,
  reauthorizeHref,
  reportLists,
  sharedWarehouseSiblings,
  StockRunPollTimeoutError,
  summarizeCounters,
} from "../shopifyStock";
import type {
  ShopifyStockCounters,
  ShopifyStockReport,
  ShopifyStockReportItem,
  ShopifyStockRun,
  ShopifyStockShop,
} from "@/services/shopifyStockService";

const counters = (over: Partial<ShopifyStockCounters> = {}): ShopifyStockCounters => ({
  seen: 0,
  linked: 0,
  skipped_unlinked: 0,
  skipped_sku_only: 0,
  skipped_duplicate: 0,
  skipped_untracked: 0,
  to_publish: 0,
  published: 0,
  skipped_changed: 0,
  errors: 0,
  tracked_deny_count: 0,
  locations_count: 1,
  pending_orders_imported: 0,
  skipped_not_in_warehouse: 0,
  skipped_not_stocked: 0,
  skipped_out_of_range: 0,
  unchanged: 0,
  would_zero: 0,
  would_zero_deny: 0,
  skipped_sku_mismatch: 0,
  multi_location_diff: 0,
  ...over,
});

const run = (over: Partial<ShopifyStockRun> = {}): ShopifyStockRun => ({
  id: "run-1",
  mode: "reporte",
  status: "ok",
  startedAt: "2026-11-17T08:00:00.000Z",
  finishedAt: "2026-11-17T08:01:00.000Z",
  error: null,
  stockLocationId: "gid://shopify/Location/111",
  inventoryId: "inv-1",
  writeBlockedReason: null,
  counters: counters(),
  ...over,
});

const item = (id: string, over: Partial<ShopifyStockReportItem> = {}): ShopifyStockReportItem => ({
  shopifyVariantId: id,
  shopifyInventoryItemId: null,
  shopifySku: `SKU-${id}`,
  powipSku: `SKU-${id}`,
  powipVariantId: `pv-${id}`,
  signal: "external_id",
  confidence: 1,
  tracked: true,
  inventoryPolicy: "deny",
  shopifyAvailable: 5,
  shopifyAvailableTotal: null,
  powipAvailable: 3,
  detail: null,
  ...over,
});

const shop = (over: Partial<ShopifyStockShop> & Pick<ShopifyStockShop, "id">): ShopifyStockShop => ({
  shopUrl: `${over.id}.myshopify.com`,
  storeId: null,
  inventoryId: "inv-1",
  stockMode: "reporte",
  stockLocationId: null,
  isActive: true,
  healthStatus: "ok",
  needsReauthorization: false,
  stockPublishError: null,
  stockPublishErrorAt: null,
  stockAckOnlineLocations: null,
  lastRun: null,
  runningRun: null,
  ...over,
});

const httpError = (status: number, data: unknown) => ({ isAxiosError: true, response: { status, data } });

describe("summarizeCounters", () => {
  it("mapea los contadores a las etiquetas de la pantalla", () => {
    const view = summarizeCounters(
      counters({
        seen: 120,
        unchanged: 80,
        to_publish: 15,
        would_zero: 6,
        would_zero_deny: 2,
        skipped_sku_mismatch: 3,
        multi_location_diff: 4,
        skipped_unlinked: 10,
        skipped_sku_only: 2,
        skipped_duplicate: 1,
        skipped_untracked: 5,
        skipped_not_stocked: 1,
        skipped_not_in_warehouse: 2,
        skipped_out_of_range: 1,
        errors: 0,
      }),
    );
    const byKey = Object.fromEntries(view.map((c) => [c.key, c]));
    expect(view.map((c) => c.label)).toEqual([
      "Revisadas",
      "Iguales",
      "A publicar",
      "Quedarían en 0",
      "Frenan la venta",
      "SKU que no cruzan",
      "Varias ubicaciones",
      "Sin vincular",
      "Otros saltos",
      "Errores",
    ]);
    expect(byKey.revisadas.value).toBe(120);
    expect(byKey.iguales.value).toBe(80);
    expect(byKey.a_publicar.value).toBe(15);
    expect(byKey.quedarian_en_0.value).toBe(6);
    expect(byKey.frenan_venta).toMatchObject({ value: 2, tone: "danger" });
    expect(byKey.sku_no_cruzan.value).toBe(3);
    expect(byKey.varias_ubicaciones.value).toBe(4);
    // sin vincular = sin vínculo + solo SKU
    expect(byKey.sin_vincular.value).toBe(12);
    // otros saltos = duplicadas + sin seguimiento + no en la ubicación + no en el almacén + fuera de rango
    expect(byKey.otros_saltos.value).toBe(10);
    expect(byKey.errores).toMatchObject({ value: 0, tone: "neutral" });
  });

  it("tolera contadores ausentes o no numéricos (cuentan 0)", () => {
    const view = summarizeCounters({ unchanged: "7" as unknown as number, to_publish: undefined });
    expect(view.find((c) => c.key === "iguales")?.value).toBe(7);
    expect(view.find((c) => c.key === "a_publicar")?.value).toBe(0);
    expect(summarizeCounters(null).every((c) => c.value === 0)).toBe(true);
  });
});

describe("reportLists", () => {
  const report = (over: Partial<ShopifyStockReport> = {}): ShopifyStockReport => ({
    generatedAt: "2026-11-17T09:00:00.000Z",
    shop: {
      id: "s1",
      shopUrl: "s1.myshopify.com",
      stockMode: "reporte",
      stockLocationId: null,
      stockPublishError: null,
      stockPublishErrorAt: null,
      isActive: true,
      healthStatus: "ok",
      needsReauthorization: false,
      hasInventory: true,
      stockAckOnlineLocations: null,
    },
    run: run({ counters: counters({ would_zero: 9 }) }),
    locationsCount: 2,
    trackedDenyCount: 1,
    itemsLimit: 50,
    groups: [
      { action: "error", total: 1, items: [item("e1")] },
      { action: "publish", total: 30, items: [item("p1"), item("p2", { powipAvailable: 0, shopifyAvailable: 4 }), item("p3", { powipAvailable: 0, shopifyAvailable: 0 })] },
      { action: "skip_sku_mismatch", total: 2, items: [item("m1"), item("m2")] },
      { action: "skip_unlinked", total: 5, items: [item("u1")] },
      { action: "skip_sku_only", total: 1, items: [item("so1")] },
      { action: "skip_untracked", total: 7, items: [item("t1")] },
    ],
    multiLocation: { total: 3, items: [item("ml1", { shopifyAvailableTotal: 9 })] },
    wouldZeroDeny: { total: 1, items: [item("p2", { powipAvailable: 0, shopifyAvailable: 4 })] },
    ...over,
  });

  it("arma las seis listas con sus totales", () => {
    const lists = Object.fromEntries(reportLists(report()).map((l) => [l.key, l]));
    expect(Object.keys(lists)).toEqual([
      "a_publicar",
      "quedarian_en_0",
      "frenan_venta",
      "sku_no_cruzan",
      "varias_ubicaciones",
      "sin_vincular",
    ]);
    // a publicar = todas las diferencias (publish, published, changed, error)
    expect(lists.a_publicar.total).toBe(31);
    expect(lists.a_publicar.items.map((i) => i.shopifyVariantId)).toEqual(["e1", "p1", "p2", "p3"]);
    // quedarían en 0: Powip 0 sobre stock real de Shopify; el total sale del contador de la corrida
    expect(lists.quedarian_en_0.items.map((i) => i.shopifyVariantId)).toEqual(["p2"]);
    expect(lists.quedarian_en_0.total).toBe(9);
    expect(lists.frenan_venta).toMatchObject({ total: 1 });
    expect(lists.sku_no_cruzan.total).toBe(2);
    expect(lists.varias_ubicaciones.items[0].shopifyAvailableTotal).toBe(9);
    // sin vincular = skip_unlinked + skip_sku_only (no los otros saltos)
    expect(lists.sin_vincular.total).toBe(6);
    expect(lists.sin_vincular.items.map((i) => i.shopifyVariantId)).toEqual(["u1", "so1"]);
  });

  it("sin corrida, quedarían en 0 cuenta lo listado", () => {
    const lists = reportLists(report({ run: null }));
    expect(lists.find((l) => l.key === "quedarian_en_0")?.total).toBe(1);
  });
});

describe("parseModeChangeError", () => {
  it("422 con precondiciones: lista legible y pide las aceptaciones que faltan", () => {
    const failure = parseModeChangeError(
      httpError(422, {
        statusCode: 422,
        message: "No se puede pasar la tienda a modo powip: 3 precondiciones sin cumplir: …",
        currentMode: "reporte",
        preconditions: [
          { code: "confirmacion", ok: true, message: "confirmación explícita recibida" },
          { code: "venta_bloqueada", ok: false, message: "el último reporte tiene 4 variantes…" },
          { code: "ubicaciones_online", ok: false, message: "otras ubicaciones activas despachan…" },
          { code: "codigo_nuevo", ok: false, message: "algo nuevo" },
        ],
        unmet: ["venta_bloqueada", "ubicaciones_online", "codigo_nuevo"],
        lastRun: { counters: { would_zero_deny: 4 } },
      }),
    );
    expect(failure.status).toBe(422);
    expect(failure.currentMode).toBe("reporte");
    expect(failure.message).toBe("Todavía no se puede cambiar el modo: falta lo que se lista abajo.");
    expect(failure.unmet).toEqual([
      {
        code: "venta_bloqueada",
        label: "Hay productos que dejarían de venderse en la tienda online",
        detail: "el último reporte tiene 4 variantes…",
      },
      {
        code: "ubicaciones_online",
        label: "Otras ubicaciones de Shopify también despachan pedidos online",
        detail: "otras ubicaciones activas despachan…",
      },
      // un código que el front no conoce se muestra tal cual
      { code: "codigo_nuevo", label: "codigo_nuevo", detail: "algo nuevo" },
    ]);
    expect(failure.needsAckZeroDeny).toBe(true);
    expect(failure.needsAckMultiLocation).toBe(true);
    expect(failure.needsGroup).toBe(false);
    expect(failure.zeroDenyCount).toBe(4);
  });

  it("422 en grupo: lo que falta en cada otra tienda y si hace falta pasarlas juntas", () => {
    const failure = parseModeChangeError(
      httpError(422, {
        preconditions: [{ code: "almacen_compartido", ok: false, message: "otras tiendas…" }],
        group: [
          { shopUrl: "b.myshopify.com", preconditions: [{ code: "reporte_reciente", ok: false, message: "viejo" }] },
          { shopUrl: "c.myshopify.com", preconditions: [{ code: "ubicacion", ok: true, message: "ok" }] },
        ],
      }),
    );
    expect(failure.needsGroup).toBe(true);
    expect(failure.groupUnmet).toEqual([
      { shopUrl: "b.myshopify.com", unmet: [{ code: "reporte_reciente", label: expect.any(String), detail: "viejo" }] },
    ]);
    expect(failure.zeroDenyCount).toBeNull();
  });

  it("422 sin precondiciones (validación del grupo): usa el mensaje del backend", () => {
    const failure = parseModeChangeError(httpError(422, { message: "groupShopIds solo vale para pasar a powip" }));
    expect(failure.message).toBe("groupShopIds solo vale para pasar a powip");
    expect(failure.unmet).toEqual([]);
  });

  it.each([
    [409, "La tienda cambió mientras se revisaba el pedido. Revisa su estado y vuelve a intentarlo."],
    [403, "Solo un administrador de la empresa puede cambiar el modo de stock."],
  ])("%i → mensaje fijo", (status, message) => {
    expect(parseModeChangeError(httpError(status, { message: "x" })).message).toBe(message);
  });

  it("sin respuesta (red) → mensaje genérico", () => {
    const failure = parseModeChangeError(new Error("Network Error"));
    expect(failure.status).toBeNull();
    expect(failure.message).toBe("No se pudo cambiar el modo. Inténtalo de nuevo.");
  });
});

describe("parseRunRequestError", () => {
  it("409 con la corrida de la tienda → se sigue esa", () => {
    expect(parseRunRequestError(httpError(409, { runningRunId: "r0" }))).toEqual({
      kind: "running",
      runningRunId: "r0",
      message: "Ya hay un reporte en curso para esta tienda: se muestra ese.",
    });
  });

  it("409 sin corrida de la tienda (la diaria tiene el turno) → esperar", () => {
    expect(parseRunRequestError(httpError(409, { message: "La republicación diaria…" }))).toMatchObject({
      kind: "running",
      runningRunId: null,
    });
  });

  it("403 y 422 → error con el motivo", () => {
    expect(parseRunRequestError(httpError(403, {}))).toEqual({
      kind: "error",
      message: "Solo un administrador de la empresa puede generar el reporte.",
    });
    expect(parseRunRequestError(httpError(422, { message: "No se puede correr un reporte: tienda inactiva" }))).toEqual({
      kind: "error",
      message: "No se puede correr un reporte: tienda inactiva",
    });
  });
});

describe("pollStockRun", () => {
  const state = (status: ShopifyStockRun["status"]) => ({ shopId: "s1", run: run({ status }) });
  const instantSleep = jest.fn(async () => undefined);

  beforeEach(() => instantSleep.mockClear());

  it("consulta hasta que la corrida deja de estar en curso y la devuelve", async () => {
    const fetchRun = jest
      .fn()
      .mockResolvedValueOnce(state("running"))
      .mockResolvedValueOnce(state("running"))
      .mockResolvedValueOnce(state("ok"));
    const onUpdate = jest.fn();
    const result = await pollStockRun("run-1", { fetchRun, sleep: instantSleep, intervalMs: 3000, onUpdate });
    expect(result.status).toBe("ok");
    expect(fetchRun).toHaveBeenCalledTimes(3);
    expect(fetchRun).toHaveBeenCalledWith("run-1");
    expect(instantSleep).toHaveBeenCalledTimes(2);
    expect(instantSleep).toHaveBeenCalledWith(3000);
    expect(onUpdate).toHaveBeenCalledTimes(3);
  });

  it("tolera fallas sueltas y corta tras 3 seguidas", async () => {
    const boom = new Error("red");
    const recovers = jest.fn().mockRejectedValueOnce(boom).mockResolvedValueOnce(state("error"));
    await expect(pollStockRun("run-1", { fetchRun: recovers, sleep: instantSleep })).resolves.toMatchObject({ status: "error" });

    const dead = jest.fn().mockRejectedValue(boom);
    await expect(pollStockRun("run-1", { fetchRun: dead, sleep: instantSleep })).rejects.toBe(boom);
    expect(dead).toHaveBeenCalledTimes(3);
  });

  it("corta con StockRunPollTimeoutError pasado el tiempo máximo", async () => {
    let clock = 0;
    const fetchRun = jest.fn().mockResolvedValue(state("running"));
    const sleep = jest.fn(async (ms: number) => {
      clock += ms;
    });
    await expect(
      pollStockRun("run-1", { fetchRun, sleep, now: () => clock, intervalMs: 1000, timeoutMs: 5000 }),
    ).rejects.toBeInstanceOf(StockRunPollTimeoutError);
    expect(fetchRun).toHaveBeenCalledTimes(6);
  });

  it("se cancela con la señal", async () => {
    const ctrl = new AbortController();
    const fetchRun = jest.fn().mockImplementation(async () => {
      ctrl.abort();
      return state("running");
    });
    await expect(pollStockRun("run-1", { fetchRun, sleep: instantSleep, signal: ctrl.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fetchRun).toHaveBeenCalledTimes(1);
  });

  it("con temporizadores reales del navegador espera el intervalo entre consultas", async () => {
    jest.useFakeTimers();
    try {
      const fetchRun = jest.fn().mockResolvedValueOnce(state("running")).mockResolvedValueOnce(state("ok"));
      const done = pollStockRun("run-1", { fetchRun, intervalMs: 3000 });
      await jest.advanceTimersByTimeAsync(2999);
      expect(fetchRun).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      await expect(done).resolves.toMatchObject({ status: "ok" });
      expect(fetchRun).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("ayudas", () => {
  it("sharedWarehouseSiblings: otras tiendas activas del mismo almacén que no están en «Powip manda»", () => {
    const a = shop({ id: "a" });
    const all = [
      a,
      shop({ id: "b" }),
      shop({ id: "c", stockMode: "powip" }),
      shop({ id: "d", isActive: false }),
      shop({ id: "e", inventoryId: "inv-2" }),
      shop({ id: "f", stockMode: "shopify" }),
    ];
    expect(sharedWarehouseSiblings(a, all).map((s) => s.id)).toEqual(["b", "f"]);
    expect(sharedWarehouseSiblings(shop({ id: "x", inventoryId: null }), all)).toEqual([]);
  });

  it("reauthorizeHref: deja la absoluta y completa la relativa con la base de ms-integrations", () => {
    expect(reauthorizeHref("https://api.powip.test/shopify/reauth/a.myshopify.com", "http://x")).toBe(
      "https://api.powip.test/shopify/reauth/a.myshopify.com",
    );
    expect(reauthorizeHref("/shopify/reauth/a.myshopify.com", "https://int.powip.test/")).toBe(
      "https://int.powip.test/shopify/reauth/a.myshopify.com",
    );
  });

  it("locationKey y findLocation: gid o número de la misma ubicación", () => {
    expect(locationKey("gid://shopify/Location/111")).toBe("111");
    expect(locationKey("111")).toBe("111");
    expect(locationKey("gid://shopify/Product/1")).toBeNull();
    const locations = [
      { id: "gid://shopify/Location/111", legacyId: "111", name: "Central", isActive: true, fulfillsOnlineOrders: true },
      { id: "gid://shopify/Location/222", legacyId: "222", name: "Sur", isActive: true, fulfillsOnlineOrders: false },
    ];
    expect(findLocation(locations, "222")?.name).toBe("Sur");
    expect(findLocation(locations, "gid://shopify/Location/111")?.name).toBe("Central");
    expect(findLocation(locations, null)).toBeNull();
  });
});
