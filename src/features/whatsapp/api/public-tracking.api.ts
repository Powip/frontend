import { isAxiosError } from "axios";
import axios from "axios";
import { API } from "@/lib/api";
import { assertWhatsAppContractAvailable } from "../constants/whatsapp-contracts";
import type { WhatsAppEvidenceType } from "../enums/whatsapp.enums";
import type { PublicOrderTracking } from "../models/public-tracking.model";

/** Respuesta de GET /p/:token (ms-integrations, sin login). Fechas en ISO. */
interface PublicTrackingDto {
  store: { name: string; logoUrl: string | null };
  order: {
    number: string;
    createdAt: string | null;
    customerFirstName: string | null;
    items: { name: string; quantity: number }[] | null;
  };
  status: PublicOrderTracking["status"];
  timeline: { label: string; at: string | null; done: boolean }[] | null;
  shipping: PublicOrderTracking["shipping"];
  evidence: { type: WhatsAppEvidenceType; imageUrl: string; takenAt: string | null }[];
  invoice: PublicOrderTracking["invoice"];
  updatedAt: string | null;
}

const toDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function toPublicOrderTracking(dto: PublicTrackingDto): PublicOrderTracking {
  return {
    store: dto.store,
    order: { ...dto.order, createdAt: toDate(dto.order?.createdAt) },
    status: dto.status,
    timeline: dto.timeline?.map((step) => ({ ...step, at: toDate(step.at) })) ?? null,
    shipping: dto.shipping ?? null,
    evidence: (dto.evidence ?? []).map((item) => ({ ...item, takenAt: toDate(item.takenAt) })),
    invoice: dto.invoice ?? null,
    updatedAt: toDate(dto.updatedAt),
  };
}

export class PublicTrackingNotFoundError extends Error {
  constructor() {
    super("No encontramos este pedido.");
    this.name = "PublicTrackingNotFoundError";
  }
}

/**
 * C-30.1 — Datos públicos del pedido por token. No manda la sesión: la página la abre
 * el comprador desde WhatsApp. Token inválido o vencido responden igual (404).
 */
export async function getPublicOrderTracking(token: string): Promise<PublicOrderTracking> {
  assertWhatsAppContractAvailable("publicTracking");
  try {
    const { data } = await axios.get<PublicTrackingDto>(
      `${API.integrations}/p/${encodeURIComponent(token)}`,
      { withCredentials: false },
    );
    return toPublicOrderTracking(data);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) throw new PublicTrackingNotFoundError();
    throw new Error("No pudimos cargar tu pedido. Intenta de nuevo en unos minutos.");
  }
}
