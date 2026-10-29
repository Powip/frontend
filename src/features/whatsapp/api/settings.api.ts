import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import { assertWhatsAppContractAvailable } from "../constants/whatsapp-contracts";
import type {
  WhatsAppForeignInboundPolicy,
  WhatsAppOutOfHoursPolicy,
  WhatsAppWeekday,
} from "../enums/whatsapp.enums";

/** Respuesta completa de C-18 (GET/PUT /wa/settings). */
export interface WhatsAppSettingsDto {
  schedule: {
    days: WhatsAppWeekday[];
    from: string;
    to: string;
    outOfHours: WhatsAppOutOfHoursPolicy;
    timezone: "America/Lima";
  };
  dedupe: boolean;
  maxPerOrderPerDay: number;
  missingData: { notifyAgent: boolean; sendWhenFixed: boolean };
  autoReply: { enabled: boolean; inHoursText: string; outOfHoursText: string } | null;
  optOutByKeyword: boolean;
  foreignNumbers: { inbound: WhatsAppForeignInboundPolicy; allowOutbound: boolean };
  version: number;
}

export type WhatsAppSettingsUpdateBody = Omit<WhatsAppSettingsDto, "version">;

const SETTINGS_URL = `${API.integrations}/wa/settings`;

// C-18 · GET /wa/settings?storeId=
export async function getWhatsAppSettings(storeId: string): Promise<WhatsAppSettingsDto> {
  assertWhatsAppContractAvailable("settings");
  const { data } = await axiosAuth.get<WhatsAppSettingsDto>(SETTINGS_URL, {
    params: { storeId },
  });
  return data;
}

// C-18 · PUT /wa/settings?storeId= con If-Match
export async function updateWhatsAppSettings(
  storeId: string,
  version: number,
  body: WhatsAppSettingsUpdateBody,
): Promise<WhatsAppSettingsDto> {
  assertWhatsAppContractAvailable("settings");
  const { data } = await axiosAuth.put<WhatsAppSettingsDto>(SETTINGS_URL, body, {
    params: { storeId },
    headers: { "If-Match": String(version) },
  });
  return data;
}