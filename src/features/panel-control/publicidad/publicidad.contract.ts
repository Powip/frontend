import {
  COMPARACION_PENDIENTE,
  defineContract,
  ROLES_GESTION,
} from "../shared/data/contract-helpers";

export const PUBLICIDAD_CONTRACT = defineContract({
  id: "publicidad",
  titulo: "Publicidad",
  metodo: "GET",
  endpoint: "/panel/publicidad",
  estado: "pendiente",
  pantallas: ["canales"],
  roles: ROLES_GESTION,
  camposRestringidos: ["actual.porCanal[].ganancia"],
  respuesta: "PanelEnvelope<PublicidadPanel>",
  pendientes: [
    "Registro de pauta por fecha, tienda y canal o «general»; hoy solo existen gastos mensuales PUBLICIDAD (/company/{id}/gastos) y el cierre del día en localStorage",
    "Pauta general prorrateada por facturación entre canales con recibe_pauta_general y marcada como estimada",
    "Sesiones de TikTok Live con inversión por sesión",
    "Decisión abierta: si la Supervisora puede ver montos de inversión (la especificación solo excluye costos, márgenes, ganancia y comisiones)",
    COMPARACION_PENDIENTE,
  ],
});
