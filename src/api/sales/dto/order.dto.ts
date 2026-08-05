import { ClientType, DeliveryType, DiscountType, DocumentType, LogOperation, OrderStatus, OrderType, PaymentMethod, PaymentStatus, ReceiptType, SalesChannel, TaxMode } from '../types/order.types';

export interface CustomerResponseDto {
  id: string;
  companyId: string;

  documentType: DocumentType;
  documentNumber: string;

  fullName: string;
  phoneNumber: string;
  email: string | null;

  clientType: ClientType;

  province: string;
  city: string;
  district: string;
  address: string;
  reference: string | null;
  zone: string;

  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string | null;

  isActive: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface OrderItemResponseDto {
  id: string;

  productVariantId: string | null;

  sku: string;
  productName: string;

  attributes?: Record<string, string>;

  quantity: number;

  unitPrice: string;
  subtotal: string;

  discountType: DiscountType;
  discountAmount: string;

  isPromoItem: boolean;

  addedByUserId: string | null;
  addedAt: string | null;

  brandId: string | null;
  brandName: string | null;

  categoryId: string | null;
  categoryName: string | null;

  externalData: unknown;
  imageUrl: string | null;

  created_at: string;
  updated_at: string;
}

export interface PaymentResponseDto {
  id: string;

  paymentMethod: PaymentMethod;
  amount: string;

  externalReference: string | null;
  paymentProofUrl: string | null;

  status: PaymentStatus;
  notes: string | null;

  paymentDate: string;

  created_at: string;
  updated_at: string;
}

export interface OrderLogResponseDto {
  id: number;

  operacion: LogOperation;
  comentarios?: string;

  userId: string | null;
  userName: string | null;

  data: Record<string, unknown>;

  isSystemGenerated: boolean;

  timestamp: string;
}

export interface OrderResponseDto {
  id: string;
  receiptType: ReceiptType;
  orderType: OrderType;
  orderNumber: string;
  storeId: string;

  customer: CustomerResponseDto;

  salesChannel: SalesChannel;
  closingChannel: SalesChannel;

  deliveryType: DeliveryType;
  courierId: string | null;
  courier: string;

  guideNumber: string | null;

  subtotal: string;
  taxTotal: string;
  shippingTotal: string;
  discountTotal: string;
  grandTotal: string;

  status: OrderStatus;
  salesRegion: string;
  cancellationReason: string | null;

  notes: string;
  taxMode: TaxMode;

  callStatus: string | null;
  callAttempts: number;
  callbackAt: string | null;

  sellerId: string;
  sellerName: string | null;

  externalTrackingNumber: string | null;
  shippingKey: string | null;
  trackingUrl: string | null;
  shippingOffice: string | null;
  shippingCode: string | null;
  shippingProofUrl: string | null;

  carrierShippingCost: string;
  costAmount: string;
  channelFee: string;

  items: OrderItemResponseDto[];
  payments: PaymentResponseDto[];
  logs: OrderLogResponseDto[];

  externalSource: string | null;
  externalData: unknown;
  syncErrors: unknown;

  shalomStatus: string | null;
  shalomError: string | null;
  shalomSerie: string | null;
  shalomOriginAgency: string | null;
  shalomDestinationAgency: string | null;
  shalomRecipientDoc: string | null;
  shalomRecipientPhone: string | null;
  shalomContent: string | null;

  canalOrigen: string | null;

  subEstadoCc: string | null;
  ccAgenteId: string | null;
  ccConfirmadoAt: string | null;
  ccConfirmadoBy: string | null;

  datosCompletos: boolean;
  dniCliente: string | null;
  referenciaEntrega: string | null;
  horarioEntregaLima: string | null;

  metaPubliId: string | null;

  aliclikDispatchStatus: string | null;
  aliclikSyncedAt: string | null;

  sunatStatus: string | null;
  sunatSerie: string | null;
  sunatCorrelativo: string | null;
  sunatCode: string | null;
  sunatDescription: string | null;
  sunatObservations: string | null;
  sunatError: string | null;

  created_at: string;
  updated_at: string;

  hasStockIssue: boolean;

  shopifyOrderId: string | null;
  shopifyOrderNumber: string | null;

  discountCodes: string[];
}
