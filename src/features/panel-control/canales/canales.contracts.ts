import {
  COMPARACION_PENDIENTE,
  defineContract,
  REGLA_VENTA_PENDIENTE,
  ROLES_DUENO,
  ROLES_GESTION,
  ROLES_TODOS,
} from "../shared/data/contract-helpers";

export const CANALES_FICHAS_CONTRACT = defineContract({
  id: "canales-fichas",
  titulo: "Fichas de canal",
  metodo: "GET",
  endpoint: "/config/canales?empresaId=",
  endpointActual: "/config/canales?empresaId= (ms-ventas)",
  estado: "parcial",
  pantallas: ["canales", "configuracion"],
  filtros: [],
  roles: ROLES_TODOS,
  respuesta: "CanalFicha[]",
  pendientes: [
    "Hoy solo trae canalNombre, canalLabel, flujoEntrada, requiereConfirmacionCc y activo",
    "Faltan: familia, color, cobro (cod|pre|inm|mkp), usa_courier, comision_pct, pasarela_pct, recibe_pauta_general, meta_mensual, tiene_pedidos",
    "flujoEntrada = directo_operaciones no distingue venta directa de presencial (POS); se muestra como pendiente",
    "Falta la relación pedido → canal: salesChannel, canalOrigen y externalSource no apuntan a un id de ficha",
  ],
});

export const CANALES_FICHAS_GUARDAR_CONTRACT = defineContract({
  id: "canales-fichas-guardar",
  titulo: "Crear o editar ficha de canal",
  metodo: "PUT",
  endpoint: "/config/canales/{id}/ficha",
  endpointActual:
    "PUT /config/canales/{id}/ficha (familia, tipo, pctComision, pctPasarela, plazoDepositoDias). PUT /config/canales/{id} es otro endpoint (pantalla vieja)",
  estado: "parcial",
  pantallas: ["configuracion"],
  filtros: [],
  roles: ROLES_DUENO,
  capacidadRequerida: "editar_configuracion",
  respuesta: "CanalFicha",
  pendientes: [
    "Bloquear entrada, cobro y usa_courier cuando el canal ya tiene pedidos (validación en backend)",
    "Eliminar solo si el canal no tiene pedidos",
  ],
});

export const CANALES_COMPARATIVO_CONTRACT = defineContract({
  id: "canales-comparativo",
  titulo: "Comparativo de canales",
  metodo: "GET",
  endpoint: "/panel/canales?vista=ventas|entregas|ganancia",
  endpointActual: "GET /panel/canales?vista= (ms-ventas)",
  estado: "parcial",
  pantallas: ["canales", "configuracion"],
  roles: ROLES_GESTION,
  camposRestringidos: ["vista=ganancia (solo Dueño)"],
  respuesta: "PanelEnvelope<CanalesComparativo>",
  pendientes: [
    REGLA_VENTA_PENDIENTE,
    "CONECTADO: vistas ventas y entregas por canal de origen (con «Sin canal» para que Σ = Vendí), fichas de los canales con datos y tendencia semanal de 12 semanas. vista=ganancia responde 403 a quien no ve costos",
    "Descuentos = precio de lista − neto de las líneas; upsell sale de upsell_records",
    "PENDIENTE: vista=ganancia solo trae facturado y entregado; costo, pauta, comisión, flete y ganancia llegan null (costo solo desde octubre y en parte de las líneas; no hay pauta por canal ni comisión configurada)",
    "PENDIENTE: metas del periodo, primer intento de entrega y flete (entregas) no se guardan: llegan null o se omiten",
    "CONECTADO: la familia sale del nombre del canal de origen (Web → Online COD, Live Tiktok → Live, Tiktok/Facebook/Instagram/WhatsApp/Recompra/Recomendado → Conversacional, Rappi → Plataforma aliada, Falabella/Ripley → Marketplace, Tienda física/POS → Presencial); un canal desconocido va a «Sin familia»",
    COMPARACION_PENDIENTE,
  ],
});

export const CANALES_DETALLE_CONTRACT = defineContract({
  id: "canales-detalle",
  titulo: "Detalle de canal",
  metodo: "GET",
  endpoint: "/panel/canales/{id}",
  endpointActual: "GET /panel/canales/{id} (ms-ventas)",
  estado: "parcial",
  pantallas: ["canales"],
  roles: ROLES_GESTION,
  camposRestringidos: ["actual.costos"],
  respuesta: "PanelEnvelope<CanalDetalle>",
  pendientes: [
    "CONECTADO: ficha, KPIs y bloque propio. El tipo de bloque sale de la familia del canal de origen; si el canal no es conocido se infiere de sus pedidos",
    "Embudo: recibidos → confirmados (venta) → entregados; «contactado» es lo mismo que «llamado» y no es etapa aparte",
    "PENDIENTE: costos (no se envían hasta tener costo, pauta y comisión), comisión a descontar y plazo de liquidación del marketplace",
    "PENDIENTE: sesiones de TikTok Live requieren la tabla de lives con inversión manual (no existe); un canal Live hoy se ve como conversacional",
  ],
});
