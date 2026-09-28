import type { PanelRoleResolution } from "./panel-role.model";

export interface PanelStoreOption {
  id: string;
  nombre: string;
}

export interface PanelSession {
  userId: string;
  userName: string;
  empresaId: string | null;
  tiendas: PanelStoreOption[];
  rol: PanelRoleResolution;
}
