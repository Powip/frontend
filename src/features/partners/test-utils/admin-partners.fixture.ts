import type { AdminDashboardSummary } from "../models/admin-dashboard-summary";
import type { AdminPartner, AdminPartnerPage } from "../models/admin-partner";
import type { AdminPartnerActivity } from "../models/admin-partner-activity";
import type { AdminPartnerReferral } from "../models/admin-partner-referral";

export const ADMIN_USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const ADMIN_USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const ADMIN_PARTNER_ID = "11111111-1111-4111-8111-111111111111";
export function buildAdminPartner(overrides: Partial<AdminPartner> = {}): AdminPartner {
  return {
    id: ADMIN_PARTNER_ID,
    displayName: "Partner de prueba",
    country: "PE",
    currency: "PEN",
    status: "ACTIVE",
    version: 4,
    applicationReference: "PARTNER-TEST",
    appliedAt: "2026-10-01T10:00:00Z",
    activatedAt: "2026-10-02T10:00:00Z",
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-02T10:00:00Z",
    referralCode: "TEST",
    manualReferralsCount: 3,
    linkAttributionsCount: 2,
    ...overrides,
  };
}
export function buildAdminPage(partner = buildAdminPartner()): AdminPartnerPage {
  return { items: [partner], nextCursor: null, hasMore: false, limit: 20 };
}
export function buildAdminSummary(): AdminDashboardSummary {
  return {
    asOf: "2026-10-10T10:00:00Z",
    counts: {
      partnersTotal: 5,
      partnersActive: 3,
      partnersSuspended: 2,
      applicationsPending: 7,
      applicationsRejected: 1,
      manualReferrals: 11,
      codeReferrals: 4,
      legacyLinkReferrals: 2,
      linkAttributions: 6,
      capturedClaims: 9,
      attachedClaims: 8,
    },
    financial: {
      availability: "NOT_AVAILABLE",
      reason: "FINANCIAL_ENGINE_NOT_IMPLEMENTED",
      referredMrr: null,
      monthlyCommissions: null,
      discountsGiven: null,
      channelCost: null,
      ltvBrought: null,
      channelRoiMultiplier: null,
    },
  };
}
export function buildAdminReferral(
  overrides: Partial<AdminPartnerReferral> = {},
): AdminPartnerReferral {
  return {
    source: "MANUAL",
    id: "22222222-2222-4222-8222-222222222222",
    companyId: null,
    businessName: "Negocio prueba",
    origin: "MANUAL",
    state: "REGISTERED",
    capturedAt: "2026-10-03T10:00:00Z",
    companyCreatedAt: null,
    attributedAt: null,
    ...overrides,
  };
}
export function buildAdminActivity(): AdminPartnerActivity {
  return {
    action: "PARTNER_APPROVED",
    entityType: "PARTNER",
    entityId: ADMIN_PARTNER_ID,
    occurredAt: "2026-10-02T10:00:00Z",
  };
}
