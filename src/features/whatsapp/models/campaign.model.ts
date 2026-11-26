import type {
  WhatsAppCampaignDestination,
  WhatsAppCampaignRecurrence,
  WhatsAppCampaignScheduleType,
  WhatsAppCampaignStatus,
  WhatsAppNotificationEvent,
} from "../enums/whatsapp.enums";

export interface WhatsAppCampaignSegment {
  stage: WhatsAppNotificationEvent;
  courierId: string | null;
  storeId: string;
  destination: WhatsAppCampaignDestination;
}

export interface WhatsAppCampaignSchedule {
  type: WhatsAppCampaignScheduleType;
  date: string | null;
  recurrence: WhatsAppCampaignRecurrence | null;
  time: string;
}

export interface WhatsAppCampaignResults {
  sent: number;
  delivered: number | null;
  read: number | null;
  clicked: number | null;
  notSent: number | null;
}

export interface WhatsAppCampaign {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  segment: WhatsAppCampaignSegment;
  segmentLabel: string | null;
  schedule: WhatsAppCampaignSchedule;
  status: WhatsAppCampaignStatus;
  pausedReason: "manual" | "quality_red" | null;
  matchingToday: number | null;
  results: WhatsAppCampaignResults | null;
  version: number;
}

export interface WhatsAppSegmentCount {
  matchingToday: number;
  computedAt: Date;
}
