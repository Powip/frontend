/**
 * Contrato de `GET {ms-ventas}/administracion/*` (FEAT-34 Fase 2). Copia de
 * `ms-ventas/src/administracion/administracion.types.ts`: /administracion deja de bajar pedidos crudos y recibe los
 * agregados ya calculados en el servidor.
 *
 * Montos en number con 2 decimales. Días `YYYY-MM-DD` en hora Lima. La venta se fecha el día de su ENTREGA (D1).
 */

export const ZONA_ADMINISTRACION = "America/Lima";

/** Estados de un pedido que está en la calle (C7): con guía, en envío o despachado. */
export const ESTADOS_EN_TRANSITO = ["ASIGNADO_A_GUIA", "EN_ENVIO", "DESPACHADO"] as const;
export type EstadoEnTransito = (typeof ESTADOS_EN_TRANSITO)[number];

export interface MontoYPedidos {
  pedidos: number;
  monto: number;
}

/** Lo que se suma de un grupo de ventas (pedidos ENTREGADO, no LEAD, por fecha de entrega). */
export interface Agregado {
  pedidos: number;
  /** Σ `grandTotal`. */
  monto: number;
  /** Σ `quantity` de las líneas que no son SERVICE. */
  unidades: number;
  /** Costo de producto de las ventas que lo tienen (las «sin costo» no suman). */
  costo: number;
  /** Σ `channel_fee`. */
  comisiones: number;
  /** Flete (D9): `monto` de los pedidos con flete conocido y cuántos son. */
  flete: { monto: number; pedidos: number };
  sinCosto: MontoYPedidos;
  costoDudoso: MontoYPedidos;
}

export interface AgregadoDia extends Agregado {
  dia: string;
}

export interface AgregadoCanal extends Agregado {
  /** `salesChannel` tal como está guardado (sin espacios en los bordes); null si viene vacío. */
  canal: string | null;
}

export interface DiaCanal {
  dia: string;
  canal: string | null;
  pedidos: number;
  monto: number;
  unidades: number;
}

export interface ProductoVendido {
  /** SKU; sin SKU, el id de la variante; sin variante, el nombre; si no, «sin-sku» (la clave de Margen x Producto). */
  clave: string;
  sku: string;
  variantId: string | null;
  producto: string;
  /** Valores de `attributes` de la línea unidos con « · » (lo que el front muestra como variante). */
  variante: string;
  unidades: number;
  /** Σ `subtotal` de las líneas. */
  ventas: number;
  unidadesConCosto: number;
  ventasConCosto: number;
  /** Σ `unit_cost × quantity` de las líneas con costo. */
  costo: number;
  /** Líneas con costo ≥ precio de lista (costo dudoso). */
  lineasDudosas: number;
}

/**
 * Pedidos venta (no LEAD) CREADOS en el periodo (día de Lima) que todavía no se entregaron ni se anularon, y lo que ya
 * se cobró de ellos (pagos PAID, sin los INCOMPLETE): plata que entró y todavía no es venta (Resumen › Adelantos).
 */
export interface EnCursoPeriodo {
  pedidos: number;
  adelantos: MontoYPedidos;
}

export interface ResultadosAdministracion {
  desde: string;
  hasta: string;
  zonaHoraria: typeof ZONA_ADMINISTRACION;
  fecha: "entrega";
  totales: Agregado;
  porDia: AgregadoDia[];
  porCanal: AgregadoCanal[];
  porDiaCanal: DiaCanal[];
  porProducto: ProductoVendido[];
  calidad: {
    /** Ventas sin entrada a ENTREGADO en el historial: se fecharon por su creación. */
    entregasSinHistorial: number;
  };
  enCurso: EnCursoPeriodo;
}

export interface SaldoEnTransito {
  pedidos: number;
  saldo: number;
}

export interface CourierEnTransito extends SaldoEnTransito {
  /** `courier` del pedido tal como está guardado (sin espacios en los bordes); null si no tiene. */
  courier: string | null;
  /** Pedidos de ese courier que todavía deben algo. */
  conSaldo: number;
}

export interface EnTransitoAdministracion {
  hoy: string;
  desde: string;
  pedidos: number;
  saldo: number;
  porEstado: Record<EstadoEnTransito, SaldoEnTransito>;
  porCourier: CourierEnTransito[];
  antiguos: { dias: number; pedidos: number; saldo: number };
}
