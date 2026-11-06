import { getVendedores } from "@/services/agentesService";
import type { PanelSource } from "../../shared/data/panel-source";

export const opcionesAsesoresRealSource: PanelSource<"opciones-asesores"> = {
  contractId: "opciones-asesores",
  kind: "real",
  descripcion: "Usuarios asignables como vendedor(a) de la empresa (ms-ventas)",
  fetch: async ({ empresaId }) => {
    const vendedores = await getVendedores(empresaId);
    return vendedores
      .map((vendedor) => ({
        id: vendedor.id,
        nombre: vendedor.nombre || vendedor.email || vendedor.id,
        email: vendedor.email,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  },
};
