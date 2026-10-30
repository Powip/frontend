import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import { assertWhatsAppContractAvailable } from "../constants/whatsapp-contracts";
import type { CreateTemplatePayload } from "../mappers/to-create-template-payload.mapper";

export interface WhatsAppTemplateComponentDto {
  type: string; // "HEADER" | "BODY" | "FOOTER" | "BUTTONS"
  format?: string; // en HEADER: "TEXT" | "DOCUMENT" | ...
  text?: string;
  buttons?: { type: string; text?: string }[];
}

/** Plantilla tal como la devuelve ms-integrations (GET /whatsapp/templates). */
export interface WhatsAppTemplateDto {
  id: string;
  companyId: string;
  wabaId: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: WhatsAppTemplateComponentDto[];
  metaTemplateId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WhatsAppTemplatesListResponse {
  status: string;
  message: string;
  data: WhatsAppTemplateDto[];
}

// C-12 · Hoy el backend responde { status, message, data: [...] } y no filtra por tienda.
export async function listWhatsAppTemplates(): Promise<WhatsAppTemplateDto[]> {
  assertWhatsAppContractAvailable("templates");
  const { data } = await axiosAuth.get<WhatsAppTemplatesListResponse | WhatsAppTemplateDto[]>(
    `${API.integrations}/whatsapp/templates`,
  );
  return Array.isArray(data) ? data : (data.data ?? []);
}

/** Resumen de POST /whatsapp/templates/sync (trae las plantillas de Meta a POWIP). */
export interface WhatsAppTemplatesSyncResult {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
}

export async function syncWhatsAppTemplates(): Promise<WhatsAppTemplatesSyncResult> {
  assertWhatsAppContractAvailable("templates");
  const { data } = await axiosAuth.post<WhatsAppTemplatesSyncResult>(
    `${API.integrations}/whatsapp/templates/sync`,
  );
  return data;
}

/** C-12 · Crea la plantilla y la envía a revisión de Meta. */
export async function createWhatsAppTemplate(
  payload: CreateTemplatePayload,
): Promise<WhatsAppTemplateDto> {
  assertWhatsAppContractAvailable("templates");
  const { data } = await axiosAuth.post<{ data?: WhatsAppTemplateDto } | WhatsAppTemplateDto>(
    `${API.integrations}/whatsapp/templates`,
    payload,
  );
  return "data" in data && data.data ? data.data : (data as WhatsAppTemplateDto);
}