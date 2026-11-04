import { whatsappLink } from "../../shared/utils/whatsapp-link";
import type { AccionPedidoId } from "../models/accion-pedido.model";

export interface DatosAccion {
  pedido?: string | null;
  courier?: string | null;
  monto?: number | null;
  telefono?: string | null;
}

export type DestinoAccion = { tipo: "enlace"; href: string } | { tipo: "whatsapp"; href: string };

function texto(valor?: string | null): string {
  return (valor ?? "").trim();
}

function soles(monto?: number | null): string {
  if (typeof monto !== "number" || !Number.isFinite(monto)) return "";
  return `S/ ${monto.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Mensaje de WhatsApp de una acción, sin "undefined"/"null"/"NaN" aunque falten datos. */
export function mensajeAccion(accion: AccionPedidoId, datos: DatosAccion = {}): string {
  const pedido = texto(datos.pedido);
  const courier = texto(datos.courier);
  const monto = soles(datos.monto);
  switch (accion) {
    case "avisar_cliente":
      return pedido
        ? `Hola, te escribimos por tu pedido ${pedido}. Hoy no tenemos stock completo; te avisamos apenas esté disponible.`
        : "Hola, te escribimos por tu pedido. Hoy no tenemos stock completo; te avisamos apenas esté disponible.";
    case "reclamar_courier":
      return `Hola${courier ? ` ${courier}` : ""}, queremos reclamar${pedido ? ` el pedido ${pedido}` : " un envío"}: superó el tiempo normal de entrega. ¿Nos confirman su estado?`;
    case "pedir_liquidacion":
      return `Hola${courier ? ` ${courier}` : ""}, queremos coordinar la liquidación de los pedidos entregados${monto ? ` (${monto} por liquidar)` : ""}. ¿Nos indican la fecha de pago?`;
    case "coordinar_recojo":
      return `Hola${courier ? ` ${courier}` : ""}, queremos coordinar el recojo${pedido ? ` del pedido ${pedido}` : " de los pedidos con guía"}.`;
    default:
      return pedido
        ? `Hola, te escribimos por el pedido ${pedido}.`
        : "Hola, te escribimos por tu pedido.";
  }
}

const PEDIDOS = "/operaciones/pedidos";

function conBusqueda(tab: string, pedido?: string | null): string {
  const q = texto(pedido);
  return `${PEDIDOS}?tab=${tab}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
}

/**
 * A dónde lleva cada acción: pantalla existente (enlace) o WhatsApp con mensaje listo.
 * null = sin destino todavía (completar_motivo, asignar_canal): sigue «Pendiente».
 * Solo se usan query params que la pantalla destino ya lee (pedidos: tab, q).
 */
export function destinoAccion(
  accion: AccionPedidoId,
  datos: DatosAccion = {},
): DestinoAccion | null {
  switch (accion) {
    case "preparar":
      return { tipo: "enlace", href: conBusqueda("pendientes", datos.pedido) };
    case "asignar_guia":
      return { tipo: "enlace", href: conBusqueda("despachar", datos.pedido) };
    case "coordinar_recojo":
      return { tipo: "enlace", href: "/operaciones/guias?tab=agenda" };
    case "llamar":
      return { tipo: "enlace", href: "/atencion-cliente" };
    case "reclamar_courier":
    case "pedir_liquidacion":
      return { tipo: "enlace", href: "/operaciones/liquidaciones" };
    case "avisar_cliente":
      return {
        tipo: "whatsapp",
        href: whatsappLink({ telefono: datos.telefono, texto: mensajeAccion(accion, datos) }),
      };
    default:
      return null;
  }
}
