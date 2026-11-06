import { COMPARACION_PENDIENTE, defineContract } from "../shared/data/contract-helpers";

export const CALLCENTER_CONTRACT = defineContract({
  id: "callcenter",
  titulo: "Call center",
  metodo: "GET",
  endpoint: "/panel/callcenter",
  endpointActual: "GET /panel/callcenter (ms-ventas)",
  estado: "parcial",
  pantallas: ["callcenter"],
  roles: ["dueno", "confirmadora"],
  respuesta: "PanelEnvelope<CallCenterPanel>",
  pendientes: [
    "CONECTADO: leads, valor, confirmación (confirmados ÷ confirmados + anulados), upsell, cola de ahora por horas (abiertos de los últimos 14 días), motivos, lista negra, mapa de calor, ranking y «Mi día»",
    "Trabajado = tuvo un intento (sub-estado de gestión o callAttempts), se confirmó o se anuló. Contactado = llamado: la contactación no aplica",
    "Duplicados: mismo cliente con algún producto en común en menos de 24 h (no existe el motivo «Duplicado»)",
    "A la Confirmadora el servidor le impone su identidad: sus leads, su fila del ranking y «Mi día»",
    "PENDIENTE: tiempo a 1ª llamada (falta primer_contacto_at) y metas por confirmadora (sin configuración)",
    COMPARACION_PENDIENTE,
  ],
});
