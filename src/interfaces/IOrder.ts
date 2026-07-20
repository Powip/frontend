import { Client } from "./ICliente";

export interface IOrder {
  id: string;
  dateVta: string;
  dateEntrega: string;
  status: string;
  tag?: string;
  estadoPago: string;
  telefono: string;
  cliente: string;
  vendedor: string;
  courier: string;
  direccion?: string;
  distrito?: string;
  provincia?: string;
  entrega?: string;
  datosEntrega?: string;
  contactoAdicional?: string;
  telefonoAdicional?: string;
  canalVenta?: string;
  impTotal?: number;
  impPendiente?: number;
  claveRecojo?: string;
  trakking?: string;
  agente?: string;
}

export interface CartItem {
  id: string;
  inventoryItemId: string;
  variantId: string;
  productName: string;
  sku: string;
  attributes?: Record<string, string>;
  quantity: number;
  price: number;
  discount: number; // Descuento por item
  pvp?: number; // Precio original antes de descuentos/packs (para mostrar ahorro)
  packId?: string | null; // Pack aplicado a esta línea (Packs & Promos, solo UI)
  isGift?: boolean; // Línea generada por un pack de regalo
  giftValue?: number; // Valor de referencia del regalo (no se cobra)
  /** Metadata del descuento manual aplicado a la línea (para mostrar el badge y
   *  prefillear el editor) — el precio de cobro real siempre es `price`. */
  discMode?: "pct" | "amt" | "man" | null;
  discValue?: number | null;
}

/* -----------------------------------------
   Enums (alineados al backend)
----------------------------------------- */
export type ReceiptType = "BOLETA" | "FACTURA";

export type OrderType = "VENTA" | "RESERVA" | "PREVENTA" | "CAMBIO";

export type SalesChannel =
  | "TIENDA_FISICA"
  | "WHATSAPP"
  | "INSTAGRAM"
  | "FACEBOOK"
  | "MARKETPLACE"
  | "MERCADOLIBRE"
  | "OTRO";

export type DeliveryType = "RETIRO_TIENDA" | "DOMICILIO" | "PUNTO_EXTERNO";

export type OrderStatus =
  | "INCOMPLETE"
  | "PREVENTA"
  | "PENDIENTE"
  | "PREPARADO"
  | "LLAMADO"
  | "ASIGNADO_A_GUIA"
  | "EN_ENVIO"
  | "ENTREGADO"
  | "ANULADO"
  | "PAGADO";

/* -----------------------------------------
   ✅ NUEVO: Estados de Shalom
----------------------------------------- */
export type ShalomStatus =
  | "PENDIENTE" // Registrado exitosamente, esperando despacho
  | "EXITOSO" // Alternativa a PENDIENTE
  | "FALLIDO" // Registro fallido
  | "EN_TRANSITO" // En camino (del tracking de Shalom)
  | "EN_DESTINO" // Paquete en agencia destino
  | "EN_REPARTO" // En camino al destinatario final
  | "ENTREGADO" // Entregado (del tracking de Shalom)
  | "DEVUELTO" // Devuelto al remitente
  | "CANCELADO"; // Cancelado

/* -----------------------------------------
   Sub-entidades
----------------------------------------- */
export interface OrderCustomer {
  id: string;
  companyId: string;
  documentType: string | null;
  documentNumber: string | null;
  fullName: string;
  phoneNumber: string;
  clientType: "TRADICIONAL" | "EMPRESA";
  province: string;
  city: string;
  district: string;
  address: string;
  reference: string | null;
  zone?: string;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  productVariantId: string;
  sku: string;
  productName: string;
  attributes: Record<string, string>;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  discountType: "NONE" | "PERCENTAGE" | "FIXED";
  discountAmount: string;
  imageUrl?: string;
  isPromoItem?: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderPayment {
  id: string;
  paymentMethod: "EFECTIVO" | "TRANSFERENCIA" | "TARJETA";
  amount: string;
  externalReference: string | null;
  paymentProofUrl: string | null;
  status: "PENDING" | "PAID" | "LOST";
  notes: string | null;
  paymentDate: string;
  created_at: string;
  updated_at: string;
}

/* -----------------------------------------
   OrderHeader (principal)
----------------------------------------- */
export interface OrderHeader {
  id: string;
  receiptType: ReceiptType;
  orderType: OrderType;
  orderNumber: string;
  storeId: string;
  customer: Client;
  salesChannel: SalesChannel;
  closingChannel: SalesChannel;
  deliveryType: DeliveryType;
  courierId: string | null;
  courier: string | null;
  guideNumber?: string | null;
  subtotal: string;
  taxTotal: string;
  shippingTotal: string;
  discountTotal: string;
  grandTotal: string;
  status: OrderStatus;
  salesRegion: "LIMA" | "PROVINCIA";
  taxMode?: "AUTOMATICO" | "INCLUIDO";
  callStatus?: "PENDING" | "NO_ANSWER" | "CONFIRMED" | "SCHEDULED" | null;
  callbackAt?: string | null;
  callAttempts?: number;
  cancellationReason: string | null;
  notes: string | null;
  items: OrderItem[];
  payments: OrderPayment[];
  hasStockIssue?: boolean;

