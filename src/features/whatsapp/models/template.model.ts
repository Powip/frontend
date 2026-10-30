import type {
  WhatsAppAbVariant,
  WhatsAppTemplateCategory,
  WhatsAppTemplateHeaderType,
  WhatsAppTemplateLanguage,
  WhatsAppTemplateStatus,
  WhatsAppTemplateUsage,
} from "../enums/whatsapp.enums";

export interface WhatsAppTemplateHeader {
  type: WhatsAppTemplateHeaderType;
  text: string | null;
}

export interface WhatsAppTemplateContent {
  header: WhatsAppTemplateHeader;
  body: string;
  footer: string | null;
  buttonText: string | null;
  quickReply: boolean;
}

export interface WhatsAppTemplateVariantResult {
  sends: number;
  readPct: number | null;
  clickPct: number | null;
}

export interface WhatsAppTemplateAbResults {
  a: WhatsAppTemplateVariantResult;
  b: WhatsAppTemplateVariantResult;
  winner: WhatsAppAbVariant | null;
}

export interface WhatsAppTemplateAbTest {
  enabled: boolean;
  bodyB: string | null;
  minSendsPerVariant: number;
  results: WhatsAppTemplateAbResults | null;
}

export interface WhatsAppTemplateStats {
  sent: number;
  readPct: number | null;
  clickPct: number | null;
}

export interface WhatsAppApprovedTemplateVersion extends WhatsAppTemplateContent {
  approvedAt: Date;
}

export interface WhatsAppTemplate extends WhatsAppTemplateContent {
  id: string;
  storeId: string | null;
  name: string;
  usage: WhatsAppTemplateUsage | null;
  category: WhatsAppTemplateCategory;
  language: WhatsAppTemplateLanguage;
  status: WhatsAppTemplateStatus;
  metaReason: string | null;
  abTest: WhatsAppTemplateAbTest | null;
  approvedVersion: WhatsAppApprovedTemplateVersion | null;
  stats30d: WhatsAppTemplateStats | null;
  updatedAt: Date;
}
