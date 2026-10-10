import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import axiosAuth from "@/lib/axiosAuth";
import partnersMutationsClient from "../../api/partners-mutations.client";
import { listAdminPartners } from "../../mocks/admin-partners.store";
import { listAdminLiquidations } from "../../mocks/admin-liquidations.store";
import { listPendingPaymentConfirmations } from "../../mocks/pending-payment-confirmations.store";
import { getPayoutSettingsFromStore } from "../../mocks/payout-settings.store";
import { getAdminCommissionSettingsFromStore } from "../../mocks/admin-commission-settings.store";
import { listReviewQueue } from "../../mocks/review-queue.store";
import { PartnersFeatureUnavailableError } from "../../utils/unavailable-partners-feature";
import { getPendingPaymentConfirmations } from "../get-pending-payment-confirmations";
import { getAdminPartnerReferrals } from "../get-admin-partner-referrals";
import { getUnopenedInvitations } from "../get-unopened-invitations";
import { getPartnerResources } from "../get-partner-resources";
import { confirmPendingPayment } from "../confirm-pending-payment";
import { getAdminLiquidations } from "../get-admin-liquidations";
import { getAdminCommissionSettings } from "../get-admin-commission-settings";
import { getCommissionLines } from "../get-commission-lines";
import { inviteAdminPartner } from "../invite-admin-partner";
import { getPayoutSettings } from "../get-payout-settings";
import { getAdminPartner } from "../get-admin-partner";
import { getAdminPartners } from "../get-admin-partners";
import { getReviewQueue } from "../get-review-queue";
import { getAdminClawbacks } from "../get-admin-clawbacks";
import { getPartnerLink } from "../get-partner-link";
import { getPayoutHistory } from "../get-payout-history";
import { getAdminThresholdQueue } from "../get-admin-threshold-queue";
import { payAdminLiquidation } from "../pay-admin-liquidation";
import { payAllAdminLiquidations } from "../pay-all-admin-liquidations";
import { updatePayoutSettings } from "../update-payout-settings";
import { getAdminDashboardSummary } from "../get-admin-dashboard-summary";
import { updateAdminCommissionSettings } from "../update-admin-commission-settings";
import { resolveReviewQueueItem } from "../resolve-review-queue-item";
import { getCommissionOptions } from "../get-commission-options";
import { getProgramCases } from "../get-program-cases";
import { getPartnerSummary } from "../get-partner-summary";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock("../../api/partners-mutations.client", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const operations: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
  ["get-pending-payment-confirmations", () => getPendingPaymentConfirmations()],
  ["get-admin-partner-referrals", () => getAdminPartnerReferrals("fixture-id")],
  ["get-unopened-invitations", () => getUnopenedInvitations()],
  ["get-partner-resources", () => getPartnerResources()],
  ["confirm-pending-payment", () => confirmPendingPayment("fixture-id")],
  ["get-admin-liquidations", () => getAdminLiquidations()],
  ["get-admin-commission-settings", () => getAdminCommissionSettings()],
  ["get-commission-lines", () => getCommissionLines()],
  [
    "invite-admin-partner",
    () =>
      inviteAdminPartner({
        name: "Fixture partner",
        email: "fixture@example.test",
        profile: "dev",
        suggestedOptionCode: "A",
      }),
  ],
  ["get-payout-settings", () => getPayoutSettings()],
  ["get-admin-partner", () => getAdminPartner("fixture-id")],
  ["get-admin-partners", () => getAdminPartners()],
  ["get-review-queue", () => getReviewQueue()],
  ["get-admin-clawbacks", () => getAdminClawbacks()],
  ["get-partner-link", () => getPartnerLink()],
  ["get-payout-history", () => getPayoutHistory()],
  ["get-admin-threshold-queue", () => getAdminThresholdQueue()],
  ["pay-admin-liquidation", () => payAdminLiquidation("fixture-id")],
  ["pay-all-admin-liquidations", () => payAllAdminLiquidations()],
  [
    "update-payout-settings",
    () => updatePayoutSettings({ method: "yape", accountNumber: "fixture-account" }),
  ],
  ["get-admin-dashboard-summary", () => getAdminDashboardSummary()],
  ["update-admin-commission-settings", () => updateAdminCommissionSettings({})],
  ["resolve-review-queue-item", () => resolveReviewQueueItem("fixture-item", "aprobado")],
  ["get-commission-options", () => getCommissionOptions()],
  ["get-program-cases", () => getProgramCases()],
  ["get-partner-summary", () => getPartnerSummary()],
];

function storesSnapshot() {
  return JSON.stringify({
    partners: listAdminPartners(),
    liquidations: listAdminLiquidations(),
    payments: listPendingPaymentConfirmations(),
    payoutSettings: getPayoutSettingsFromStore(),
    rules: getAdminCommissionSettingsFromStore(),
    reviews: listReviewQueue(),
  });
}

describe("Partners operations pending implementation", () => {
  it.each(operations)(
    "%s fails closed without HTTP or local store changes",
    async (_name, invoke) => {
      const before = storesSnapshot();
      await expect(invoke()).rejects.toBeInstanceOf(PartnersFeatureUnavailableError);
      await expect(invoke()).rejects.toMatchObject({ code: "PERMANENT_FEATURE_UNAVAILABLE" });
      expect(storesSnapshot()).toBe(before);
      for (const client of [axiosAuth, partnersMutationsClient]) {
        for (const method of ["get", "post", "patch", "put", "delete"] as const) {
          expect(client[method]).not.toHaveBeenCalled();
        }
      }
    },
  );

  it("no production Partners service imports a runtime fixture or mutable mock store", () => {
    const directory = join(process.cwd(), "src/features/partners/services");
    for (const file of readdirSync(directory).filter((name) => name.endsWith(".ts"))) {
      const source = readFileSync(join(directory, file), "utf8");
      expect(source).not.toContain("../mocks/");
    }
  });
});