  // ========================================
  // ✅ CAMPOS DE TRACKING EXISTENTES
  // ========================================
  externalTrackingNumber?: string | null;
  shippingCode?: string | null;
  shippingKey?: string | null;
  shippingOffice?: string | null;
  shippingProofUrl?: string | null;
  trackingUrl?: string | null;
  carrierShippingCost?: string | number | null;

  // ========================================
  // ✅ CAMPOS DE ALICLIK
  // ========================================
  aliclikDispatchStatus?: string | null;
  aliclikSyncedAt?: string | null;

  // ========================================
  // ✅ NUEVOS CAMPOS DE SHALOM
  // ========================================
  shalomStatus?: ShalomStatus | null;
  shalomError?: string | null;
  shalomSerie?: string | null;
  shalomOriginAgency?: string | null;
  shalomDestinationAgency?: string | null;
  shalomRecipientDoc?: string | null;
  shalomRecipientPhone?: string | null;
  shalomContent?: string | null;

  // Campos existentes
  sellerName?: string | null;
  externalSource?: string | null;
  externalId?: string | null;
  syncErrors?: Record<string, string> | null;
  externalData?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;

  // ========================================
  // CC v2 — Call Center
  // ========================================
  canalOrigen?: string | null;
  subEstadoCc?: SubEstadoCc | null;
  ccAgenteId?: string | null;
  ccConfirmadoAt?: string | null;
  ccConfirmadoBy?: string | null;
  datosCompletos?: boolean;
  dniCliente?: string | null;
  referenciaEntrega?: string | null;
  horarioEntregaLima?: string | null;
}

/* -----------------------------------------
   CC v2 — Tipos auxiliares
----------------------------------------- */
export type SubEstadoCc =
  | "por_confirmar"
  | "contactado"
  | "no_contesta"
  | "anulado_cc"
  | "confirmado"
  | "reprogramado"
  | "entrega_lima"
  | "carrito_sin_contactar"
  | "carrito_contactado"
  | "carrito_recuperado";

export type TipoGestionCC = "cod" | "lima" | "carrito";

export interface CanalConfig {
  id: string;
  empresaId: string | null;
  canalNombre: string;
  canalLabel: string;
  flujoEntrada: "directo_operaciones" | "call_center_cod" | "call_center_carrito";
  requiereConfirmacionCc: boolean;
  activo: boolean;
  datosRequeridos: string[];
}

export interface KpisCC {
  [key: string]: number;
  efectividadHoy: number;
  confirmadosMes: number;
  gestionadosMes: number;
  efectividadMes: number;
  upsellHoy: number;
  upsellMensual: number;
}

export interface AgenteConKpis {
  id: string;
  nombre: string | null;
  email: string | null;
  ccActivo: boolean;
  ccRol: string | null;
  ccMaxPedidos: number;
  pedidosPendientes: number;
  gestionadosHoy: number;
  cierresHoy: number;
  totalAsignados: number;
  totalConfirmados: number;
  tasaCierre: number;
  productosVendidos: number;
}

export interface CcKpisFinancierosResponse {
  facturacionConfirmada: number;
  countConfirmados: number;
  pendienteConfirmar: number;
  countPendiente: number;
  porCobrar: number;
  countPorCobrar: number;
  ventasPerdidas: number;
  countPerdidos: number;
  ticketPromedio: number;
}

export interface AgentePerformanceKpis {
  id: string;
  nombre: string | null;
  email: string | null;
  ccActivo: boolean;
  ccRol: string | null;
  asignados: number;
  contactados: number;
  confirmados: number;
  entregados: number;
  ventasConfirmadas: number;
  ticketPromedio: number;
  pctContactados: number;
  pctConfirmados: number;
  pctEntregados: number;
  // Fase 4b — Leaderboard
  unidades: number;
  facturacionBase: number;
  upsellMonto: number;
  ticketFinal: number;
}

/* -----------------------------------------
   Fase 4 — Upsell por tienda
----------------------------------------- */
export interface CcUpsellTiendaItem {
  shop: string | null;
  pedidosConfirmados: number;
  conUpsell: number;
  pctConUpsell: number;
  facturacionBase: number;
  upsellMonto: number;
  upsellUnidades: number;
  ticketBase: number;
  ticketConUpsell: number;
  pctIncremento: number;
  promUnidadesPorPedido: number;
}

export interface CcUpsellConsolidado {
  pedidosConfirmados: number;
  conUpsell: number;
  pctConUpsell: number;
  facturacionBase: number;
  upsellMonto: number;
  upsellUnidades: number;
  ticketBase: number;
  ticketConUpsell: number;
  pctIncremento: number;
  promUnidadesPorPedido: number;
  pctSobreBase: number;
}

export interface CcUpsellResponse {
  tiendas: CcUpsellTiendaItem[];
  consolidado: CcUpsellConsolidado;
}

export interface CcKpisFunnelDistribucionBucket {
  count:      number;
  percentage: number;
}

export interface CcKpisFunnelDistribucion {
  total:       number;
  pendiente:   CcKpisFunnelDistribucionBucket;
  confirmado:  CcKpisFunnelDistribucionBucket;
  noContesta:  CcKpisFunnelDistribucionBucket;
  anulado:     CcKpisFunnelDistribucionBucket;
}

export interface CcKpisFunnelSubBreakdown {
  despachado: CcKpisFunnelDistribucionBucket; // % sobre confirmado
  entregado:  CcKpisFunnelDistribucionBucket; // % sobre confirmado
}

export interface CcKpisFunnelResponse {
  ingresados:      { count: number };
  gestionados:     { count: number; percentage: number };
  confirmados:     { count: number; percentage: number };
  despachados:     { count: number; percentage: number };
  entregados:      { count: number; percentage: number };
  conversionFinal: { percentage: number };
  // Campos opcionales — agregados aditivamente por el backend (Fase 5)
  distribucion?:   CcKpisFunnelDistribucion;
  subBreakdown?:   CcKpisFunnelSubBreakdown;
}

export interface CcStorePerformanceItem {
  shop:            string | null;
  ingresados:      number;
  confirmados:     number;
  tasaConversion:  number;
}

/* -----------------------------------------
   Fase 6 — Aging heatmap
----------------------------------------- */
export interface CcAgingDiasBuckets {
  d0: number;
  d1: number;
  d2: number;
  d3: number;
  d4: number;
  d5: number;
  d6plus: number;
}

export interface CcAgingEstadoRow {
  estado: 'PENDIENTE' | 'NO_CONTESTA' | 'DESPACHADO';
  dias: CcAgingDiasBuckets;
  total: number;
}

export interface CcAgingResponse {
  estados: CcAgingEstadoRow[];
  zonaCriticaTotal: number;
}

/* -----------------------------------------
   Fase 7 — Análisis de intentos
----------------------------------------- */
export interface CcIntentoBucket {
  etiqueta: '1' | '2' | '3' | '3+';
  totalLlamadas: number;
  confirmados: number;
  noContesta: number;
  rechazados: number;
  tasaExito: number; // porcentaje 0–100
}

export interface CcIntentosResponse {
  intentos: CcIntentoBucket[]; // siempre 4 buckets en orden 1, 2, 3, 3+
}

/* -----------------------------------------
   FEAT-04 — Upsell records (tabla dedicada)
----------------------------------------- */
export interface CcUpsellRecordItem {
  id: string;
  orderNumber: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  addedByName: string | null;  // quien hizo el upsell
  sellerName: string | null;   // vendedor atribuido al pedido
  shop: string | null;
  createdAt: string;           // ISO
}

export interface CcUpsellRecordsResponse {
  items: CcUpsellRecordItem[];
  totalMonto: number;
  totalUnidades: number;
  totalRegistros: number;
}
