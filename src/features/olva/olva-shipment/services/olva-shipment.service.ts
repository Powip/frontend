import {
  bulkCreateOlvaShipmentsApi,
  createOlvaShipmentApi,
  getOlvaShipmentApi,
  getOlvaShipmentLabelApi,
  getOlvaShipmentsApi,
  regenerateOlvaShipmentPaymentLinkApi,
} from "../api/olva-shipment.api";
import { toBulkCreateOlvaShipmentsRequestDto } from "../mappers/to-bulk-create-olva-shipments-request.dto";
import { toCreateOlvaShipmentRequestDto } from "../mappers/to-create-olva-shipment-request.dto";
import { toListOlvaShipmentsQueryDto } from "../mappers/to-list-olva-shipments-query.dto";
import { toOlvaBulkCreateShipmentsResult } from "../mappers/to-olva-bulk-create-shipments-result";
import { toOlvaCreatedShipment } from "../mappers/to-olva-created-shipment";
import { toOlvaShipment } from "../mappers/to-olva-shipment";
import { toOlvaShipmentLabel } from "../mappers/to-olva-shipment-label";
import { toOlvaShipmentsPage } from "../mappers/to-olva-shipments-page";
import type { BulkCreateOlvaShipmentsInput } from "../models/bulk-create-olva-shipments-input";
import type { CreateOlvaShipmentVariables } from "../models/create-olva-shipment-input";
import type { OlvaBulkCreateShipmentsResult } from "../models/olva-bulk-shipment-result";
import type { OlvaCreatedShipment } from "../models/olva-created-shipment";
import type { OlvaShipment } from "../models/olva-shipment";
import type { OlvaShipmentFilters } from "../models/olva-shipment-filters";
import type { OlvaShipmentLabel } from "../models/olva-shipment-label";
import type { OlvaShipmentsPage } from "../models/olva-shipments-page";

export async function createOlvaShipment({
  input,
  idempotencyKey,
}: CreateOlvaShipmentVariables): Promise<OlvaCreatedShipment> {
  const responseDto = await createOlvaShipmentApi(
    toCreateOlvaShipmentRequestDto(input),
    idempotencyKey,
  );

  return toOlvaCreatedShipment(responseDto);
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
