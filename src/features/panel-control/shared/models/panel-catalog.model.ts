import type { EntradaCanal } from "./panel-filters.model";

export type RolAsesor = "confirmadora" | "vendedora";

export interface PanelCatalogo {
  listo: boolean;
  tiendas: { id: string; nombre: string }[];
  canales: { id: string; nombre: string; entrada: EntradaCanal | null; color: string | null }[];
  asesores: { id: string; nombre: string; rol?: RolAsesor | null }[];
}

export const CATALOGO_VACIO: PanelCatalogo = {
  listo: false,
  tiendas: [],
  canales: [],
  asesores: [],
};

export function catalogoClave(catalogo: PanelCatalogo): string {
  return [
    catalogo.tiendas.map((tienda) => tienda.id).join(","),
    catalogo.canales.map((canal) => `${canal.id}:${canal.entrada ?? ""}`).join(","),
    catalogo.asesores.map((asesor) => `${asesor.id}:${asesor.rol ?? ""}`).join(","),
  ].join("|");
}
