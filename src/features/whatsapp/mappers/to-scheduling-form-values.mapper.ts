import { WHATSAPP_SENDING_SETTINGS_SUGGESTED } from "../constants/whatsapp-scheduling-catalog";
import {
  WHATSAPP_CAMPAIGN_DESTINATIONS,
  WHATSAPP_CAMPAIGN_SCHEDULE_TYPES,
  WHATSAPP_NOTIFICATION_EVENTS,
} from "../enums/whatsapp.enums";
import type { WhatsAppCampaign } from "../models/campaign.model";
import type { WhatsAppRule } from "../models/rule.model";
import type { WhatsAppSendingSettings } from "../models/sending-settings.model";
import { CAMPAIGN_ALL_COURIERS, type CampaignValues } from "../schemas/campaign.schema";
import type { RuleConfigValues } from "../schemas/rule-config.schema";
import type { SendingScheduleValues } from "../schemas/sending-schedule.schema";

export function toRuleConfigValues(rule: WhatsAppRule): RuleConfigValues {
  return {
    templateId: rule.templateId ?? "",
    whenMode: rule.when.mode,
    delayMinutes: rule.when.minutes === null ? "" : String(rule.when.minutes),
    fixedTime: rule.when.time ?? "",
    hoursBefore: rule.when.hours === null ? "" : String(rule.when.hours),
    reminderEnabled: rule.reminder?.enabled ?? false,
    reminderHours: rule.reminder ? String(rule.reminder.hours) : "",
    dateMode: rule.scope.dateMode,
    from: rule.scope.from ?? "",
    to: rule.scope.to ?? "",
    maxOrderAgeDays: String(rule.scope.maxOrderAgeDays),
    storeIds: [...rule.scope.storeIds],
    salesChannels: [...rule.scope.salesChannels],
    shippingTypes: [...rule.scope.shippingTypes],
    courierIds: [...rule.scope.courierIds],
  };
}

export function toSendingScheduleValues(
  settings: WhatsAppSendingSettings | null,
): SendingScheduleValues {
  if (!settings) {
    return {
      days: [...WHATSAPP_SENDING_SETTINGS_SUGGESTED.days],
      from: WHATSAPP_SENDING_SETTINGS_SUGGESTED.from,
      to: WHATSAPP_SENDING_SETTINGS_SUGGESTED.to,
      outOfHours: WHATSAPP_SENDING_SETTINGS_SUGGESTED.outOfHours,
      dedupe: WHATSAPP_SENDING_SETTINGS_SUGGESTED.dedupe,
      maxPerOrderPerDay: String(WHATSAPP_SENDING_SETTINGS_SUGGESTED.maxPerOrderPerDay),
    };
  }
  return {
    days: [...settings.schedule.days],
    from: settings.schedule.from,
    to: settings.schedule.to,
    outOfHours: settings.schedule.outOfHours,
    dedupe: settings.dedupe,
    maxPerOrderPerDay: String(settings.maxPerOrderPerDay),
  };
}

export function toCampaignValues(
  campaign: WhatsAppCampaign | null,
  defaults: { storeId: string },
): CampaignValues {
  if (!campaign) {
    return {
      name: "",
      templateId: "",
      stage: WHATSAPP_NOTIFICATION_EVENTS.IN_TRANSIT,
      courierId: CAMPAIGN_ALL_COURIERS,
      storeId: defaults.storeId,
      destination: WHATSAPP_CAMPAIGN_DESTINATIONS.ALL,
      scheduleType: WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.ONCE,
      date: "",
      time: "",
      recurrence: "",
    };
  }
  return {
    name: campaign.name,
    templateId: campaign.templateId,
    stage: campaign.segment.stage,
    courierId: campaign.segment.courierId ?? CAMPAIGN_ALL_COURIERS,
    storeId: campaign.segment.storeId,
    destination: campaign.segment.destination,
    scheduleType: campaign.schedule.type,
    date: campaign.schedule.date ?? "",
    time: campaign.schedule.time,
    recurrence: campaign.schedule.recurrence ?? "",
  };
}
