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
  /** = codNeto - comision. Lo que el negocio debería recibir. */
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
