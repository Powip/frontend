import type { DetalleEstadoFila, DetallePedidoFila } from "../../detalle/models/detalle.model";

export interface MisVentasPanel {
  asesorId: string;
  puesto: number | null;
  totalVendedoras: number;
  vendi: { facturacion: number; ventas: number; ticket: number | null };
  meta: { metaPeriodo: number | null; avance: number | null; falta: number | null };
  pagado: { pagado: number; efectividadEntrega: number | null; perdido: number };
  comisionEstimada?: { monto: number; porcentajePagado: number; porcentajeUpsell: number };
  porEstado: DetalleEstadoFila[];
  ranking: { asesorId: string; nombre: string; facturacion: number; esYo: boolean }[];
  noCobrados: DetallePedidoFila[];
}
