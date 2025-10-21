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
export interface CreateOrderHeaderDto {
  receiptType: string;
  managementType: string;
  storeAssigned: string;
  deliveryPoint: string;
  salesChannel: string;
  closingChannel: string;
  gestion: string;
  store: string;
  courier: string;
  reference?: string;
  totalAmount: number;
  totalVat: number;
  totalShippingCost: number;
  customerId: string;
  status: string;
}

export interface ICreateOrderHeader {
  clientId: string;
  companyId?: string;
  total: number;
  date?: string;
  notes?: string;
  id?: string | undefined;
  totalAmount: number;
  totalVat: number;
  totalShippingCost: number;
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
export interface ICreateOrderHeaderPlusItems  {
  items: IAddItem[];
}


export interface OrderHeader extends CreateOrderHeaderDto {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttributeDto {
  name: string;
  value: string;
  unit?: string;
}

export interface CreateOrderItemsDto {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountType: string;
  discountAmount: number;
  attributes?: AttributeDto[];
  observations?: string;
  status: string;
}

export interface OrderItem extends CreateOrderItemsDto {
  id: string;
  orderId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderHeaderPlusItemsDto extends CreateOrderHeaderDto {
  items: CreateOrderItemsDto[];
}

export interface CreatePaymentDto {
  orderId: string;
  paymentMethod: string;
  amount: number;
  paymentDate?: string;
  paymentProof?: string;
  generalNote?: string;
  status?: string;
  externalReference?: string;
}

export interface CompletePaymentDto extends CreatePaymentDto {
  advancePayment: number;
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

export interface IOrderItemAttribute {
  name: string;
  value: string | number;
  unit?: string;
}

export interface IOrder {
  id?: string | undefined;
  totalAmount: number;
  totalVat: number;
  totalShippingCost: number;
}

export interface IOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  priceVta: number;
  priceBase: number;
  unitPrice: number;
  discountType?: "PORCENTAJE" | "MONTO";
  discountValue?: string | number;
  discountAmount?: number;
  attributes?: IOrderItemAttribute[];
  observations?: string;
  status?: boolean;
}

export interface IAddItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number | string;
  discountType:  string | null;
  discountValue: number | null;
  priceBase?: number;
  discountAmount?: number;
  observations?: string;
  attributes?: IOrderItemAttribute[];
}

export interface ICreateOrderHeader {
  id?: string;
  receiptType?: string;
  managementType?: string;
  companyId?: string;
  store: string;
  storeAssigned?: string;
  deliveryPoint?: string;
  salesChannel?: string;
  closingChannel?: string;
  gestion?: string;
  courier?: string;
  reference?: string;
  totalAmount: number;
  totalVat: number;
  totalShippingCost: number;
  customerId?: string;
  status?: string;
  items?: IOrderItem[];
}

export interface ICreatePaymentDto {
  orderId: string;
  paymentMethod: string;
  paymentDate: string;
  paymentProof: string;
  generalNote: string;
  status: string;
  amount: number;
  method?: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA";
  date?: string;
  externalReference: string;
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

export interface ILogVenta {
  id: string;
  orderId: string;
  action: string;
  date: string;
  user: string;
}
