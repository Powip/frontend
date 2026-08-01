export type DocumentType =
  | "DNI"
  | "CARNET"
  | "PASAPORTE"
  | "RUC"

export type ClientType =
  | "TRADICIONAL"
  | "MAYORISTA"

export type DiscountType =
  | "NONE"
  | "FIXED"
  | "PERCENTAGE"
  | "COUPON"

export type PaymentMethod =
  | "YAPE"
  | "PLIN"
  | "CONTRAENTREGA"
  | "CONTRA_ENTREGA"
  | "BCP"
  | "BANCO_NACION"
  | "MERCADO_PAGO"
  | "POS"
  | "TRANSFERENCIA"
  | "EFECTIVO"

export type PaymentStatus =
  | "PENDING" // Por recaudar (promesa / contra entrega / transferencia pendiente)
  | "PAID" // Recaudado
  | "LOST" // Perdido (no se cobró / error / fraude)

export type LogOperation =
  | "CREATE"
  | "CREATE_ORDER_HEADER"
  | "CREATE_ORDER_WITH_ITEMS"
  | "ADD_ORDER_ITEM"
  | "REMOVE_ORDER_ITEM"
  | "UPDATE"
  | "REVERSE_PAYMENT"
  | "HARDDELETED"
  | "REACTIVATE"
  | "INACTIVATE"
  | "COURIER_ASSIGNED"
  | "COMMENT"
  | "SCHEDULE_CALLBACK"

export type ReceiptType =
  | "BOLETA"
  | "FACTURA"

export type OrderType =
  | "VENTA"
  | "RESERVA"
  | "PREVENTA"
  | "CAMBIO"

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
  | "PAGADO"

export type SalesChannel =
  | "TIENDA_FISICA"
  | "WHATSAPP"
  | "INSTAGRAM"
  | "FACEBOOK"
  | "MARKETPLACE"
  | "MERCADOLIBRE"
  | "WEB"
  | "SHEETS"
  | "OTRO"

export type DeliveryType =
  | "RETIRO_TIENDA"
  | "DOMICILIO"
  | "PUNTO_EXTERNO"

export type TaxMode = 
  | "AUTOMATICO"
  | "INCLUIDO"
