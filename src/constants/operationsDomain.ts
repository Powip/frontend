// Constantes de dominio compartidas por todo el módulo Operaciones nuevo
// (Tablero, Pedidos, Guías & Courier, Liquidaciones, Mapa del módulo).
//
// Se centralizan acá para que las 5 pantallas usen exactamente las mismas
// opciones — hoy están duplicadas con pequeñas diferencias entre
// operaciones/page.tsx, centro-envios/components/FiltersSheet.tsx y
// seguimiento/page.tsx (ver informe de brechas de backend/frontend).

export interface ZoneOption {
  value: string;
  label: string;
  emoji: string;
}

/** Las 7 zonas reales en uso (no las 2 genéricas "Lima/Provincias" del mockup). */
export const DELIVERY_ZONES: ZoneOption[] = [
  { value: "LIMA_NORTE", label: "Lima Norte", emoji: "🟦" },
  { value: "CALLAO", label: "Callao", emoji: "🟨" },
  { value: "LIMA_CENTRO", label: "Lima Centro", emoji: "🟩" },
  { value: "LIMA_SUR", label: "Lima Sur", emoji: "🟪" },
  { value: "LIMA_ESTE", label: "Lima Este", emoji: "🟧" },
  { value: "ZONAS_ALEDANAS", label: "Zonas Aledañas", emoji: "⛰️" },
  { value: "PROVINCIAS", label: "Provincias", emoji: "🧭" },
];

export const PAYMENT_METHODS = [
  "Yape",
  "Plin",
  "Transferencia",
  "Efectivo",
  "Contra Entrega",
  "BCP",
  "Banco de la Nación",
  "Mercado Pago",
  "POS",
] as const;

export const DELIVERY_TYPE_OPTIONS = [
  { value: "RETIRO_TIENDA", label: "Retiro en tienda" },
  { value: "DOMICILIO", label: "Domicilio" },
  { value: "PUNTO_EXTERNO", label: "Punto externo" },
] as const;

export const SOURCE_OPTIONS = [
  { value: "manual", label: "Powip" },
  { value: "shopify", label: "Shopify" },
  { value: "google_sheets", label: "Google Sheets" },
] as const;

/**
 * Couriers de TRANSPORTE (los que llevan a las tarifas de "Couriers &
 * Tarifas"). Deliberadamente separado de las integraciones de fulfillment
 * (EVA, Aliclik) — ver `FULFILLMENT_INTEGRATIONS` abajo y el hallazgo E de
 * la auditoría: EVA/Aliclik no tienen tarifa por zona ni SLA, son
 * credenciales + webhook, no pertenecen a esta lista. Shalom tampoco: se
 * cotiza por envío vía su propia API (quoteShalom, según dimensiones/zona),
 * no con una tarifa base fija — CourierTransportTable la excluye de la
 * tabla por el mismo motivo, aunque su registro de Courier siga existiendo
 * en ms-courier para poder asignarla a guías.
 */
export const TRANSPORT_COURIERS = [
  "Motorizado Propio",
  "Olva Courier",
  "Marvisur",
  "Flores",
] as const;

/** Integraciones de fulfillment: canal de despacho propio con su webhook, sin tarifario. */
export const FULFILLMENT_INTEGRATIONS = [
  { key: "eva", label: "EVA Courier", configRoute: "/configuracion/integraciones/eva" },
  { key: "aliclik", label: "Aliclik", configRoute: "/configuracion/integraciones/aliclik" },
] as const;

/** Los 8 estados reales de guía (el mockup solo modela 4: Creada/Aprobada/En ruta/Cerrada). */
export type GuideStatus =
  | "CREADA"
  | "APROBADA"
  | "ASIGNADA"
  | "EN_RUTA"
  | "ENTREGADA"
  | "PARCIAL"
  | "FALLIDA"
  | "CANCELADA";

export const GUIDE_STATUS_LABEL: Record<GuideStatus, string> = {
  CREADA: "Creada",
  APROBADA: "Aprobada",
  ASIGNADA: "Asignada",
  EN_RUTA: "En Ruta",
  ENTREGADA: "Entregada",
  PARCIAL: "Parcial",
  FALLIDA: "Fallida",
  CANCELADA: "Cancelada",
};

export const GUIDE_STATUS_BADGE_CLASS: Record<GuideStatus, string> = {
  CREADA: "bg-muted text-muted-foreground border-border",
  APROBADA: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30",
  ASIGNADA: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  EN_RUTA: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  ENTREGADA: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30",
  PARCIAL: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
  FALLIDA: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
  CANCELADA: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
};

/** Umbrales de negocio para envejecimiento de guía (ver ShipmentDetailModal/seguimiento actuales). */
export const GUIDE_AGE_THRESHOLDS = {
  proximoDias: 25,
  vencidoDias: 30,
} as const;
