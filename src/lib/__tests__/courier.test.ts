/**
 * @jest-environment node
 */
import { hasRouteAccess, isCourierRoute } from "@/config/permissions.config";
import { renderPdf, type PdfDeps, type PdfDoc } from "@/lib/pdf/document";
import { formatMoney } from "@/lib/purchaseOrders";
import { warehouseAccess } from "@/lib/warehouseMode";
import type { CourierClaim, CourierStock, ReconciliationExplanation } from "@/services/sharedCourierService";
import {
  aliclikMapErrorMessage,
  courierAccess,
  courierClaimPdfSpec,
  courierStockNotices,
  explanationText,
  NEXT_CLAIM_STATUSES,
  squareActions,
  syncText,
} from "../courier";

// FEAT-24 H8 — reglas del front del courier compartido: quién ve y gestiona, los avisos del stock del
// courier (dato viejo, Aliclik caído), las explicaciones de la conciliación, el 409 del mapa de Aliclik,
// el PDF del reclamo y el cierre de rutas al rol COURIER.

const side = (courier: CourierStock["courier"]): Pick<CourierStock, "courier" | "basis"> => ({ courier, basis: "disponible" });

describe("acceso por rol (tabla de la fachada H8)", () => {
  it("Administrador y Operaciones ven, concilian y ven montos", () => {
    for (const role of ["ADMINISTRADOR", "OPERACIONES"]) expect(courierAccess({ role })).toEqual({ view: true, manage: true, seeCosts: true, courier: false });
  });

  it("Almacén solo mira, sin montos; COURIER solo su portal, sin montos ni gestión; Ventas nada", () => {
    expect(courierAccess({ role: "ALMACEN" })).toEqual({ view: true, manage: false, seeCosts: false, courier: false });
    expect(courierAccess({ role: " courier " })).toEqual({ view: true, manage: false, seeCosts: false, courier: true });
    expect(courierAccess({ role: "VENTAS", permissions: ["MANAGE_INVENTORY"] })).toEqual({ view: false, manage: false, seeCosts: false, courier: false });
  });

  it("el COURIER solo abre su portal en /almacen (y los avisos de la cuenta); nada más del menú", () => {
    const courier = { role: "COURIER", permissions: ["MANAGE_INVENTORY", "UPDATE_DELIVERY_STATUS"] };
    for (const path of ["/almacen", "/almacen/stock", "/almacen/contar", "/almacen/recibir", "/almacen/recibir/traslados", "/almacen/conciliacion", "/almacen/revisar", "/cuenta-suspendida"])
      expect([path, hasRouteAccess(path, courier)]).toEqual([path, true]);
    for (const path of ["/", "/dashboard", "/panel-control", "/inventario", "/inventario/stock", "/inventario/couriers", "/ventas", "/compras", "/configuracion", "/almacen/consultar", "/almacen/picking", "/almacen/recibir/compras", "/almacen/recibir/devoluciones", "/almacenes"])
      expect([path, hasRouteAccess(path, courier)]).toEqual([path, false]);
    expect(isCourierRoute("/almacen-sw.js")).toBe(false);
    // Los demás roles siguen igual.
    expect(hasRouteAccess("/inventario/stock", { role: "VENTAS", permissions: [] })).toBe(true);
    expect(hasRouteAccess("/almacen/picking", { role: "ALMACEN", permissions: [] })).toBe(true);
  });

  it("en el modo almacén el COURIER cuenta y recibe traslados; no consulta, ni hace picking, ni recibe compras o devoluciones", () => {
    expect(warehouseAccess({ role: "COURIER", permissions: ["UPDATE_DELIVERY_STATUS", "MANAGE_OPERATIONS"] }, () => true)).toEqual({
      consult: false,
      picking: false,
      receiveReturns: false,
      receivePurchases: false,
      receiveTransfers: true,
      count: true,
    });
  });
});

