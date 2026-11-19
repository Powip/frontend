// FEAT-24 H10 — tipos de movimiento del libro de stock (enum `MovementType` de
// ms-logistics, H1-B a H12) con su nombre en español. Los usa el kardex
// (Inventario › Movimientos), su filtro por tipo y el Excel.

/** Nombre de cada tipo. Los viejos (IN/OUT/…) siguen saliendo en las filas anteriores al libro. */
export const KARDEX_TYPE_LABELS: Record<string, string> = {
  // Anteriores al libro de stock
  IN: "Ingreso",
  OUT: "Egreso",
  ADJUSTMENT: "Ajuste",
  TRANSFER: "Traslado",
  RESERVED: "Reserva",
  RELEASED: "Liberación",
  COMMITTED: "Venta entregada",
  // H1-B
  SALDO_INICIAL: "Saldo inicial",
  ANULACION: "Anulación",
  // H2: pedido despachado y su devolución
  DESPACHO: "Salida por despacho",
  ENTREGA: "Entrega del pedido",
  DEVOLUCION_EN_CAMINO: "Devolución en camino",
  DEVOLUCION_REINGRESO: "Reingreso por devolución",
  DEVOLUCION_MERMA: "Merma de devolución",
  // H3: compras
  ENTRADA_COMPRA: "Entrada por compra",
  DEVOLUCION_PROVEEDOR: "Devolución a proveedor",
  // H5: traslados, ajustes y mermas
  TRASLADO_SALIDA: "Traslado · salida",
  TRASLADO_EN_CAMINO: "Traslado · en camino",
  TRASLADO_ENTRADA: "Traslado · entrada",
  TRASLADO_DIFERENCIA: "Traslado · diferencia",
  AJUSTE_POSITIVO: "Ajuste +",
  AJUSTE_NEGATIVO: "Ajuste −",
  MERMA: "Merma",
  // H12: cambios de producto
  CAMBIO_ENTRADA: "Cambio · entra",
  CAMBIO_SALIDA: "Cambio · sale",
};

/**
 * Tipos nuevos del libro: su nombre manda sobre el motivo (p. ej. una devolución en camino lleva el motivo
 * `order.cancelled:N`, que sin esto se leería como «Reserva liberada»). El motivo pasa al detalle.
 */
export const LEDGER_FIRST_TYPES: ReadonlySet<string> = new Set([
  "DESPACHO",
  "ENTREGA",
  "DEVOLUCION_EN_CAMINO",
  "DEVOLUCION_REINGRESO",
  "DEVOLUCION_MERMA",
  "ENTRADA_COMPRA",
  "DEVOLUCION_PROVEEDOR",
  "TRASLADO_SALIDA",
  "TRASLADO_EN_CAMINO",
  "TRASLADO_ENTRADA",
  "TRASLADO_DIFERENCIA",
  "AJUSTE_POSITIVO",
  "AJUSTE_NEGATIVO",
  "MERMA",
  "CAMBIO_ENTRADA",
  "CAMBIO_SALIDA",
]);

/** Opciones del filtro por tipo, en el orden del ciclo (los viejos al final). */
export const KARDEX_TYPE_OPTIONS: Array<[string, string]> = [
  "ENTRADA_COMPRA",
  "DEVOLUCION_PROVEEDOR",
  "RESERVED",
  "RELEASED",
  "DESPACHO",
  "ENTREGA",
  "DEVOLUCION_EN_CAMINO",
  "DEVOLUCION_REINGRESO",
  "DEVOLUCION_MERMA",
  "TRASLADO_SALIDA",
  "TRASLADO_EN_CAMINO",
  "TRASLADO_ENTRADA",
  "TRASLADO_DIFERENCIA",
  "AJUSTE_POSITIVO",
  "AJUSTE_NEGATIVO",
  "MERMA",
  "CAMBIO_ENTRADA",
  "CAMBIO_SALIDA",
  "SALDO_INICIAL",
  "ANULACION",
  "COMMITTED",
  "IN",
  "OUT",
  "ADJUSTMENT",
  "TRANSFER",
].map((type) => [type, KARDEX_TYPE_LABELS[type]]);

/** Nombre del tipo; uno desconocido se muestra tal cual (nunca vacío). */
export const kardexTypeLabel = (type: string | null | undefined): string =>
  (type && KARDEX_TYPE_LABELS[type]) || type || "Otro movimiento";
