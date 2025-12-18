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
}
/* -----------------------------------------
   Enums (alineados al backend)
----------------------------------------- */
export type ReceiptType = "BOLETA" | "FACTURA";

export type OrderType = "VENTA" | "RESERVA" | "PREVENTA";

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
  | "PENDIENTE"
  | "CONFIRMADA"
  | "PAGADA"
  | "EN_PREPARACION"
  | "ENVIADA"
  | "ENTREGADA"
  | "ANULADA";

/* -----------------------------------------
   Sub-entidades
----------------------------------------- */
export interface OrderCustomer {
  id: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  phoneNumber: string;
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
}

export interface OrderPayment {
  id: string;
  paymentMethod: string;
  amount: string;
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
  customer: OrderCustomer;
  salesChannel: SalesChannel;
  closingChannel: SalesChannel;
  deliveryType: DeliveryType;
  courierId?: string | null;
  subtotal: string;
  taxTotal: string;
  shippingTotal: string;
  discountTotal: string;
  grandTotal: string;
  status: OrderStatus;
  notes?: string | null;
  items: OrderItem[];
  payments: OrderPayment[];
  created_at: string;
  updated_at: string;
}
