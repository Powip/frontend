import {
  bulkCreateOlvaShipmentsApi,
  createOlvaShipmentApi,
  discardOlvaShipmentApi,
  getOlvaShipmentApi,
  getOlvaShipmentLabelApi,
  getOlvaShipmentsApi,
  regenerateOlvaShipmentPaymentLinkApi,
  retryOlvaShipmentApi,
} from "../api/olva-shipment.api";
import { toBulkCreateOlvaShipmentsRequestDto } from "../mappers/to-bulk-create-olva-shipments-request.dto";
import { toCreateOlvaShipmentRequestDto } from "../mappers/to-create-olva-shipment-request.dto";
import { toListOlvaShipmentsQueryDto } from "../mappers/to-list-olva-shipments-query.dto";
import { toOlvaBulkCreateShipmentsResult } from "../mappers/to-olva-bulk-create-shipments-result";
import { toOlvaBulkShipmentResult } from "../mappers/to-olva-bulk-shipment-result";
import { toOlvaCreatedShipment } from "../mappers/to-olva-created-shipment";
import { toOlvaShipment } from "../mappers/to-olva-shipment";
import { toOlvaShipmentLabel } from "../mappers/to-olva-shipment-label";
import { toOlvaShipmentsPage } from "../mappers/to-olva-shipments-page";
import type { BulkCreateOlvaShipmentsInput } from "../models/bulk-create-olva-shipments-input";
import type {
  CreateOlvaShipmentInput,
  RetryOlvaShipmentVariables,
} from "../models/create-olva-shipment-input";
import type {
  OlvaBulkCreateShipmentsResult,
  OlvaBulkShipmentResult,
} from "../models/olva-bulk-shipment-result";
import type { OlvaCreatedShipment } from "../models/olva-created-shipment";
import type { OlvaShipment } from "../models/olva-shipment";
import type { OlvaShipmentFilters } from "../models/olva-shipment-filters";
import type { OlvaShipmentLabel } from "../models/olva-shipment-label";
import type { OlvaShipmentsPage } from "../models/olva-shipments-page";

export async function createOlvaShipment(
  input: CreateOlvaShipmentInput,
): Promise<OlvaCreatedShipment> {
  return toOlvaCreatedShipment(await createOlvaShipmentApi(toCreateOlvaShipmentRequestDto(input)));
}

export async function bulkCreateOlvaShipments(
  input: BulkCreateOlvaShipmentsInput,
): Promise<OlvaBulkCreateShipmentsResult> {
  const responseDto = await bulkCreateOlvaShipmentsApi(toBulkCreateOlvaShipmentsRequestDto(input));

  return toOlvaBulkCreateShipmentsResult(responseDto);
}

export async function getOlvaShipments(
  filters: OlvaShipmentFilters = {},
): Promise<OlvaShipmentsPage> {
  return toOlvaShipmentsPage(await getOlvaShipmentsApi(toListOlvaShipmentsQueryDto(filters)));
}

export async function getOlvaShipment(id: string): Promise<OlvaShipment> {
  return toOlvaShipment(await getOlvaShipmentApi(id));
}

export async function regenerateOlvaShipmentPaymentLink(id: string): Promise<OlvaShipment> {
  return toOlvaShipment(await regenerateOlvaShipmentPaymentLinkApi(id));
}

export async function getOlvaShipmentLabel(id: string): Promise<OlvaShipmentLabel> {
  return toOlvaShipmentLabel(await getOlvaShipmentLabelApi(id));
}

/** Sends a registration Olva did not confirm again, with its own key; answers like a lot item. */
export async function retryOlvaShipment({
  id,
  confirmed = false,
}: RetryOlvaShipmentVariables): Promise<OlvaBulkShipmentResult> {
  return toOlvaBulkShipmentResult(await retryOlvaShipmentApi(id, confirmed));
}

/** Gives up a shipment whose payment expired; the order can be registered again. */
export async function discardOlvaShipment(id: string): Promise<OlvaShipment> {
  return toOlvaShipment(await discardOlvaShipmentApi(id));
}
