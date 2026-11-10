import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MovementHistoryTable } from "../MovementHistoryTable";
import { fetchScopedInventoryMovements, type InventoryMovement } from "@/services/inventoryMovementService";
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { company: { id: "company-a" }, user: { id: "user-a" }, accessToken: "test-token" } }) }));
jest.mock("@/services/inventoryMovementService", () => ({ ...jest.requireActual("@/services/inventoryMovementService"), fetchScopedInventoryMovements: jest.fn() }));
jest.mock("@/services/orderNumbersService", () => ({ resolveOrderNumbers: jest.fn().mockResolvedValue({}) }));
import { resolveOrderNumbers } from "@/services/orderNumbersService";
const fetch = jest.mocked(fetchScopedInventoryMovements);
const warehouses = [{ id: "warehouse-a", name: "Principal", storeId: "store-a" }];
const rows = Array.from({ length: 17 }, (_, index) => ({ id: `movement-${index}`, type: "IN", quantity: 2, reason: null, companyId: "company-a", userEmail: null, userName: null, referenceId: null, created_at: "2026-10-12T19:00:00Z", inventoryItem: { id: `item-${index}`, sku: `SKU-${index}`, product: { name: `Producto ${index}` } } })) as InventoryMovement[];
function setup(scope: "business" | "store" = "business") { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><MovementHistoryTable companyId="company-a" scope={scope} inventories={warehouses} /></QueryClientProvider>); }
beforeEach(() => { fetch.mockReset(); fetch.mockResolvedValue(rows); });
it("paginates complete history and searches later pages without dropping same-day records", async () => {
  setup(); await screen.findByText("Producto 0");
  expect(screen.queryByText("Producto 16")).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Nombre o SKU..."), { target: { value: "SKU-16" } });
  await screen.findByText("Producto 16");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/incluidos registros históricos/)).toBeInTheDocument();
});
it("uses the validated store warehouses when requesting store history", async () => {
  setup("store"); await screen.findByText("Producto 0");
  expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ scope: "store", inventories: warehouses, companyId: "company-a", accessToken: "test-token" }));
});
it("shows error and retry without false empty history, then recovers", async () => {
  fetch.mockRejectedValueOnce(new Error("401 Unauthorized")).mockResolvedValueOnce(rows); setup();
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("401 Unauthorized"));
  expect(screen.queryByText("No se encontraron movimientos.")).not.toBeInTheDocument();
  expect(screen.queryByText(/0 registros/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" })); await screen.findByText("Producto 0");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

// Columnas del mockup v6 (vistainv.html, pantalla Historial): Tipo va antes del producto y el motivo cierra la fila.
const COLUMNS = ["Fecha y hora", "Tipo", "Producto / SKU", "Almacén", "Físico", "Reservado", "Referencia", "Usuario", "Motivo"];
const COL = { fecha: 0, tipo: 1, producto: 2, almacen: 3, fisico: 4, reservado: 5, referencia: 6, usuario: 7, motivo: 8 };

describe("FEAT-24 H0", () => {
  const ORDER = "0f8fad5b-d9cb-469f-a165-70867728950e";
  const one = (patch: Partial<InventoryMovement>) => [{ ...rows[0], ...patch }] as InventoryMovement[];

  it("tiene columnas Físico y Reservado y pinta la reserva en Reservado", async () => {
    fetch.mockResolvedValue(one({ type: "RESERVED", reason: "SALE_RESERVATION", quantity: 2 }));
    setup(); await screen.findByText("Reserva de venta");
    const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual(COLUMNS);
    const cells = screen.getByText("Reserva de venta").closest("tr")!.querySelectorAll("td");
    expect(cells[4].textContent).toBe("—");
    expect(cells[5].textContent).toBe("+2");
  });

  it("muestra el número del pedido en vez del UUID", async () => {
    jest.mocked(resolveOrderNumbers).mockResolvedValue({ [ORDER]: "ORD-000123" });
    fetch.mockResolvedValue(one({ type: "RESERVED", reason: "order.created:1", referenceId: ORDER }));
    setup(); await screen.findByText("ORD-000123");
    expect(screen.queryByText(ORDER)).not.toBeInTheDocument();
  });

  it("sin nombre muestra el email de quien lo hizo, no Sistema", async () => {
    fetch.mockResolvedValue(one({ type: "IN", reason: "ADJUSTMENT_IN - count - Conteo", userName: null, userEmail: "jefe@x.pe" }));
    setup(); await screen.findByText("Producto 0");
    const cells = screen.getByText("Producto 0").closest("tr")!.querySelectorAll("td");
    expect(cells[7].textContent).toBe("jefe@x.pe");
  });

  it("sin nombre ni email muestra Sistema", async () => {
    fetch.mockResolvedValue(one({ userName: null, userEmail: null }));
    setup(); await screen.findByText("Producto 0");
    const cells = screen.getByText("Producto 0").closest("tr")!.querySelectorAll("td");
    expect(cells[7].textContent).toBe("Sistema");
  });

  it("sin número disponible muestra Pedido, nunca el UUID", async () => {
    jest.mocked(resolveOrderNumbers).mockResolvedValue({});
    fetch.mockResolvedValue(one({ type: "RESERVED", reason: "order.created:1", referenceId: ORDER }));
    setup(); await screen.findByText("Reserva por pedido");
    expect(await screen.findByText("Pedido")).toBeInTheDocument();
    expect(screen.queryByText(ORDER)).not.toBeInTheDocument();
  });
});

describe("FEAT-24 H1-B F1: historial con saldo y almacén", () => {
  const ORDER = "0f8fad5b-d9cb-469f-a165-70867728950e";
  const one = (patch: Record<string, unknown>) => [{ ...rows[0], ...patch }] as unknown as InventoryMovement[];
  const rowOf = async (patch: Record<string, unknown>) => { fetch.mockResolvedValue(one(patch)); setup(); const name = await screen.findByText("Producto 0"); return name.closest("tr")!.querySelectorAll("td"); };

  it("las columnas siguen el orden del mockup", async () => {
    await rowOf({});
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(COLUMNS);
  });

  it("fila nueva: el físico sale de physicalDelta con su saldo y el reservado que no cambió es —", async () => {
    const cells = await rowOf({ type: "OUT", quantity: 2, reason: "SHRINKAGE", physicalDelta: -2, reservedDelta: 0, physicalAfter: 12, reservedAfter: 3 });
    expect(within(cells[COL.fisico]).getByText("-2")).toBeInTheDocument();
    expect(within(cells[COL.fisico]).getByText("saldo 12")).toBeInTheDocument();
    expect(cells[COL.reservado].textContent).toBe("—");
  });

  it("fila nueva de reserva: el reservado lleva su saldo y el físico que no cambió es —", async () => {
    const cells = await rowOf({ type: "RESERVED", quantity: 2, reason: "SALE_RESERVATION", physicalDelta: 0, reservedDelta: 2, physicalAfter: 12, reservedAfter: 5 });
    expect(cells[COL.fisico].textContent).toBe("—");
    expect(within(cells[COL.reservado]).getByText("+2")).toBeInTheDocument();
    expect(within(cells[COL.reservado]).getByText("saldo 5")).toBeInTheDocument();
  });

  it("fila nueva que mueve los dos saldos muestra los dos", async () => {
    const cells = await rowOf({ type: "TRANSFER", quantity: 4, reason: "RECONCILE_MERGE_IN reserved=1", physicalDelta: 4, reservedDelta: 1, physicalAfter: 9, reservedAfter: 1 });
    expect(cells[COL.fisico].textContent).toBe("+4saldo 9");
    expect(cells[COL.reservado].textContent).toBe("+1saldo 1");
  });

  it("fila nueva con saldo 0 lo muestra (0 no es 'sin dato')", async () => {
    const cells = await rowOf({ type: "OUT", quantity: 3, reason: "SHRINKAGE", physicalDelta: -3, reservedDelta: 0, physicalAfter: 0, reservedAfter: 0 });
    expect(within(cells[COL.fisico]).getByText("saldo 0")).toBeInTheDocument();
  });

  it.each([
    ["campos null", { physicalDelta: null, reservedDelta: null, physicalAfter: null, reservedAfter: null }],
    ["campos ausentes (backend anterior)", {}],
  ])("fila vieja con %s: se calcula por type y quantity, sin saldo", async (_name, fields) => {
    const cells = await rowOf({ type: "OUT", quantity: 3, reason: "SHRINKAGE", ...fields });
    expect(cells[COL.fisico].textContent).toBe("-3");
    expect(cells[COL.reservado].textContent).toBe("—");
    expect(screen.queryByText(/saldo/)).not.toBeInTheDocument();
  });

  it("fila vieja de reserva sigue en Reservado y sin saldo", async () => {
    const cells = await rowOf({ type: "RESERVED", quantity: 2, reason: "SALE_RESERVATION", physicalDelta: null, reservedDelta: null, physicalAfter: null, reservedAfter: null });
    expect(cells[COL.fisico].textContent).toBe("—");
    expect(cells[COL.reservado].textContent).toBe("+2");
    expect(screen.queryByText(/saldo/)).not.toBeInTheDocument();
  });

  it("Almacén muestra el nombre del movimiento", async () => {
    const cells = await rowOf({ inventoryItem: { ...rows[0].inventoryItem, inventory: { id: "w-1", name: "Almacén Lima" } } });
    expect(cells[COL.almacen].textContent).toBe("Almacén Lima");
  });

  it.each([
    ["inventory null", { inventory: null }],
    ["sin el campo (backend anterior)", {}],
    ["nombre vacío", { inventory: { id: "w-1", name: "" } }],
  ])("Almacén muestra — con %s", async (_name, extra) => {
    const cells = await rowOf({ inventoryItem: { ...rows[0].inventoryItem, ...extra } });
    expect(cells[COL.almacen].textContent).toBe("—");
  });

  it("en una tienda, sin almacén en la respuesta, usa el nombre del almacén validado de esa tienda", async () => {
    const cells = await rowOf({ inventoryName: "Principal" });
    expect(cells[COL.almacen].textContent).toBe("Principal");
  });

  it("Motivo muestra la nota del ajuste y — cuando no hay", async () => {
    fetch.mockResolvedValue([
      { ...rows[0], id: "m-a", reason: "ADJUSTMENT_OUT - dano - Caja mojada", type: "OUT" },
      { ...rows[1], id: "m-b", reason: "SALE_RESERVATION", type: "RESERVED" },
    ] as unknown as InventoryMovement[]);
    setup(); await screen.findByText("Producto 0");
    const [first, second] = screen.getAllByRole("row").slice(1).map((tr) => tr.querySelectorAll("td"));
    expect(first[COL.motivo].textContent).toBe("Caja mojada");
    expect(first[COL.tipo].textContent).toBe("Ajuste · Daño");
    expect(second[COL.motivo].textContent).toBe("—");
  });

  it("la referencia va en fuente monoespaciada y es el número legible", async () => {
    jest.mocked(resolveOrderNumbers).mockResolvedValue({ [ORDER]: "ORD-000123" });
    const cells = await rowOf({ type: "RESERVED", reason: "order.created:1", referenceId: ORDER });
    await screen.findByText("ORD-000123");
    expect(cells[COL.referencia]).toHaveClass("font-mono");
  });

  it("la referencia nunca muestra un UUID, tampoco el que llega en referenceNumber", async () => {
    const cells = await rowOf({ type: "IN", reason: "algo raro", referenceId: ORDER, referenceNumber: ORDER });
    expect(cells[COL.referencia].textContent).toBe("—");
    expect(screen.queryByText(ORDER)).not.toBeInTheDocument();
  });

  it("un movimiento de traslado muestra su TRA- legible", async () => {
    const cells = await rowOf({ type: "TRANSFER", reason: "algo raro", referenceId: "TRA-0042" });
    expect(cells[COL.referencia].textContent).toBe("TRA-0042");
  });

  it("los tipos SALDO_INICIAL y ANULACION tienen nombre en la columna Tipo", async () => {
    fetch.mockResolvedValue([
      { ...rows[0], id: "m-s", type: "SALDO_INICIAL", reason: null, quantity: 0, physicalDelta: 12, reservedDelta: 0, physicalAfter: 12, reservedAfter: 0 },
      { ...rows[1], id: "m-x", type: "ANULACION", reason: null, quantity: 2, physicalDelta: -2, reservedDelta: 0, physicalAfter: 10, reservedAfter: 0 },
    ] as unknown as InventoryMovement[]);
    setup(); await screen.findByText("Producto 0");
    const [first, second] = screen.getAllByRole("row").slice(1).map((tr) => tr.querySelectorAll("td"));
    expect(first[COL.tipo].textContent).toBe("Saldo inicial");
    expect(first[COL.fisico].textContent).toBe("+12saldo 12");
    expect(second[COL.tipo].textContent).toBe("Anulación");
    expect(second[COL.fisico].textContent).toBe("-2saldo 10");
  });

  it("el estado vacío y el de error ocupan todas las columnas", async () => {
    fetch.mockResolvedValue([]);
    setup(); await screen.findByText("No se encontraron movimientos con los filtros aplicados.");
    expect(screen.getByText("No se encontraron movimientos con los filtros aplicados.")).toHaveAttribute("colspan", String(COLUMNS.length));
  });

  it("el estado de error ocupa todas las columnas", async () => {
    fetch.mockRejectedValue(new Error("500"));
    setup(); await screen.findByText("Historial no disponible.");
    expect(screen.getByText("Historial no disponible.")).toHaveAttribute("colspan", String(COLUMNS.length));
  });
});
