import type { WhatsAppSettingsDto } from "../api/settings.api";
import type { WhatsAppSendingSettings } from "../models/sending-settings.model";

export function toWhatsAppSendingSettings(dto: WhatsAppSettingsDto): WhatsAppSendingSettings {
  return {
    schedule: {
      days: [...dto.schedule.days],
      from: dto.schedule.from,
      to: dto.schedule.to,
      outOfHours: dto.schedule.outOfHours,
      timezone: dto.schedule.timezone,
    },
    dedupe: dto.dedupe,
    maxPerOrderPerDay: dto.maxPerOrderPerDay,
    missingData: { ...dto.missingData },
    version: dto.version,
  };
}