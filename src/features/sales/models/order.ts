import type {
  DeliveryType,
  OrderStatus,
  OrderType,
  ReceiptType,
  SalesChannel,
  TaxMode,
} from "@/features/sales/types/order.types";
import type { Customer } from "./customer";
import type { OrderItem } from "./order-item";
import type { OrderLog } from "./order-log";
import type { Payment } from "./payment";

export interface Order {
  id: string;

  receiptType: ReceiptType;
  orderType: OrderType;

  orderNumber: string;
  storeId: string;

  customer: Customer;

  salesChannel: SalesChannel;
  closingChannel: SalesChannel;

  deliveryType: DeliveryType;

  courierId: string | null;
  courier: string;
  guideNumber: string | null;

  subtotal: number;
  taxTotal: number;
  shippingTotal: number;
  discountTotal: number;
  grandTotal: number;

  status: OrderStatus;

  salesRegion: string;
  cancellationReason: string | null;

  notes: string;

  taxMode: TaxMode;

  callStatus: string | null;
  callAttempts: number;
  callbackAt: Date | null;

  sellerId: string;
  sellerName: string | null;

  externalTrackingNumber: string | null;
  shippingKey: string | null;
  trackingUrl: string | null;
  shippingOffice: string | null;
  shippingCode: string | null;
  shippingProofUrl: string | null;

  carrierShippingCost: number;
  costAmount: number;
  channelFee: number;

  items: OrderItem[];
  payments: Payment[];
  logs: OrderLog[];

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
  ccConfirmadoAt: Date | null;
  ccConfirmadoBy: string | null;

  datosCompletos: boolean;
  dniCliente: string | null;
  referenciaEntrega: string | null;
  horarioEntregaLima: string | null;

  metaPubliId: string | null;

  aliclikDispatchStatus: string | null;
  aliclikSyncedAt: Date | null;

  sunatStatus: string | null;
  sunatSerie: string | null;
  sunatCorrelativo: string | null;
  sunatCode: string | null;
  sunatDescription: string | null;
  sunatObservations: string | null;
  sunatError: string | null;

  createdAt: Date;
  updatedAt: Date;

  hasStockIssue: boolean;

  shopifyOrderId: string | null;
  shopifyOrderNumber: string | null;

  discountCodes: string[];
}
