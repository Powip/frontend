import {
  COMPARACION_PENDIENTE,
  defineContract,
  REGLA_VENTA_PENDIENTE,
  ROLES_DUENO,
} from "../shared/data/contract-helpers";

export const FINANZAS_RESULTADO_CONTRACT = defineContract({
  id: "finanzas-resultado",
  titulo: "Resultado (por fecha del pedido)",
  metodo: "GET",
  endpoint: "/panel/finanzas?reloj=pedido",
  estado: "pendiente",
  pantallas: ["finanzas"],
  roles: ROLES_DUENO,
  capacidadRequerida: "ver_finanzas",
  camposRestringidos: ["respuesta completa (solo Dueño)"],
  respuesta: "PanelEnvelope<ResultadoPanel>",
  pendientes: [
    "Filtra por fecha_ingreso del pedido",
    "Entregado = ENTREGADO + PAGADO; hoy el P&L de Administración solo cuenta ENTREGADO",
    "Prepago: el estado de entrega y el de cobro deben venir separados; un pedido PAGADO antes de entregarse no es entregado",
    "Adelantos fuera del estado de resultados",
    REGLA_VENTA_PENDIENTE,
    COMPARACION_PENDIENTE,
  ],
});

export const FINANZAS_CAJA_CONTRACT = defineContract({
  id: "finanzas-caja",
  titulo: "Caja (por fecha del dinero)",
  metodo: "GET",
  endpoint: "/panel/finanzas?reloj=caja",
  estado: "pendiente",
  pantallas: ["finanzas"],
  roles: ROLES_DUENO,
  capacidadRequerida: "ver_finanzas",
  camposRestringidos: ["respuesta completa (solo Dueño)"],
  respuesta: "PanelEnvelope<CajaPanel>",
  pendientes: [
    "Filtra por fecha del dinero: fecha_pago, fecha de adelanto, fecha de pauta, fecha de envío para fletes",
    "Las liquidaciones de courier no se guardan en el backend (hoy son estado local de la pantalla Liquidaciones COD)",
    "No incluye compras de mercadería",
  ],
});

export const FINANZAS_COBRANZA_CONTRACT = defineContract({
  id: "finanzas-cobranza",
  titulo: "Cobranza",
  metodo: "GET",
  endpoint: "/panel/finanzas?reloj=cobranza",
  estado: "pendiente",
  pantallas: ["finanzas"],
  roles: ROLES_DUENO,
  capacidadRequerida: "ver_finanzas",
  respuesta: "PanelEnvelope<CobranzaPanel>",
  pendientes: [
    "Estado actual: no depende del periodo",
    "Vencido si hoy > fecha_entrega + plazo del courier",
    "Acción «Pedir liquidación» por courier",
  ],
});
