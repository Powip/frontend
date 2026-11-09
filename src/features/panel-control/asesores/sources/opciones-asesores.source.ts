import { getVendedores } from "@/services/agentesService";
import type { PanelSource } from "../../shared/data/panel-source";

/** Pasados estos días sin pedidos, el desplegable oculta a la persona (la lista completa no se recorta). */
export const DIAS_SIN_ACTIVIDAD_ASESORA = 90;

export const opcionesAsesoresRealSource: PanelSource<"opciones-asesores"> = {
  contractId: "opciones-asesores",
  kind: "real",
  descripcion: "Usuarios asignables como vendedor(a) de la empresa (ms-ventas)",
  fetch: async ({ empresaId }) => {
    const vendedores = await getVendedores(empresaId, {
      marcarInactivosDias: DIAS_SIN_ACTIVIDAD_ASESORA,
    });
    return vendedores
      .map((vendedor) => ({
        id: vendedor.id,
        nombre: vendedor.nombre || vendedor.email || vendedor.id,
        email: vendedor.email,
        inactiva: vendedor.inactiva,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  },
};
