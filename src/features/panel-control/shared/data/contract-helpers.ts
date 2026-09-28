import {
  PANEL_FILTROS_GLOBALES,
  type PanelContractDescriptor,
} from "../models/panel-contract.model";
import type { PanelRole } from "../models/panel-role.model";

export const ROLES_TODOS: PanelRole[] = ["dueno", "supervisora", "confirmadora", "vendedora"];
export const ROLES_GESTION: PanelRole[] = ["dueno", "supervisora"];
export const ROLES_DUENO: PanelRole[] = ["dueno"];

export const REGLA_VENTA_PENDIENTE =
  "Regla de venta sin cerrar: en POWIP el flujo real es PENDIENTE → PREPARADO → LLAMADO («Contactado»), la confirmación de call center vive en subEstadoCc y no existe RECHAZADO. El backend debe clasificar cada pedido según la especificación §2 (nunca por orden de estados)";

export const COMPARACION_PENDIENTE =
  "anterior_misma_antiguedad requiere historial de estados (order_status_history) para reconstruir el estado del periodo anterior a la fecha actual − desfase";

type DescriptorInput = Omit<
  PanelContractDescriptor,
  "filtros" | "endpointActual" | "capacidadRequerida" | "camposRestringidos"
> &
  Partial<
    Pick<
      PanelContractDescriptor,
      "filtros" | "endpointActual" | "capacidadRequerida" | "camposRestringidos"
    >
  >;

export function defineContract(input: DescriptorInput): PanelContractDescriptor {
  return {
    filtros: PANEL_FILTROS_GLOBALES,
    endpointActual: null,
    capacidadRequerida: null,
    camposRestringidos: [],
    ...input,
  };
}
