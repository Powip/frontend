import type {
  AdminCommissionPolicyDraftCommand,
  AdminCommissionPolicyVersion,
} from "../models/admin-commission-policy";
import type { AdminResource, AdminResourceMetadataCommand } from "../models/admin-resource";

export const WRITE_USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const WRITE_USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const POLICY_COMMAND: AdminCommissionPolicyDraftCommand = {
  code: "TEST_DRAFT",
  currency: "PEN",
  firstPaymentRate: "0.1234567890",
  recurringPaymentRate: "0.01",
  recurringPaymentCount: null,
  effectiveFrom: null,
  reason: "Test-only proposal",
};
export function policyDraft(
  overrides: Partial<AdminCommissionPolicyVersion> = {},
): AdminCommissionPolicyVersion {
  const { reason: _reason, ...metadata } = POLICY_COMMAND;
  return {
    ...metadata,
    id: "11111111-1111-4111-8111-111111111111",
    state: "DRAFT",
    createdAt: "2026-10-10T10:00:00Z",
    ...overrides,
  };
}
export const RESOURCE_COMMAND: AdminResourceMetadataCommand = {
  country: "PE",
  kind: "PDF",
  category: "Test category",
  title: "Test-only resource",
  description: null,
  publicUrl: null,
  sortOrder: 4,
  reason: "Test-only metadata creation",
};
export function adminResource(overrides: Partial<AdminResource> = {}): AdminResource {
  const { reason: _reason, ...metadata } = RESOURCE_COMMAND;
  return {
    ...metadata,
    id: "22222222-2222-4222-8222-222222222222",
    state: "DRAFT",
    version: 0,
    createdAt: "2026-10-10T10:00:00Z",
    updatedAt: "2026-10-10T10:00:00Z",
    archivedAt: null,
    ...overrides,
  };
}
