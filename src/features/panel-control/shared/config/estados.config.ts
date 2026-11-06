import type { EstadoPanel, EstadoPanelDefinicion } from "../models/estado-pedido.model";

export const ESTADOS_PANEL_DEFINICION: Record<EstadoPanel, EstadoPanelDefinicion> = {
  PENDIENTE: {
    estado: "PENDIENTE",
    etiqueta: "Pendiente",
    descripcion: "Lead ingresado, aún sin confirmar por llamada",
    tono: "warn",
    esVenta: false,
  },
  LLAMADO: {
    estado: "LLAMADO",
    etiqueta: "Llamado",
    descripcion:
      "Confirmado por la confirmadora (lead) o registrado por la vendedora (venta directa). Desde aquí es venta",
    tono: "info",
    esVenta: true,
  },
  PREPARADO: {
    estado: "PREPARADO",
    etiqueta: "Preparado",
    descripcion: "Empacado en almacén",
    tono: "info",
    esVenta: true,
  },
  CON_GUIA: {
    estado: "CON_GUIA",
    etiqueta: "Con guía",
    descripcion: "Guía del courier generada",
    tono: "info",
    esVenta: true,
  },
  EN_ENVIO: {
    estado: "EN_ENVIO",
    etiqueta: "En envío",
    descripcion: "Recogido por el courier",
    tono: "info",
    esVenta: true,
  },
  ENTREGADO: {
    estado: "ENTREGADO",
    etiqueta: "Entregado",
    descripcion: "Entregado al cliente; el dinero aún lo tiene el courier",
    tono: "ok",
    esVenta: true,
  },
  PAGADO: {
    estado: "PAGADO",
    etiqueta: "Pagado",
    descripcion: "Dinero recibido (liquidación courier, prepago o caja)",
    tono: "ok",
    esVenta: true,
  },
  ANULADO: {
    estado: "ANULADO",
    etiqueta: "Anulado",
    descripcion: "Lead que no se confirmó (con motivo obligatorio)",
    tono: "bad",
    esVenta: false,
  },
  RECHAZADO: {
    estado: "RECHAZADO",
    etiqueta: "Rechazado",
    descripcion: "El cliente no recibió el pedido (con motivo obligatorio)",
    tono: "bad",
    esVenta: true,
  },
};
