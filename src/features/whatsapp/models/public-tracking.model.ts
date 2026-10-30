import type { WhatsAppEvidenceType } from "../enums/whatsapp.enums";

export interface PublicTrackingStore {
  name: string;
  logoUrl: string | null;
}

export interface PublicTrackingOrder {
  number: string;
  createdAt: Date | null;
  customerFirstName: string | null;
  items: { name: string; quantity: number }[] | null;
}

export interface PublicTrackingStatus {
  label: string;
  description: string | null;
  tone: "progress" | "delivered" | "incident" | "cancelled";
  incidentReason: string | null;
}

export interface PublicTrackingStep {
  label: string;
  at: Date | null;
  done: boolean;
}

export interface PublicTrackingShipping {
  courierName: string | null;
  trackingCode: string | null;
  deliveryMode: "agency" | "home" | null;
  estimatedDate: string | null;
  district: string | null;
  agency: { name: string; address: string | null; hours: string | null } | null;
}

export interface PublicTrackingEvidence {
  type: WhatsAppEvidenceType;
  imageUrl: string;
  takenAt: Date | null;
}

export interface PublicTrackingInvoice {
  label: string;
  seriesNumber: string | null;
  pdfUrl: string;
}

export interface PublicOrderTracking {
  store: PublicTrackingStore;
  order: PublicTrackingOrder;
  status: PublicTrackingStatus;
  timeline: PublicTrackingStep[] | null;
  shipping: PublicTrackingShipping | null;
  evidence: PublicTrackingEvidence[];
  invoice: PublicTrackingInvoice | null;
  updatedAt: Date | null;
}

export type PublicTrackingState =
  | { kind: "pending-integration" }
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: PublicOrderTracking };
