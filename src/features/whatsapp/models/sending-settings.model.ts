import type { WhatsAppOutOfHoursPolicy, WhatsAppWeekday } from "../enums/whatsapp.enums";

export interface WhatsAppSendingSchedule {
  days: WhatsAppWeekday[];
  from: string;
  to: string;
  outOfHours: WhatsAppOutOfHoursPolicy;
  timezone: "America/Lima";
}

export interface WhatsAppMissingDataSettings {
  notifyAgent: boolean;
  sendWhenFixed: boolean;
}

export interface WhatsAppSendingSettings {
  schedule: WhatsAppSendingSchedule;
  dedupe: boolean;
  maxPerOrderPerDay: number;
  missingData: WhatsAppMissingDataSettings;
  version: number;
}