describe("stock del courier: avisos", () => {
  it("Aliclik caído: un solo aviso rojo con el mensaje del servidor; lo de POWIP sale igual", () => {
    expect(courierStockNotices(side({ source: "api", available: false, message: "No pudimos leer el stock de Aliclik. Inténtalo de nuevo." }))).toEqual([
      { key: "api-down", tone: "red", text: "No pudimos leer el stock de Aliclik. Inténtalo de nuevo. Lo de POWIP se muestra igual." },
    ]);
  });

  it("dato viejo, SKU sin vincular y almacén sin mapa", () => {
    const notices = courierStockNotices(
      side({ source: "api", available: true, mapped: false, aliclikWarehouses: [], lastSyncedAt: "2026-11-18T13:05:00Z", stale: true, unlinked: { skus: 3, units: 12 } }),
    );
    expect(notices.map((notice) => [notice.key, notice.tone])).toEqual([
      ["unmapped", "amber"],
      ["stale", "amber"],
      ["unlinked", "slate"],
    ]);
    expect(notices[1].text).toBe("Dato viejo: Aliclik no se sincroniza hace más de 30 minutos (última lectura: 18/11/26, 08:05).");
    expect(notices[2].text).toBe("3 SKU de Aliclik sin vincular (12 und): se ven como diferencia. Vincúlalos en Inventario › Unificación.");
    const never = courierStockNotices(side({ source: "api", available: true, mapped: true, aliclikWarehouses: [], lastSyncedAt: null, stale: true, unlinked: { skus: 0, units: 0 } }));
    expect(never.map((notice) => notice.text)).toEqual(["Dato viejo: Aliclik todavía no se sincronizó con este almacén."]);
  });

  it("al día no avisa nada; con conteo dice de cuál sale; sin nada, cómo conseguirlo (en el portal, sin enlaces de escritorio)", () => {
    expect(courierStockNotices(side({ source: "api", available: true, mapped: true, aliclikWarehouses: [], lastSyncedAt: "2026-11-18T13:05:00Z", stale: false, unlinked: { skus: 0, units: 0 } }))).toEqual([]);
    expect(courierStockNotices(side({ source: "conteo", available: true, countId: "ct-1", countNumber: "CT-0004", countStatus: "aplicado", countedAt: null }))[0].text).toBe(
      "Lo que reporta el courier sale del conteo CT-0004.",
    );
    expect(courierStockNotices(side({ source: null, available: false }), { portal: true })[0].text).toMatch(/cuenta desde «Contar»/);
  });

  it("texto de la sincronización", () => {
    expect(syncText({ courierProvider: "aliclik", syncMode: "api" })).toBe("Aliclik · Por API");
    expect(syncText({ courierProvider: "olva", syncMode: null })).toBe("Olva · sin modo de sincronización");
    expect(syncText({ courierProvider: null, syncMode: null })).toBe("Sin datos del courier");
  });
});

describe("conciliación: explicaciones y acciones que la cuadran", () => {
  const exp = (overrides: Partial<ReconciliationExplanation>): ReconciliationExplanation => ({ id: "e", type: "traslado_en_camino", source: "auto", quantity: 2, applied: 2, ...overrides });

  it("cada explicación con su signo, sus documentos y lo que cuenta de verdad", () => {
    expect(explanationText(exp({ references: [{ id: "t-1", number: "TRA-0003" }] }))).toBe("+2 traslado en camino (TRA-0003)");
    expect(explanationText(exp({ type: "merma_courier", source: "manual", quantity: -1, applied: -1, reference: "GUIA-77" }))).toBe("-1 merma del courier (GUIA-77)");
    expect(explanationText(exp({ type: "devolucion_por_recibir", quantity: 3, applied: 1 }))).toBe("+3 devolución por recibir · cuenta +1 de +3");
  });

  it("enlaza a Traslados, Recepciones y Ajustes; en el portal solo a recibir traslados", () => {
    const line = {
      unexplained: -2,
      explanations: [exp({}), exp({ id: "e2", type: "devolucion_por_recibir" }), exp({ id: "e3", type: "merma_por_aprobar", quantity: -1, applied: -1 })],
    };
    expect(squareActions(line).map((action) => [action.label, action.href])).toEqual([
      ["Recibir traslado", "/inventario/traslados"],
      ["Recibir devolución", "/inventario/recepciones"],
      ["Aprobar merma", "/inventario/ajustes"],
    ]);
    expect(squareActions({ unexplained: -2, explanations: [] }).map((action) => action.label)).toEqual(["Registrar merma"]);
    expect(squareActions(line, { portal: true })).toEqual([{ key: "transfer", label: "Recibir traslado", href: "/almacen/recibir/traslados" }]);
  });

  it("los reclamos solo avanzan: abierto → aceptado|rechazado → cobrado|rechazado", () => {
    expect(NEXT_CLAIM_STATUSES).toEqual({ abierto: ["aceptado", "rechazado"], aceptado: ["cobrado", "rechazado"], cobrado: [], rechazado: [] });
  });
});

describe("mapa de Aliclik: el 409 ALICLIK_WAREHOUSE_TAKEN", () => {
  const names = { aliclik: (id: number) => (id === 7 ? "«Lima Norte» de Aliclik" : null), powip: (id: string) => (id === "w-9" ? "Olva Lima" : null) };

  it("dice qué almacén de Aliclik y a cuál de POWIP ya apunta", () => {
    const error = { response: { status: 409, data: { code: "ALICLIK_WAREHOUSE_TAKEN", aliclikWarehouseId: 7, inventoryId: "w-9", message: "taken" } } };
    expect(aliclikMapErrorMessage(error, names)).toBe("«Lima Norte» de Aliclik ya está asignado a «Olva Lima». Quítalo de ese almacén primero y vuelve a guardar.");
    const unknown = { response: { status: 409, data: { code: "ALICLIK_WAREHOUSE_TAKEN", aliclikWarehouseId: 12, inventoryId: "w-x" } } };
    expect(aliclikMapErrorMessage(unknown, names)).toBe("El almacén 12 de Aliclik ya está asignado a otro almacén de POWIP. Quítalo de ese almacén primero y vuelve a guardar.");
  });

  it("otro error: el mensaje del servidor", () => {
    expect(aliclikMapErrorMessage({ response: { status: 409, data: { message: "Primero marca el almacén como courier Aliclik en sus datos." } } }, names)).toBe(
      "Primero marca el almacén como courier Aliclik en sus datos.",
    );
  });
});

