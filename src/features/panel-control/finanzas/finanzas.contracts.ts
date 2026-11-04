import {
  COMPARACION_PENDIENTE,
  defineContract,
  ROLES_DUENO,
} from "../shared/data/contract-helpers";

export const FINANZAS_RESULTADO_CONTRACT = defineContract({
  id: "finanzas-resultado",
  titulo: "Resultado (por fecha del pedido)",
  metodo: "GET",
  endpoint: "/panel/finanzas?reloj=pedido",
  endpointActual: "GET /panel/finanzas?reloj=pedido (ms-ventas)",
  estado: "parcial",
  pantallas: ["finanzas"],
  roles: ROLES_DUENO,
  capacidadRequerida: "ver_finanzas",
  camposRestringidos: ["respuesta completa (solo Dueño)"],
  respuesta: "PanelEnvelope<ResultadoPanel>",
  pendientes: [
    "CONECTADO: del facturado al dinero, estado de resultados, punto de equilibrio, evolución de 6 meses y rentabilidad por canal, por fecha de ingreso del pedido. Solo Dueño: a otro rol (y a «Ver como») el servidor responde 403",
    "Entregado = ENTREGADO + PAGADO. Cobrado = pagos PAID; «por liquidar» = entregado sin pago completo, INCLUIDO retiro en tienda y POS (Cobranza solo cuenta los entregados con courier: por diseño no coinciden)",
    "Publicidad (directa y general) es null hasta conectar Meta/TikTok Ads: la ganancia es «antes de publicidad»",
    "costoProducto, envios, comisiones y ganancia son null (no 0) si no hay ningún dato; entregasSinCosto, entregasSinFlete y entregasSinComision cuentan lo que falta y vuelven parcial a la ganancia",
    "Gastos fijos: null con filtros de dimensión (canal, entrada, cobro, zona, turno, asesora) o sin gastos cargados en Configuración",
    "vencido es null aquí: el vencimiento se mide en Cobranza (por plazo de cada courier)",
    "PENDIENTE: adelantos (fuera del estado de resultados), publicidad real y gastos fijos por canal/zona/asesora",
    COMPARACION_PENDIENTE,
  ],
});

export const FINANZAS_CAJA_CONTRACT = defineContract({
  id: "finanzas-caja",
  titulo: "Caja (por fecha del dinero)",
  metodo: "GET",
  endpoint: "/panel/finanzas?reloj=caja",
  endpointActual: "GET /panel/finanzas?reloj=caja (ms-ventas)",
  estado: "parcial",
  pantallas: ["finanzas"],
  roles: ROLES_DUENO,
  capacidadRequerida: "ver_finanzas",
  camposRestringidos: ["respuesta completa (solo Dueño)"],
  respuesta: "PanelEnvelope<CajaPanel>",
  pendientes: [
    "CONECTADO: entradas y salidas por la fecha de REGISTRO del pago. «Liquidación de courier» es el cobro de contraentrega por esa fecha, no una liquidación del courier (esas no se guardan en el backend)",
    "Concepto por tipo de cobro del canal: contraentrega, marketplace (neto de comisión), POS, prepago. Fletes por fecha de envío; pasarela y comisiones de aliados solo con % en la ficha del canal",
    "Publicidad y adelantos son null (Pendiente) y no suman; gastos fijos prorrateados son null con filtros de dimensión o sin gastos cargados",
    "El drawer de una fila (movimientos_caja {concepto}) lista los pedidos del movimiento: la cantidad coincide con la fila; la facturación del encabezado es el total de esos pedidos y puede diferir del monto movido",
    "Las barras por día y el KPI «Entró» no abren drawer: mezclarían entradas y salidas. Tope de 20000 movimientos por lectura (aviso en log, sin bandera en la respuesta)",
    "No incluye compras de mercadería",
  ],
});

export const FINANZAS_COBRANZA_CONTRACT = defineContract({
  id: "finanzas-cobranza",
  titulo: "Cobranza",
  metodo: "GET",
  endpoint: "/panel/finanzas?reloj=cobranza",
  endpointActual: "GET /panel/finanzas?reloj=cobranza (ms-ventas)",
  estado: "parcial",
  pantallas: ["finanzas"],
  roles: ROLES_DUENO,
  capacidadRequerida: "ver_finanzas",
  respuesta: "PanelEnvelope<CobranzaPanel>",
  pendientes: [
    "CONECTADO: deuda con courier = entregados con courier sin pago completo, de los últimos 365 días (hasta 5000 pedidos). Estado actual: no depende del periodo",
    "Solo cuenta entregas con courier; el «por liquidar» de Resultado incluye retiro en tienda y POS, así que las dos cifras pueden diferir",
    "Vencido = entregado hace más que el plazo del courier y sin pago completo; null (Sin dato) si ningún courier con deuda tiene plazo",
    "«Tiempo hasta liquidar» y «liquidado por el courier»: pendiente, se conectará con Liquidaciones de courier",
    "Un entregado sin fecha de entrega entra por su fecha de ingreso en la antigüedad y no vence",
    "«Pedir liquidación» abre las acciones del pedido (necesita POST /panel/acciones)",
  ],
});
