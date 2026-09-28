import type { ConceptoEgresoCaja, FuenteIngresoCaja } from "../../../finanzas/models/caja.model";
import type { BucketDeuda } from "../../../finanzas/models/cobranza.model";
import type { PedidoDemo } from "./demo-universe";

export type ConceptoCaja = FuenteIngresoCaja | ConceptoEgresoCaja;

export interface MovimientoPedido {
  fecha: number;
  monto: number;
}

const redondear = (valor: number) => Math.round(valor * 100) / 100;

export const GASTOS_FIJOS_MENSUALES_DEMO_POR_TIENDA = 9000;

export function movimientosCaja(pedido: PedidoDemo, concepto: ConceptoCaja): MovimientoPedido[] {
  const { tCobro, tDesp, tEnt, neto } = pedido;
  switch (concepto) {
    case "liquidacion_courier":
      return pedido.usaCourier && pedido.cobro === "cod" && !pedido.rechazo && tCobro !== null
        ? [{ fecha: tCobro, monto: neto }]
        : [];
    case "liquidacion_marketplace":
      return pedido.cobro === "mkp" && !pedido.rechazo && tCobro !== null
        ? [{ fecha: tCobro, monto: redondear(neto * (1 - pedido.comisionPct)) }]
        : [];
    case "caja_pos":
      return !pedido.usaCourier && tCobro !== null ? [{ fecha: tCobro, monto: neto }] : [];
    case "prepago":
      return pedido.cobro === "pre" && tCobro !== null ? [{ fecha: tCobro, monto: neto }] : [];
    case "fletes": {
      if (tDesp === null || pedido.fleteBase === 0) return [];
      const salida = [{ fecha: tDesp, monto: pedido.fleteBase }];
      if (pedido.rechazo && pedido.fleteIdaYVuelta && tEnt !== null) {
        salida.push({ fecha: tEnt, monto: pedido.fleteBase });
      }
      return salida;
    }
    case "pasarela":
      return pedido.cobro === "pre" && pedido.pasarelaPct > 0 && tCobro !== null
        ? [{ fecha: tCobro, monto: redondear(neto * pedido.pasarelaPct) }]
        : [];
    case "comisiones_aliados":
      return pedido.cobro === "cod" && pedido.comisionPct > 0 && !pedido.rechazo && tCobro !== null
        ? [{ fecha: tCobro, monto: redondear(neto * pedido.comisionPct) }]
        : [];
    case "reembolsos":
      return pedido.cobro === "pre" && pedido.rechazo && tEnt !== null
        ? [{ fecha: tEnt, monto: neto }]
        : [];
    default:
      return [];
  }
}

export function bucketDeuda(dias: number): BucketDeuda {
  if (dias < 4) return "0_3d";
  if (dias < 8) return "4_7d";
  if (dias < 15) return "8_14d";
  return "mas_14d";
}
