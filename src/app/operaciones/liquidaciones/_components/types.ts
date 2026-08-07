// Modelo de datos local de la pantalla Liquidaciones COD.
//
// BACKEND GAP (general): NADA de esto existe hoy en ms-courier. El único
// dato real de partida es OrderHeader (ms-ventas) vía
// `GET /order-header/store/:storeId`, que se usa para construir
// `GuiaPorLiquidar[]` en runtime (ver `buildGuiasPorLiquidar` en utils.ts).
// Todo lo demás (histórico de liquidaciones, rendición de repartidor,
// diferencias, comisiones) es estado local de sesión sembrado con datos de
// prueba — se pierde al recargar la página. La lista exhaustiva de
// endpoints que se necesitarían está en la respuesta final de esta tarea
// (informe de brechas de backend), basada en
// `src/components/finanzas/BACKEND_REQUERIMIENTOS.md` pero simplificada:
// sin score de courier, sin gráfico de 8 semanas, sin tipos A/B/C.

export type CourierLiquidacionEstado = "PENDIENTE" | "VENCIDO" | "LIQUIDADO";

/**
 * Una guía/pedido con COD pendiente de que el courier deposite el dinero.
 * Se arma a partir de OrderHeader (real) + una tabla de comisiones local
 * (mock, BACKEND GAP) + montos ya registrados como liquidados (estado local
 * de esta pantalla, BACKEND GAP: debería persistir en ms-courier).
 */
export interface GuiaPorLiquidar {
  /** orderNumber de OrderHeader — no existe un "N° de guía de liquidación" real todavía. */
  id: string;
  /** OrderHeader.id, para llamar a otros endpoints (BACKEND GAP: no hay endpoint de liquidación aún). */
  orderId: string;
  cliente: string;
  ciudad: string;
  courier: string;
  entregadoAt: string | null;
  diasTranscurridos: number;
  /** Plazo pactado con el courier para rendir el COD. BACKEND GAP: hoy es una tabla local, debería venir de "Couriers & Tarifas". */
  diasLimite: number;
  /** = grandTotal del pedido. */
  codBruto: number;
  /** Suma de pagos ya registrados con status PAID (adelantos del cliente, no depende del courier). */
  adelantos: number;
  /** = codBruto - adelantos. Lo que el courier debería haber cobrado en la entrega. */
  codNeto: number;
  /** % de comisión del courier. BACKEND GAP: tabla local (ver COURIER_COMMISSION_PCT), debería venir del tarifario real. */
  comisionPct: number;
  /** = codNeto * comisionPct. */
  comision: number;
  /**
   * Costo de flete de esa entrega, a cargo del negocio. BACKEND GAP: tabla
   * local por región (ver FLETE_BY_REGION) — debería venir del tarifario
   * real de "Couriers & Tarifas", que hoy tampoco modela flete por pedido
   * individual, solo tarifas generales.
   */
  flete: number;
  /** = codNeto - comision - flete. Lo que el negocio debería recibir. */
  neto: number;
  /** = neto - suma de montos ya cubiertos por liquidaciones registradas en esta sesión. */
  saldoPendiente: number;
  estado: CourierLiquidacionEstado;
  vencido: boolean;
  /**
   * Entrega parcial detectada desde Pedidos: el pedido llega acá con una
   * diferencia ya registrada en el módulo de Pedidos (ej. faltó un ítem, se
   * devolvió parte del pedido). BACKEND GAP: hoy no existe ningún campo en
   * OrderHeader para esto (algo como `partialDeliveryDiff` /
   * `partialDeliveryReason`); acá se infiere con una heurística sobre
   * `notes` en texto libre, igual que `guessFailureReason` en el Tablero —
   * es un best-effort, no un dato estructurado real.
   */
  entregaParcial: { motivo: string; diferenciaEstimada: number } | null;
}

export type MetodoPago = "transferencia" | "yape" | "efectivo" | "otro";

export const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  transferencia: "Transferencia",
  yape: "Yape",
  efectivo: "Efectivo",
  otro: "Otro",
};

export type LiquidacionEstado = "CONCILIADA" | "CON_DIFERENCIA";

/**
 * Un depósito/pago registrado por un courier que cubre 1+ pedidos.
 * BACKEND GAP: no existe endpoint para crear ni listar esto — ver
 * `POST /shipping-guides/:guiaId/pagos` en BACKEND_REQUERIMIENTOS.md como
 * referencia más cercana, adaptado acá a "cubre N pedidos" en vez de "cubre
 * 1 guía" (esta pantalla no modela el concepto de guía de courier, solo
 * pedidos individuales, a diferencia del prototipo viejo de Finanzas).
 */
export interface PagoLiquidacion {
  id: string;
  fecha: string;
  courier: string;
  /** orderNumbers de los pedidos cubiertos por este depósito. */
  pedidosIds: string[];
  montoEsperado: number;
  montoDepositado: number;
  /** = montoDepositado - montoEsperado. */
  diferencia: number;
  metodo: MetodoPago;
  numeroOperacion?: string;
  /** BACKEND GAP: hoy es solo el nombre de archivo elegido en el input, no se sube a ningún lado (no hay endpoint de upload para esto). */
  comprobanteNombreArchivo?: string;
  observaciones?: string;
  estado: LiquidacionEstado;
  /**
   * Snapshot del desglose por pedido de las guías que cubrió este depósito,
   * capturado al momento de registrar (ver RegistrarLiquidacionModal) —
   * permite el drill-down "Ver detalle" sin tener que recalcular contra
   * OrderHeader (que además puede haber cambiado desde entonces). Opcional
   * porque las liquidaciones semilla (mockData.ts) no siempre lo tienen.
   */
  detalle?: {
    pedido: string;
    cliente: string;
    cobro: number;
    comision: number;
    flete: number;
    neto: number;
  }[];
}

