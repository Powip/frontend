// order.enums.ts

export enum ReceiptType {
  BOLETA = "BOLETA",
  FACTURA = "FACTURA",
}

export enum OrderType {
  VENTA = "VENTA",
  RESERVA = "RESERVA",
  PREVENTA = "PREVENTA",
}

export enum SalesChannel {
  TIENDA_FISICA = "TIENDA_FISICA",
  WHATSAPP = "WHATSAPP",
  INSTAGRAM = "INSTAGRAM",
  FACEBOOK = "FACEBOOK",
  MARKETPLACE = "MARKETPLACE",
  MERCADOLIBRE = "MERCADOLIBRE",
  OTRO = "OTRO",
}

export enum DeliveryType {
  RETIRO_TIENDA = "RETIRO_TIENDA",
  DOMICILIO = "DOMICILIO",
  PUNTO_EXTERNO = "PUNTO_EXTERNO",
}

export enum OrderStatus {
  CONFIRMADA = "CONFIRMADA",
  PAGADA = "PAGADA",
}
