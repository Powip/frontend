import axiosAuth from "@/lib/axiosAuth";
import { OLVA_API_BASE_URL } from "../../shared/constants/olva-api.constants";
import type { TrackOlvaShipmentRequestDto } from "../dto/track-olva-shipment-request.dto";
import type { TrackOlvaShipmentResponseDto } from "../dto/track-olva-shipment-response.dto";
import type { TrackOlvaShipmentsBatchRequestDto } from "../dto/track-olva-shipments-batch-request.dto";
import type { TrackOlvaShipmentsBatchResponseDto } from "../dto/track-olva-shipments-batch-response.dto";

const OLVA_TRACK_BASE = `${OLVA_API_BASE_URL}/track`;

// POST /olva/track -> 200 (a read; 404 when the guide does not exist)
export async function trackOlvaShipmentApi(
  requestDto: TrackOlvaShipmentRequestDto,
): Promise<TrackOlvaShipmentResponseDto> {
  const { data } = await axiosAuth.post<TrackOlvaShipmentResponseDto>(OLVA_TRACK_BASE, requestDto);

  return data;
}

// POST /olva/track/batch -> 200 { results } (one item per guide, failures included)
export async function trackOlvaShipmentsBatchApi(
  requestDto: TrackOlvaShipmentsBatchRequestDto,
): Promise<TrackOlvaShipmentsBatchResponseDto> {
  const { data } = await axiosAuth.post<TrackOlvaShipmentsBatchResponseDto>(
    `${OLVA_TRACK_BASE}/batch`,
    requestDto,
  );

  return data;
}
