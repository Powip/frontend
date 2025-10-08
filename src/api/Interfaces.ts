
// INTERFACES DE PRODUCTOS
export interface IGetCategory {
  id: string;
  name: string;
  description: string;
  sku: string;
  status: boolean;
}

export interface IGetSubCategory {
  id: string;
  name: string;
  description: string;
  sku: string;
  status: boolean;
  category: IGetCategory;
  attribute_type_ids: string[];
  created_at: string;
  updated_at: string; 
}

export interface IGetBrand {
  id: string;
  name: string;
  isActive: boolean;
  created_at: string;
  updated_at: string;
}

export interface IGetProducts {
  id: string;
  name: string;
  description: string;
  priceBase: number;
  priceVta: number;
  sku: string;
  categoryId: string;
  subcategoryId: string;
  companyId: string;
  brandId: string;
  availability: boolean;
  status: boolean;
  images: string[];
  created_at: string;
  updated_at: string; 
}


export interface IProductFilters {
  companyId?: string;
  status?: boolean;
  brandId?: string;
  categoryId?: string;
  subcategoryId?: string;
  name?: string;
  description?: string;
}

// INTERFACES DE COMPAÑIAS

export interface IGetCompany {
  id: string;
  name: string;
  description: string;
  logo_url: string | null;
  is_active: boolean;
  owner_id: string;
  cuit: string;
  billing_address: string;
  phone: string;
  billing_email: string;
  currency: string;
  language: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  disabled_at: string | null;
  enabled_at: string | null;
}


// INTERFACES DE VENTAS

export interface ICreateOrderHeader {
   receiptType: string;        // Ej: FACTURA
  managementType: string;     // Ej: venta, canje, reserva
  storeAssigned: string;
  deliveryPoint: string;
  salesChannel: string;
  closingChannel: string;
  gestion: string;
  store: string;
  courier: string;
  reference?: string;         // opcional
  totalAmount: number;
  totalVat: number;
  totalShippingCost: number;
  customerId: string;         // DNI o ID cliente
  status: string;             // Ej: PENDING
}

// =============================
// ORDER HEADER (cabecera)
// =============================

export interface CreateOrderHeaderDto {
  receiptType: string;          // Ej: FACTURA, TICKET
  managementType: string;       // Ej: venta, canje, reserva
  storeAssigned: string;        // Tienda asignada
  deliveryPoint: string;        // Punto de entrega
  salesChannel: string;         // Canal de venta (Web, Presencial, etc.)
  closingChannel: string;       // Canal de cierre
  gestion: string;              // Gestión
  store: string;                // Tienda origen
  courier: string;              // Envío por (Courier/Transporte)
  reference?: string;           // Referencia opcional
  totalAmount: number;          // Monto total
  totalVat: number;             // IVA total
  totalShippingCost: number;    // Costo de envío
  customerId: string;           // DNI o ID del cliente
  status: string;               // Estado de la orden (PENDING, CONFIRMED, etc.)
}

export interface OrderHeader extends CreateOrderHeaderDto {
  id: string;                   // ID generado por la API
  createdAt: string;
  updatedAt: string;
}

// =============================
// ORDER ITEMS (productos en la orden)
// =============================

export interface AttributeDto {
  name: string;                 // Ej: Color, Talla
  value: string;                // Ej: Rojo, M
  unit?: string;                // Ej: cm, kg (opcional)
}

export interface CreateOrderItemsDto {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountType: string;         // porcentaje | monto
  discountAmount: number;
  attributes?: AttributeDto[];
  observations?: string;
  status: string;               // ACTIVE, CANCELLED, etc.
}

export interface OrderItem extends CreateOrderItemsDto {
  id: string;
  orderId: string;
  createdAt: string;
  updatedAt: string;
}

// =============================
// ORDER + ITEMS juntos
// =============================

export interface CreateOrderHeaderPlusItemsDto extends CreateOrderHeaderDto {
  items: CreateOrderItemsDto[];
}

// =============================
// PAYMENTS
// =============================

export interface CreatePaymentDto {
  orderId: string;
  paymentMethod: string;        // Ej: tarjeta, efectivo
  amount: number;
  paymentDate?: string;         // ISO date string
  paymentProof?: string;        // URL o código comprobante
  generalNote?: string;
  status?: string;              // CONFIRMED, PENDING
  externalReference?: string;   // ID externo (ej: pasarela de pagos)
}

export interface CompletePaymentDto extends CreatePaymentDto {
  advancePayment: number;       // Monto adelantado
}

export interface Payment extends CreatePaymentDto {
  id: string;
  createdAt: string;
  updatedAt: string;
}


// INTERFACES DE CLIENTES

export interface IClient {
  id: string;
  documentNumber?: string;
  ruc?: string;
  companyId?: string;
  businessName?: string;
  name?: string;
  lastName?: string;
  nickName?: string;
  phoneNumber?: string;
  clientType?: string;
  city?: string;
  province?: string;
  district?: string;
  address?: string;
  reference?: string;
  is_active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// INTERFACES DE Ventas

// ===============
// 📦 ORDENES
// ===============

export interface ICreateOrderHeader {
  clientId: string;
  companyId: string;
  total: number;
  date?: string;
  notes?: string;
}

export interface ICreateOrderHeaderPlusItems extends ICreateOrderHeader {
  items: ICreateOrderItemsDto[];
}

export interface IUpdateOrderHeaderDto {
  total?: number;
  date?: string;
  notes?: string;
  status?: string;
}

export interface ICreateOrderItemsDto {
  productId: string;
  quantity: number;
  price: number;
  discount?: number;
}

export interface IOrder {
  id: string;
  clientId: string;
  companyId: string;
  total: number;
  status: string;
  date: string;
  items: IOrderItem[];
}

export interface IOrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  discount?: number;
  subtotal: number;
}

// ===============
// 💳 PAGOS
// ===============

export interface ICreatePaymentDto {
  orderId: string;
  amount: number;
  method: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA";
  date?: string;
}

export interface IUpdatePaymentDto {
  amount?: number;
  method?: string;
  status?: string;
}

export interface IPayment {
  id: string;
  orderId: string;
  amount: number;
  method: string;
  status: string;
  date: string;
}

// ===============
// 📜 LOGS
// ===============

export interface ILogVenta {
  id: string;
  orderId: string;
  action: string;
  date: string;
  user: string;
}
