import type { OrderDetail } from "@/components/modals/GuideDetailsModal";
import type { BulkCreateOlvaShipmentsFormInput } from "@/features/olva/olva-shipment/schemas/olva-bulk-shipments.schema";
import {
  SEND_TO_OLVA_DEFAULT_DELIVERY_TYPE,
  SEND_TO_OLVA_DEFAULT_WEIGHT_KG,
} from "../constants/send-to-olva.constants";
import { buildOlvaPackageDescription } from "./build-olva-package-description";
import { getOlvaDocumentType } from "./get-olva-document-type";
import { normalizeOlvaPhone } from "./normalize-olva-phone";

export type SendToOlvaFormItem = BulkCreateOlvaShipmentsFormInput["items"][number];

interface OrderToOlvaFormItemOptions {
  guideId?: string;
  headquarterId?: string;
}

function toDeclaredValue(grandTotal: number | string | null | undefined): string {
  const amount = Number(grandTotal);

  return Number.isFinite(amount) && amount > 0 ? String(Math.round(amount * 100) / 100) : "";
}

/**
 * The form row for one order. Inputs hold text, so blanks are "" (never undefined) to keep them
 * controlled; the schema turns "" back into "not provided". `itemKey` is the order id, so each
 * result of the lot reads back as its order.
 */
export function orderToOlvaFormItem(
  order: OrderDetail,
  { guideId, headquarterId = "" }: OrderToOlvaFormItemOptions = {},
): SendToOlvaFormItem {
  const customer = order.customer;
  const documentNumber = (customer?.dni ?? "").replace(/\D/g, "");

  return {
    itemKey: order.id,
    recipient: {
      documentType: getOlvaDocumentType(documentNumber),
      documentNumber,
      fullName: customer?.fullName ?? "",
      phone: normalizeOlvaPhone(customer?.phoneNumber),
      email: "",
    },
    origin: { headquarterId },
    destination: {
      agencyCode: "",
      ubigeoCode: "",
      address: customer?.address ?? "",
      reference: "",
    },
    package: {
      weightKg: String(SEND_TO_OLVA_DEFAULT_WEIGHT_KG),
      sizeId: "",
      declaredValue: toDeclaredValue(order.grandTotal),
      description: buildOlvaPackageDescription(order.items),
      articleId: "",
    },
    deliveryType: SEND_TO_OLVA_DEFAULT_DELIVERY_TYPE,
    pin: "",
    externalRef: { orderId: order.id, ...(guideId ? { guideId } : {}) },
  };
}
