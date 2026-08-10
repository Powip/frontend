// Modelo de datos local de la pantalla Liquidaciones COD.
//
// BACKEND GAP (general): NADA de esto existe hoy en ms-courier. El único
// dato real de partida es OrderHeader (ms-ventas) vía
// `GET /order-header/store/:storeId`, que se usa para construir
// `GuiaPorLiquidar[]` en runtime (ver `buildGuiasPorLiquidar` en utils.ts).
// Las pestañas que antes vivían acá (Saldos clientes, Liquidaciones
// histórico, Rendición repartidor, Diferencias) se quitaron por no tener
// ningún endpoint real detrás — eran 100% datos de prueba. `PagoLiquidacion`
// sigue existiendo porque es la acción real de "Registrar liquidación"
// desde Por Liquidar (estado local de sesión, se pierde al recargar —
// BACKEND GAP: debería persistir en ms-courier).

export type CourierLiquidacionEstado = "PENDIENTE" | "VENCIDO" | "LIQUIDADO";

/**
 * Una guía/pedido con COD pendiente de que el courier deposite el dinero.
 * Se arma a partir de OrderHeader (real) + montos ya registrados como
 * liquidados (estado local de esta pantalla, BACKEND GAP: debería persistir
 * en ms-courier).
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
  /** = codBruto - adelantos. Lo que el courier debería haber cobrado en la entrega, y lo que el negocio debería recibir. */
  codNeto: number;
  /** = codNeto - suma de montos ya cubiertos por liquidaciones registradas en esta sesión. */
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
  }[];
}

/* -----------------------------------------------------------------------
   Tabla de plazos por courier.
   BACKEND GAP: esto debería venir de "Couriers & Tarifas" (ms-courier),
   que construye otro agente en paralelo dentro de este mismo módulo. No se
   depende de su código — solo se deja esta tabla local con el mismo
   criterio de nombres que TRANSPORT_COURIERS en
   src/constants/operationsDomain.ts, y este comentario documenta que debe
   reemplazarse por una llamada real cuando ese endpoint exista.

   La comisión y el flete por pedido se quitaron de esta pantalla: no había
   ningún dato real (ni tarifario en ms-courier) del que derivarlos, y
   mostrar un monto inventado como si fuera el costo real podía inducir a
   error en el monto que el negocio debería recibir.
------------------------------------------------------------------------ */
export const COURIER_DIAS_LIMITE: Record<string, number> = {
  Shalom: 15,
  "Olva Courier": 7,
  Marvisur: 10,
  Flores: 10,
  "Motorizado Propio": 1,
};

export const DEFAULT_DIAS_LIMITE = 10;
