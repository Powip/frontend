import { getCanales } from "@/services/canalConfigService";
import type { PanelSource } from "../../shared/data/panel-source";
import { toCanalFicha } from "../mappers/to-canal-ficha.mapper";

export const canalesFichasRealSource: PanelSource<"canales-fichas"> = {
  contractId: "canales-fichas",
  kind: "real",
  descripcion:
    "Configuración real de canales (ms-ventas). Solo nombre, activo y si requiere confirmación; el resto de la ficha está pendiente",
  fetch: async ({ empresaId }) => {
    const canales = await getCanales(empresaId);
    return canales.map(toCanalFicha);
  },
};
