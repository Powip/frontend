import type { PanelSubtabId } from "../../shared/models/panel-navigation.model";
import { formatNumber, formatSoles } from "../../shared/utils/format";
import { type AccionHoy, URGENCIA_ORDEN } from "../models/resumen.model";

export interface AccionTexto {
  titulo: string;
  detalle: string;
}

const plural = (n: number, singular: string, pluralTexto: string) =>
  n === 1 ? singular : pluralTexto;

export function textoAccion(accion: AccionHoy): AccionTexto {
  const n = accion.pedidos;
  const monto = formatSoles(accion.monto);
  switch (accion.id) {
    case "leads_sin_llamar":
      return {
        titulo: `${formatNumber(n)} ${plural(n, "lead sin llamar", "leads sin llamar")} hace más de 1 hora`,
        detalle: `Valen ${monto}. Cada hora de espera baja la confirmación.`,
      };
    case "ventas_sin_guia":
      return {
        titulo: `${formatNumber(n)} ${plural(n, "venta sin guía", "ventas sin guía")} hace más de 24 horas`,
        detalle: `${monto} detenidos en almacén.`,
      };
    case "courier_no_liquida":
      return {
        titulo: `${accion.courier ?? "Courier"} no liquida ${monto}`,
        detalle: `${formatNumber(n)} ${plural(n, "pedido entregado pasó", "pedidos entregados pasaron")} el plazo de ${accion.plazoDias ?? "—"} días.`,
      };
    case "productos_agotados":
      return {
        titulo: `${formatNumber(n)} ${plural(n, "venta tiene", "ventas tienen")} productos agotados`,
        detalle: accion.productos.length
          ? `${accion.productos.join(", ")}.`
          : "Productos sin stock disponible.",
      };
    case "envios_retrasados":
      return {
        titulo: `${formatNumber(n)} ${plural(n, "envío retrasado", "envíos retrasados")}`,
        detalle: "Superan el tiempo normal de su courier.",
      };
    default:
      return {
        titulo: `${formatNumber(n)} ${plural(n, "anulación sin motivo", "anulaciones sin motivo")}`,
        detalle: "En el periodo. Sin motivo no se sabe por qué se pierden los leads.",
      };
  }
}

export function ordenarAcciones(acciones: AccionHoy[]): AccionHoy[] {
  return [...acciones].sort(
    (a, b) =>
      URGENCIA_ORDEN[a.urgencia] - URGENCIA_ORDEN[b.urgencia] || (b.monto ?? 0) - (a.monto ?? 0),
  );
}

export const SUBPESTANA_ACCION: Partial<Record<AccionHoy["id"], PanelSubtabId>> = {
  ventas_sin_guia: "cola",
  envios_retrasados: "cola",
  productos_agotados: "inventario",
  courier_no_liquida: "cobranza",
};
