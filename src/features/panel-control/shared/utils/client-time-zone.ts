import { PANEL_TIME_ZONE } from "../models/panel-period.model";

/**
 * Zona horaria del equipo de quien consulta: el panel cuenta los días de
 * 00:00 a 23:59 en ella. Si el navegador no la informa, se usa Lima, donde
 * está la gran mayoría de los clientes.
 */
export function getClientTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || PANEL_TIME_ZONE;
  } catch {
    return PANEL_TIME_ZONE;
  }
}
