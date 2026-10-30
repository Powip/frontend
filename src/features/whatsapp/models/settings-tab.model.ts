import type {
  WhatsAppAlertRecipients,
  WhatsAppAlertType,
  WhatsAppAuditEntity,
  WhatsAppForeignInboundPolicy,
  WhatsAppOptOutOrigin,
  WhatsAppPermissionCode,
  WhatsAppPermissionRole,
} from "../enums/whatsapp.enums";
import type { WhatsAppMessageAuthor } from "./message.model";

export interface WhatsAppOptOut {
  id: string;
  customerName: string | null;
  phone: string;
  storeId: string | null;
  storeName: string | null;
  origin: WhatsAppOptOutOrigin | null;
  createdAt: Date;
  createdBy: WhatsAppMessageAuthor | null;
}

export interface WhatsAppOptOutPage {
  items: WhatsAppOptOut[];
  page: number;
  pageSize: number;
  total: number | null;
  hasMore: boolean;
}

export interface WhatsAppAlertRule {
  type: WhatsAppAlertType;
  enabled: boolean;
  threshold: number | null;
}

export interface WhatsAppAlertSettings {
  rules: WhatsAppAlertRule[];
  recipients: WhatsAppAlertRecipients;
  pauseCampaignsOnRed: boolean;
  version: number;
}

export interface WhatsAppRecentAlert {
  id: string;
  type: WhatsAppAlertType;
  message: string;
  createdAt: Date;
  relatedTab: string | null;
}

export interface WhatsAppProtectionSettings {
  optOutByKeyword: boolean;
  foreignInbound: WhatsAppForeignInboundPolicy;
  allowForeignOutbound: boolean;
  version: number;
}

export type WhatsAppAuditValue =
  | string
  | number
  | boolean
  | null
  | WhatsAppAuditValue[]
  | {
      [key: string]: WhatsAppAuditValue;
    };

export interface WhatsAppAuditEntry {
  id: string;
  createdAt: Date;
  user: WhatsAppMessageAuthor | null;
  entity: WhatsAppAuditEntity;
  entityId: string | null;
  action: string;
  summary: string | null;
  before: Record<string, WhatsAppAuditValue> | null;
  after: Record<string, WhatsAppAuditValue> | null;
}

export interface WhatsAppAuditPage {
  items: WhatsAppAuditEntry[];
  page: number;
  pageSize: number;
  total: number | null;
  hasMore: boolean;
  users: WhatsAppMessageAuthor[] | null;
}

export interface WhatsAppAuditFilters {
  entity: WhatsAppAuditEntity | null;
  userId: string | null;
}

export type WhatsAppPermissionMatrix = Record<
  WhatsAppPermissionCode,
  Record<WhatsAppPermissionRole, boolean>
>;

export interface WhatsAppPermissionSettings {
  matrix: WhatsAppPermissionMatrix;
  version: number;
}

export type WhatsAppEffectivePermissions = Record<WhatsAppPermissionCode, boolean | null>;
