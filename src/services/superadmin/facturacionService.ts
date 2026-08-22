import { EstadoFactura, IFactura } from "@/interfaces/superadmin";
import { facturasMock } from "@/mocks/superadmin";
import { mockDelay, matchesQuery, paginate, PageParams, PagedResponse } from "./shared";

export interface FacturasFilters extends PageParams {
  q?: string;
  estado?: EstadoFactura | "todos";
}

export async function getFacturas(filters: FacturasFilters = {}): Promise<PagedResponse<IFactura>> {
  let items = [...facturasMock];
  if (filters.estado && filters.estado !== "todos") items = items.filter((f) => f.estado === filters.estado);
  if (filters.q) items = items.filter((f) => matchesQuery([f.empresaNombre, f.id, f.plan], filters.q!));
  return mockDelay(paginate(items, filters));
}

/** Regla de oro: nunca recalcular dinero — solo sumar montos que ya vienen en el mock. */
export async function getKpisFacturacion() {
  const facturadoMes = facturasMock.reduce((sum, f) => sum + f.monto, 0);
  const cobrado = facturasMock.filter((f) => f.estado === "pagado").reduce((sum, f) => sum + f.monto, 0);
  const pendiente = facturasMock.filter((f) => f.estado === "pendiente").reduce((sum, f) => sum + f.monto, 0);
  const vencido = facturasMock.filter((f) => f.estado === "vencido").reduce((sum, f) => sum + f.monto, 0);
  return mockDelay({ facturadoMes, cobrado, pendiente, vencido });
}

/** Simula PATCH /facturas/{id}/pagar — muta el mock en memoria. */
export async function marcarFacturaPagada(id: string): Promise<IFactura | null> {
  const factura = facturasMock.find((f) => f.id === id);
  if (!factura) return mockDelay(null);
  factura.estado = "pagado";
  factura.diasVencida = undefined;
  factura.reintentos = undefined;
  return mockDelay(factura, 300);
}

/** Simula POST /facturas/{id}/reenviar — no hay backend real, solo confirma el envío. */
export async function reenviarFactura(id: string): Promise<{ id: string }> {
  return mockDelay({ id }, 300);
}

export async function getFacturasVencidas(): Promise<IFactura[]> {
  return mockDelay(facturasMock.filter((f) => f.estado === "vencido"));
}

/** Simula POST /facturas/{id}/recordar-cobro (8.23: recordatorio a 3, 7 y 15 días). */
export async function recordarCobro(id: string): Promise<IFactura | null> {
  const factura = facturasMock.find((f) => f.id === id);
  if (!factura) return mockDelay(null);
  factura.reintentos = (factura.reintentos ?? 0) + 1;
  return mockDelay(factura, 300);
}
