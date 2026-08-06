import { CierreDiaFunnel } from "@/interfaces/ICierreDia";

/**
 * Shape vacío del embudo — vive fuera de components/ porque lo consumen
 * tanto la capa de servicios (cierreDiaProductosService.ts) como la UI
 * (cierreDiaUtils.ts la reexporta).
 */
export const EMPTY_FUNNEL: CierreDiaFunnel = {
  porConfirmar: 0,
  contactado: 0,
  noContesta: 0,
  confirmado: 0,
  despachado: 0,
  entregado: 0,
  anulado: 0,
};
