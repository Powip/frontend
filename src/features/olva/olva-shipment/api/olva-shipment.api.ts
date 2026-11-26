import axiosAuth from "@/lib/axiosAuth";
import { OLVA_API_BASE_URL } from "../../shared/constants/olva-api.constants";
import type { BulkCreateOlvaShipmentsRequestDto } from "../dto/bulk-create-olva-shipments-request.dto";
import type {
  BulkCreateOlvaShipmentsResponseDto,
  OlvaBulkShipmentItemResponseDto,
} from "../dto/bulk-create-olva-shipments-response.dto";
import type { CreateOlvaShipmentRequestDto } from "../dto/create-olva-shipment-request.dto";
import type { ListOlvaShipmentsQueryDto } from "../dto/list-olva-shipments-query.dto";
import type { ListOlvaShipmentsResponseDto } from "../dto/list-olva-shipments-response.dto";
import type {
  CreateOlvaShipmentResponseDto,
  OlvaShipmentLabelResponseDto,
  OlvaShipmentResponseDto,
} from "../dto/olva-shipment-response.dto";

const OLVA_SHIPMENTS_BASE = `${OLVA_API_BASE_URL}/shipments`;

function shipmentPath(id: string): string {
  return `${OLVA_SHIPMENTS_BASE}/${encodeURIComponent(id)}`;
}

// POST /olva/shipments -> 201 (with the label). The backend stores the shipment before calling
// Olva and keys it itself, so a repeated request for the same order answers 409 ALREADY_EXISTS.
export async function createOlvaShipmentApi(
  requestDto: CreateOlvaShipmentRequestDto,
): Promise<CreateOlvaShipmentResponseDto> {
  const { data } = await axiosAuth.post<CreateOlvaShipmentResponseDto>(
    OLVA_SHIPMENTS_BASE,
    requestDto,
  );
  return data;
}

// POST /olva/shipments/bulk -> 200 even when some items fail (see `results[].status`). Each order is
// stored before it goes to Olva, so `externalRef.orderId` can never get two shipments. A failure of
// the WHOLE call (plan, rate limit, timeout) is an HTTP error.
export async function bulkCreateOlvaShipmentsApi(
  requestDto: BulkCreateOlvaShipmentsRequestDto,
): Promise<BulkCreateOlvaShipmentsResponseDto> {
  const { data } = await axiosAuth.post<BulkCreateOlvaShipmentsResponseDto>(
    `${OLVA_SHIPMENTS_BASE}/bulk`,
    requestDto,
  );

  return data;
}

// GET /olva/shipments?page&limit&status&q -> 200 { data, meta }
export async function getOlvaShipmentsApi(
  params: ListOlvaShipmentsQueryDto,
): Promise<ListOlvaShipmentsResponseDto> {
  const { data } = await axiosAuth.get<ListOlvaShipmentsResponseDto>(OLVA_SHIPMENTS_BASE, {
    params,
  });

  return data;
}

// GET /olva/shipments/:id -> 200 (404 when it is not the company's)
export async function getOlvaShipmentApi(id: string): Promise<OlvaShipmentResponseDto> {
  const { data } = await axiosAuth.get<OlvaShipmentResponseDto>(shipmentPath(id));

  return data;
}

// POST /olva/shipments/:id/payment-link -> 200 (409 unless PENDING_PAYMENT / PAYMENT_EXPIRED)
export async function regenerateOlvaShipmentPaymentLinkApi(
  id: string,
): Promise<OlvaShipmentResponseDto> {
  const { data } = await axiosAuth.post<OlvaShipmentResponseDto>(
    `${shipmentPath(id)}/payment-link`,
  );

  return data;
}

// POST /olva/shipments/:id/retry -> 200, one item of the lot (409 SHIPMENT_NOT_RETRYABLE unless
// SUBMITTING; 409 SHIPMENT_MANUAL_REVIEW past an hour without `confirmed: true`)
export async function retryOlvaShipmentApi(
  id: string,
  confirmed: boolean,
): Promise<OlvaBulkShipmentItemResponseDto> {
  const { data } = await axiosAuth.post<OlvaBulkShipmentItemResponseDto>(
    `${shipmentPath(id)}/retry`,
    {
      confirmed,
    },
  );
  return data;
}

// POST /olva/shipments/:id/discard -> 200 (409 unless PAYMENT_EXPIRED). Releases the order.
export async function discardOlvaShipmentApi(id: string): Promise<OlvaShipmentResponseDto> {
  const { data } = await axiosAuth.post<OlvaShipmentResponseDto>(`${shipmentPath(id)}/discard`);
  return data;
}

// GET /olva/shipments/:id/label -> 200 (Cache-Control: no-store)
export async function getOlvaShipmentLabelApi(id: string): Promise<OlvaShipmentLabelResponseDto> {
  const { data } = await axiosAuth.get<OlvaShipmentLabelResponseDto>(`${shipmentPath(id)}/label`);

  return data;
}
