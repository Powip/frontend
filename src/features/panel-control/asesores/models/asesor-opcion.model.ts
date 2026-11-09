import type { RolAsesor } from "../../shared/models/panel-catalog.model";

export interface AsesorOpcion {
  id: string;
  nombre: string;
  email: string | null;
  rol?: RolAsesor | null;
  /** Tuvo pedidos antes pero ninguno en los últimos 90 días: el desplegable la oculta. */
  inactiva?: boolean;
}

export interface AsesoresQuery {
  empresaId: string;
}