export type RendicionEstado = "POR_RENDIR" | "CUADRADO" | "FALTANTE";

/**
 * Cuadre de caja diario de un motorizado propio (sin comisión de courier,
 * a diferencia de las otras pestañas). BACKEND GAP: OrderHeader no tiene
 * ningún campo de repartidor asignado (algo como `assignedDriverId` /
 * `assignedDriverName`), así que hoy es imposible calcular esto desde datos
 * reales — toda esta pestaña es 100% datos de prueba locales.
 */
export interface RendicionRepartidor {
  id: string;
  repartidor: string;
  fecha: string;
  pedidosEntregados: number;
  /** Lo que debió cobrar en efectivo según los pedidos COD que se le asignaron ese día. */
  debioCobrar: number;
  /** Lo que efectivamente entregó en caja. */
  entregoEfectivo: number;
  /** = entregoEfectivo - debioCobrar. */
  diferencia: number;
  estado: RendicionEstado;
  observaciones?: string;
  /**
   * Desglose por guía/pedido de esta rendición, para el drill-down "Ver
   * detalle". BACKEND GAP: no existe manera de capturar esto desde
   * RegistrarRendicionModal hoy (el formulario solo pide el total debido y
   * el total entregado) porque OrderHeader no tiene campo de repartidor
   * asignado — ver comentario de la interfaz. Por eso solo las rendiciones
   * semilla (mockData.ts) traen `detalle`; las registradas a mano por el
   * usuario quedan sin desglose.
   */
  detalle?: {
    guia?: string;
    pedido: string;
    cliente: string;
    debioCobrar: number;
    cobro: number;
    ok: boolean;
    motivo?: string;
  }[];
}

export type DiferenciaEstado = "ABIERTA" | "RECLAMADA" | "ACEPTADA_PERDIDA";

/**
 * Un PagoLiquidacion cuyo monto depositado no coincidió con el esperado.
 * Se genera automáticamente cuando se registra una liquidación con
 * diferencia != 0 (ver RegistrarLiquidacionModal). BACKEND GAP: no existe
 * ningún endpoint para "reclamar al courier" ni para "aceptar como pérdida"
 * — ver detalle en el informe final.
 */
export interface DiferenciaLiquidacion {
  id: string;
  pagoLiquidacionId: string;
  courier: string;
  fecha: string;
  pedidosIds: string[];
  montoEsperado: number;
  montoDepositado: number;
  diferencia: number;
  estado: DiferenciaEstado;
  motivoAceptacion?: string;
}

export type RecordatorioEstado = "SIN_RECORDAR" | "RECORDADO";

/**
 * Un pedido ENTREGADO donde el cliente pagó menos de lo pactado (saldo por
 * cobrarle al cliente — distinto a lo que debe el courier). BACKEND GAP:
 * no existe ninguna señal estructurada para esto. La heurística más
 * cercana que ya existe en la app (`entregaParcial` en GuiaPorLiquidar,
 * basada en texto libre de `OrderHeader.notes`) es demasiado poco confiable
 * para armar una pestaña completa — por eso esta pestaña es 100% datos de
 * prueba locales, igual que Rendición e Histórico, y no se intenta derivar
 * de `orders` reales. Ver informe final para el campo real que se
 * necesitaría (algo como `OrderHeader.deliveryCollectedAmount`).
 */
export interface SaldoCliente {
  id: string;
  orderNumber: string;
  cliente: string;
  telefono: string;
  ciudad: string;
  entregadoAt: string;
  total: number;
  pagado: number;
  /** = total - pagado. */
  saldo: number;
  recordatoriosEnviados: number;
  ultimoRecordatorioAt?: string | null;
}

export function saldoRecordatorioEstado(s: SaldoCliente): RecordatorioEstado {
  return s.recordatoriosEnviados > 0 ? "RECORDADO" : "SIN_RECORDAR";
}

/* -----------------------------------------------------------------------
   Tabla de comisiones y plazos por courier.
   BACKEND GAP: esto debería venir de "Couriers & Tarifas" (ms-courier),
   que construye otro agente en paralelo dentro de este mismo módulo. No se
   depende de su código — solo se deja esta tabla local con el mismo
   criterio de nombres que TRANSPORT_COURIERS en
   src/constants/operationsDomain.ts, y este comentario documenta que debe
   reemplazarse por una llamada real cuando ese endpoint exista.
------------------------------------------------------------------------ */
export const COURIER_COMMISSION_PCT: Record<string, number> = {
  Shalom: 0.035,
  "Olva Courier": 0.04,
  Marvisur: 0.03,
  Flores: 0.03,
  "Motorizado Propio": 0,
};

export const COURIER_DIAS_LIMITE: Record<string, number> = {
  Shalom: 15,
  "Olva Courier": 7,
  Marvisur: 10,
  Flores: 10,
  "Motorizado Propio": 1,
};

export const DEFAULT_COMMISSION_PCT = 0.035;
export const DEFAULT_DIAS_LIMITE = 10;

/**
 * Costo de flete plano por región, a falta de un tarifario real por
 * zona/peso. BACKEND GAP: debería venir de "Couriers & Tarifas"
 * (ms-courier) por courier + zona, no un monto fijo por región — ver
 * informe final.
 */
export const FLETE_BY_REGION: Record<"LIMA" | "PROVINCIA", number> = {
  LIMA: 8,
  PROVINCIA: 12.5,
};
export const DEFAULT_FLETE = 10;
