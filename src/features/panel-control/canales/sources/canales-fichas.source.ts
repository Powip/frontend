import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import type { CanalConfig } from "@/interfaces/IOrder";
import type { PanelSource } from "../../shared/data/panel-source";
import { toCanalFicha } from "../mappers/to-canal-ficha.mapper";

export const canalesFichasRealSource: PanelSource<"canales-fichas"> = {
  contractId: "canales-fichas",
  kind: "real",
  descripcion:
    "Configuración real de canales (ms-ventas). Solo nombre, activo y si requiere confirmación; el resto de la ficha está pendiente",
  // Con axiosAuth: /config/canales está detrás de JwtAuthGuard (sin token responde 401).
  fetch: async ({ empresaId }) => {
    const base = process.env.NEXT_PUBLIC_API_VENTAS || GATEWAY.ventas;
    const { data } = await axiosAuth.get<CanalConfig[]>(`${base}/config/canales`, {
      params: { empresaId },
    });
    return data.map(toCanalFicha);
  },
};
