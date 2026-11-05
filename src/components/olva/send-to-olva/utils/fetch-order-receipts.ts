import axios from "axios";
import type { OrderDetail } from "@/components/modals/GuideDetailsModal";
import type { OrderHeader } from "@/interfaces/IOrder";
import { API } from "@/lib/api";
import {
  requiresAuthenticatedSaleMutation,
  saleReceiptUrl,
  type UnitAssignmentState,
} from "@/services/saleTrackingService";
import type { OrderReceipt } from "@/utils/printOrderLabel";

export type PrintableOrder = OrderDetail;

// The guide modal loads orders as `OrderDetail`, a looser shape than the sale services expect
// (`UnitAssignmentState`, `OrderHeader`). The fields they read are present at runtime, so these
// two seams are the only casts, instead of `any` all through the flow.
export const asSaleState = (order: PrintableOrder): UnitAssignmentState =>
  order as unknown as UnitAssignmentState;

export const asOrderHeader = (order: PrintableOrder): OrderHeader =>
  order as unknown as OrderHeader;

export interface ReceiptRequestContext {
  companyId: string;
  token?: string;
  signal: AbortSignal;
}

const MISMATCH_MESSAGE = "El comprobante no corresponde al pedido solicitado.";

function assertReceiptMatchesOrder(
  receipt: OrderReceipt | undefined,
  order: PrintableOrder,
  companyId: string,
  requireItems: boolean,
): asserts receipt is OrderReceipt {
  const staleStock =
    Number.isSafeInteger(order.stockVersion) &&
    Number.isSafeInteger(receipt?.stockVersion) &&
    (receipt?.stockVersion as number) < (order.stockVersion as number);

  if (
    !receipt ||
    receipt.orderId !== order.id ||
    (receipt.companyId !== undefined && receipt.companyId !== companyId) ||
    staleStock ||
    (requireItems && (typeof receipt.status !== "string" || !Array.isArray(receipt.items)))
  ) {
    throw new Error(MISMATCH_MESSAGE);
  }
}

/** The public receipt of an order, checked to be that order's, in this company, and not stale. */
export async function fetchOrderReceipt(
  order: PrintableOrder,
  { companyId, token, signal }: ReceiptRequestContext,
  { requireItems = false }: { requireItems?: boolean } = {},
): Promise<OrderReceipt> {
  const { data } = await axios.get<OrderReceipt>(
    saleReceiptUrl(API.ventas, order.id, asSaleState(order)),
    {
      signal,
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    },
  );

  assertReceiptMatchesOrder(data, order, companyId, requireItems);

  return data;
}

/**
 * The orders ready for the departure guide. Orders with tracked units take their items and unit
 * state from the receipt; quantity-only ones are printed as they are.
 */
export function loadPrintableGuideOrders(
  orders: readonly PrintableOrder[],
  context: ReceiptRequestContext,
): Promise<PrintableOrder[]> {
  return Promise.all(
    orders.map(async (order) => {
      if (!requiresAuthenticatedSaleMutation(asSaleState(order))) return order;

      const receipt = await fetchOrderReceipt(order, context, { requireItems: true });

      return {
        ...order,
        status: receipt.status,
        unitAssignmentStatus: receipt.unitAssignmentStatus,
        unitCatalogValidated: receipt.unitCatalogValidated,
        stockVersion: receipt.stockVersion,
        confirmedStockVersion: receipt.confirmedStockVersion,
        items: receipt.items,
      } as unknown as PrintableOrder;
    }),
  );
}
