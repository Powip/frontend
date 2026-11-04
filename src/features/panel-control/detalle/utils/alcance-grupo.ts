import { formatDayKey, formatRange } from "../../shared/utils/format";
import type { DetalleGrupo } from "../models/detalle.model";

export interface TextoAlcance {
  periodo: string;
  descripcion: string;
}

export function textoAlcance(grupo: DetalleGrupo | null, periodo: string): TextoAlcance {
  switch (grupo?.alcance) {
    case "actual":
      if (grupo.tipo === "reservados") {
        // El stock es físico: el servidor solo aplica la tienda y no mira canal, entrada, cobro, zona ni asesor.
        return {
          periodo: "Estado actual (no depende del periodo)",
          descripcion:
            "Estado actual: pedidos que hoy reservan este producto. No depende del periodo y solo respeta la tienda donde está el stock (no canal, zona ni asesor). Si el producto está en varias tiendas se listan los pedidos de todas las tiendas, salvo que filtres una.",
        };
      }
      if (grupo.tipo === "por_liquidar_actual") {
        return {
          periodo: "Estado actual (no depende del periodo)",
          descripcion:
            "Estado actual: entregados con courier que aún no se liquidan, de los últimos 365 días (hasta 5000 pedidos). No depende del periodo; respeta tienda, canal y demás filtros.",
        };
      }
      return {
        periodo: "Estado actual (no depende del periodo)",
        descripcion:
          "Estado actual: no depende del periodo; respeta tienda, canal y demás filtros.",
      };
    case "historial":
      return {
        periodo: "Historial completo del cliente (no depende del periodo)",
        descripcion: "Historial completo del cliente: incluye compras fuera del periodo.",
      };
    case "despacho": {
      if (!grupo.params.dia_despacho) {
        return {
          periodo: `${periodo} por fecha de despacho`,
          descripcion: `Por fecha de despacho (${periodo}): incluye pedidos ingresados antes del periodo.`,
        };
      }
      const dia = formatDayKey(grupo.params.dia_despacho);
      return {
        periodo: `Despachados el ${dia} (fecha de despacho)`,
        descripcion: `Por fecha de despacho (${dia}): incluye pedidos ingresados antes del periodo.`,
      };
    }
    case "rango": {
      const rango =
        grupo.params.desde && grupo.params.hasta
          ? formatRange(grupo.params.desde, grupo.params.hasta)
          : "";
      return {
        periodo: `${rango} por fecha de ingreso`,
        descripcion: `Rango propio del gráfico (${rango}) por fecha de ingreso: no depende del periodo seleccionado.`,
      };
    }
    case "caja":
      return {
        periodo: `${periodo} por fecha del dinero`,
        descripcion: `Por fecha del dinero (${periodo}): cuenta el día en que se registró el pago o salió el dinero, aunque el pedido haya ingresado antes del periodo. La cantidad de pedidos coincide con la fila; la facturación de arriba es el total de esos pedidos y puede diferir del monto movido (comisiones, pasarela, fletes o pagos parciales).`,
      };
    default:
      return { periodo, descripcion: `Periodo ${periodo}.` };
  }
}
