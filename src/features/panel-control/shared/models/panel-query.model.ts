import type { CobroCanal, EntradaCanal, ZonaPanel } from "./panel-filters.model";
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
  asesor?: string;
  ver_como?: PanelRole;
}
