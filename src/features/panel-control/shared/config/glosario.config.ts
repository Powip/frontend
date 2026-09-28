export const GLOSARIO_IDS = [
  "lead",
  "venta",
  "confirmacion",
  "contactados",
  "tiempo_primera_llamada",
  "efectividad_entrega",
  "efectividad_real",
  "ticket",
  "pagado",
  "por_liquidar",
  "perdido",
  "retorno_publicidad",
  "costo_por_venta",
  "ganancia",
  "me_deben",
  "periodo_abierto",
  "pauta_general",
  "comparacion",
  "upsell",
  "primer_intento",
  "incidencia_rechazo",
  "cobertura_stock",
  "cola_operativa",
] as const;

export type GlosarioId = (typeof GLOSARIO_IDS)[number];

export interface GlosarioEntrada {
  termino: string;
  definicion: string;
}

export const GLOSARIO: Record<GlosarioId, GlosarioEntrada> = {
  lead: {
    termino: "Lead",
    definicion:
      "Pedido de un canal tipo lead (Shopify COD, TikTok Live) en estado PENDIENTE: todavía no es venta.",
  },
  venta: {
    termino: "Venta / Facturación",
    definicion:
      "Pedido que llegó a LLAMADO o más (lead confirmado, venta directa registrada o venta POS). Facturación = suma del precio neto (precio − descuentos − cupones).",
  },
  confirmacion: {
    termino: "Confirmación",
    definicion:
      "Llamados ÷ leads cerrados (llamados + anulados). Los que siguen en PENDIENTE no cuentan.",
  },
  contactados: {
    termino: "Contactados",
    definicion: "Leads con los que se logró hablar al menos una vez ÷ leads ya trabajados.",
  },
  tiempo_primera_llamada: {
    termino: "Tiempo a 1ª llamada",
    definicion: "Mediana de minutos desde que entra el lead hasta la primera llamada o mensaje.",
  },
  efectividad_entrega: {
    termino: "Efectividad de entrega",
    definicion:
      "Entregados ÷ envíos cerrados (entregados + rechazados). Mide courier y operaciones.",
  },
  efectividad_real: {
    termino: "Efectividad real",
    definicion:
      "Entregados ÷ todo lo cerrado (entregados + rechazados + leads anulados). Mide el negocio completo.",
  },
  ticket: {
    termino: "Ticket promedio",
    definicion: "Facturación ÷ número de ventas.",
  },
  pagado: {
    termino: "Pagado",
    definicion:
      "Dinero ya recibido (liquidación courier, prepago o caja). Los adelantos van aparte.",
  },
  por_liquidar: {
    termino: "Por liquidar",
    definicion:
      "Entregado pero el courier aún no deposita. Vencido = pasó el plazo pactado con ese courier.",
  },
  perdido: {
    termino: "Perdido",
    definicion: "Rechazado: no se cobrará y además se pagó flete (ida y vuelta en provincia).",
  },
  retorno_publicidad: {
    termino: "Retorno de publicidad (ROAS)",
    definicion:
      "Soles de venta por cada S/ 1 invertido. Facturación ÷ publicidad del canal (directa + general prorrateada).",
  },
  costo_por_venta: {
    termino: "Costo por venta (CPA)",
    definicion: "Publicidad ÷ número de ventas.",
  },
  ganancia: {
    termino: "Ganancia (contribución)",
    definicion:
      "Venta entregada − costo de producto − publicidad − envíos − comisiones del canal. Antes de gastos fijos.",
  },
  me_deben: {
    termino: "Me deben",
    definicion: "Ventas aún no cobradas: en curso (Llamado → En envío) + entregadas por liquidar.",
  },
  periodo_abierto: {
    termino: "Periodo abierto",
    definicion:
      "Pedidos del periodo que todavía no terminan su ciclo (sin llamar, en curso o por liquidar). Mientras más alto, más van a cambiar las cifras de entrega y cobro.",
  },
  pauta_general: {
    termino: "Pauta general",
    definicion:
      "Pauta de marca que no es de un canal. Se reparte entre los canales con pauta según su facturación, por eso es un valor estimado.",
  },
  comparacion: {
    termino: "Comparación a la misma antigüedad",
    definicion:
      "El periodo anterior se evalúa con el estado que tenía hace el mismo número de días, no terminado.",
  },
  upsell: {
    termino: "Upsell",
    definicion:
      "Suma del neto de los ítems marcados como upsell. Tasa = ventas con upsell ÷ ventas (en Call center, sobre los leads confirmados).",
  },
  primer_intento: {
    termino: "Entrega al 1er intento",
    definicion:
      "Entregados al primer intento ÷ entregados con ese dato. Si el courier no lo informa se muestra «—».",
  },
  incidencia_rechazo: {
    termino: "Incidencia (rechazo)",
    definicion:
      "Rechazados ÷ (entregados + rechazados) de los pedidos con courier ingresados en el periodo. Un ANULADO no es un rechazo.",
  },
  cobertura_stock: {
    termino: "Cobertura de stock",
    definicion:
      "(Stock − reservado) ÷ venta diaria de los últimos 30 días. Se reserva en LLAMADO y se descuenta al pasar a EN_ENVIO. Stock negativo es un error de datos.",
  },
  cola_operativa: {
    termino: "Cola activa",
    definicion:
      "Ventas con courier en LLAMADO, PREPARADO, CON_GUIA o EN_ENVIO ahora mismo. No depende del periodo; respeta tienda, canal y demás filtros.",
  },
};