describe("PDF del reclamo (helper común de H10, sin renderizar)", () => {
  const CLAIM: CourierClaim = {
    id: "cl-1",
    number: "RCL-0002",
    inventoryId: "w-3",
    courierProvider: "olva",
    origin: "conciliacion",
    referenceId: "rec-1",
    referenceNumber: "CON-0001",
    status: "aceptado",
    totalUnits: 3,
    totalAmount: 97.2,
    linesWithoutCost: 0,
    collectedAmount: null,
    notes: "Faltante de la guía 77",
    statusChangedAt: "2026-11-18T15:00:00Z",
    createdAt: "2026-11-17T15:00:00Z",
    lines: [{ id: "l-1", variantId: "v-1", sku: "POL-M", productName: "Polo · Talla: M", quantity: 3, unitCost: 32.4, amount: 97.2 }],
    history: [{ id: "h-1", fromStatus: "abierto", toStatus: "aceptado", note: "Lo descuentan en la liquidación", userEmail: "ana@kunca.pe", userName: "Ana", createdAt: "2026-11-18T15:00:00Z" }],
  };

  it("arma título, número, datos, líneas, total y firmas", () => {
    const spec = courierClaimPdfSpec(CLAIM, { warehouseName: "Olva Cusco" });
    expect(spec).toMatchObject({ title: "Reclamo a courier", number: "RCL-0002", date: "17/11/2026", fileName: "RCL-0002", signatures: ["Por la empresa", "Por el courier"] });
    expect(spec.meta).toEqual([
      ["Courier", "Olva"],
      ["Almacén", "Olva Cusco"],
      ["Origen", "Conciliación CON-0001"],
      ["Estado", "Aceptado"],
      ["Unidades", "3"],
    ]);
    expect(spec.tables[0].rows).toEqual([["POL-M", "Polo · Talla: M", "3", formatMoney(32.4, 4), formatMoney(97.2)]]);
    expect(spec.foot).toEqual([["Total reclamado", formatMoney(97.2)]]);
    expect(formatMoney(97.2)).toMatch(/^S\/\s97\.20$/);
    expect(spec.note).toBe("Notas: Faltante de la guía 77 · Último cambio (Aceptado): Lo descuentan en la liquidación");
  });

  it("sin rol de costos los montos salen «••••»", () => {
    const { totalAmount: _total, ...masked } = CLAIM;
    void _total;
    const spec = courierClaimPdfSpec({ ...masked, lines: [{ id: "l-1", variantId: "v-1", sku: "POL-M", productName: "Polo", quantity: 3 }] } as CourierClaim);
    expect(spec.tables[0].rows[0].slice(3)).toEqual(["••••", "••••"]);
    expect(spec.foot).toEqual([["Total reclamado", "••••"]]);
  });

  it("se dibuja con el encabezado (empresa, título, número) y el pie (usuario, fecha, página)", () => {
    const texts: string[] = [];
    const doc = {
      internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
      setFont: jest.fn(),
      setFontSize: jest.fn(),
      setTextColor: jest.fn(),
      setFillColor: jest.fn(),
      setDrawColor: jest.fn(),
      setLineWidth: jest.fn(),
      rect: jest.fn(),
      line: jest.fn(),
      text: (text: string | string[]) => {
        texts.push(Array.isArray(text) ? text.join("\n") : text);
      },
      splitTextToSize: (text: string) => [text],
      addImage: jest.fn(),
      addPage: jest.fn(),
      getNumberOfPages: () => 1,
      setPage: jest.fn(),
      save: jest.fn(),
    } as unknown as PdfDoc;
    const deps: PdfDeps = {
      createDoc: jest.fn(() => doc),
      autoTable: jest.fn((target: PdfDoc) => {
        target.lastAutoTable = { finalY: 120 };
      }),
    };
    renderPdf(courierClaimPdfSpec(CLAIM, { warehouseName: "Olva Cusco" }), { company: { name: "KUNCA SAC", ruc: "20601234567" }, userName: "Ana Pérez", printedAt: new Date("2026-11-18T15:30:00Z") }, deps);
    expect(texts).toEqual(expect.arrayContaining(["KUNCA SAC", "Reclamo a courier", "RCL-0002", "Por la empresa", "Por el courier"]));
    expect(texts).toContain("Generado por POWIP · Impreso el 18/11/2026 10:30 por Ana Pérez · Página 1 de 1");
  });
});
