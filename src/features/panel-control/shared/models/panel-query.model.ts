import type { CobroCanal, EntradaCanal, TurnoPanel, ZonaPanel } from "./panel-filters.model";
import type { PanelRole } from "./panel-role.model";

export interface PanelQuery {
  desde: string;
  hasta: string;
  anterior_desde: string;
  anterior_hasta: string;
  zona_horaria: string;
  tienda?: string;
  canal?: string;
  entrada?: EntradaCanal;
  cobro?: CobroCanal;
  zona?: ZonaPanel;
  turno?: TurnoPanel;
  asesor?: string;
  ver_como?: PanelRole;
}
