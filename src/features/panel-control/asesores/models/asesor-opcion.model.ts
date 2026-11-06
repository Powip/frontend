import type { RolAsesor } from "../../shared/models/panel-catalog.model";

export interface AsesorOpcion {
  id: string;
  nombre: string;
  email: string | null;
  rol?: RolAsesor | null;
}

export interface AsesoresQuery {
  empresaId: string;
}
