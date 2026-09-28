import { COMPARACION_PENDIENTE, defineContract } from "../shared/data/contract-helpers";

export const CALLCENTER_CONTRACT = defineContract({
  id: "callcenter",
  titulo: "Call center",
  metodo: "GET",
  endpoint: "/panel/callcenter",
  estado: "pendiente",
  pantallas: ["callcenter"],
  roles: ["dueno", "supervisora", "confirmadora"],
  respuesta: "PanelEnvelope<CallCenterPanel>",
  pendientes: [
    "Fuentes existentes aprovechables: /atencion-al-cliente/kpis/{funnel,aging,intentos,upsell}, /atencion-al-cliente/agentes/kpis, /atencion-al-cliente/upsell-records",
    "Tiempo a 1ª llamada requiere primer_contacto_at por pedido",
    "La cola por antigüedad se pide en horas (<1 h, 1–6 h, 6–24 h, >24 h); el aging actual viene en días",
    "Motivos de anulación como catálogo cerrado; hoy cancellationReason es texto libre",
    "Duplicados: mismo teléfono + mismo producto en menos de 24 h",
    "Con rol Confirmadora, el backend debe forzar asesor = usuario del JWT y completar miDia",
    COMPARACION_PENDIENTE,
  ],
});
