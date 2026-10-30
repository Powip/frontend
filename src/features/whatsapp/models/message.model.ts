import type {
  WhatsAppEvidenceType,
  WhatsAppMediaType,
  WhatsAppMessageDirection,
  WhatsAppMessageKind,
  WhatsAppMessageStatus,
} from "../enums/whatsapp.enums";

export interface WhatsAppMessageAuthor {
  id: string;
  name: string;
}

export interface WhatsAppMessageDocument {
  fileName: string;
  sizeBytes: number | null;
  url: string | null;
}

export interface WhatsAppMessageMedia {
  type: WhatsAppMediaType;
  url: string | null;
  caption: string | null;
}

export interface WhatsAppMessageEvidence {
  type: WhatsAppEvidenceType | null;
  imageUrl: string | null;
  courier: string | null;
  takenAt: Date | null;
}

export interface WhatsAppMessageTimeline {
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
  clickedAt: Date | null;
}

export interface WhatsAppMessage {
  id: string;
  direction: WhatsAppMessageDirection;
  kind: WhatsAppMessageKind;
  status: WhatsAppMessageStatus | null;
  body: string;
  templateName: string | null;
  buttonText: string | null;
  document: WhatsAppMessageDocument | null;
  media: WhatsAppMessageMedia | null;
  evidence: WhatsAppMessageEvidence | null;
  author: WhatsAppMessageAuthor | null;
  failureReason: string | null;
  createdAt: Date;
  timeline: WhatsAppMessageTimeline;
}
