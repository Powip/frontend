import type { UnopenedInvitation } from "../models/unopened-invitation";

export const UNOPENED_INVITATIONS_MOCK: UnopenedInvitation[] = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    displayName: "Test-only invitation",
    maskedEmail: "t***@example.test",
    country: "PE",
    profile: "AGENCY",
    state: "QUEUED",
    createdAt: "2026-10-12T00:00:00Z",
    expiresAt: "2026-11-11T00:00:00Z",
    sentAt: null,
    acceptancePending: true,
    transportAvailability: "DISABLED",
  },
];
