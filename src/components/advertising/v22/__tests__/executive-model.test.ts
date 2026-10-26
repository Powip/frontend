import { financial, emptySales } from "../model";
import type { AdsExecutiveGroup, AdsSummary } from "@/services/advertisingV22Service";
import {
  executiveEfficiency,
  executiveSpend,
  executiveTotal,
  comparableAccounts,
} from "../executive-model";
const row = (extra: Partial<AdsExecutiveGroup> = {}): AdsExecutiveGroup => ({
  orders: 10,
  confirmed: 8,
  delivered: 4,
  cancelled: 1,
  units: 20,
  deliveredUnits: 8,
  orderRevenue: "1000",
  deliveredRevenue: "480",
  attributedOrders: 6,
  attributedConfirmed: 5,
  attributedDelivered: 3,
  attributedOrderRevenue: "600",
  attributedDeliveredRevenue: "360",
  unattributedOrders: 4,
  confirmationRate: 0.8,
  deliveryRate: 0.5,
  deliveredTicketPerOrder: "120",
  deliveredTicketPerUnit: "60",
  ...extra,
});
it("keeps delivered tickets, attribution ratios and confirmation denominators distinct", () => {
  const total = executiveTotal([
    row(),
    row({ orders: 2, confirmed: 2, delivered: 2, deliveredUnits: 2, deliveredRevenue: "120" }),
  ]);
  expect(total.confirmationRate).toBeCloseTo(10 / 12);
  expect(total.deliveryRate).toBeCloseTo(6 / 10);
  expect(total.deliveredTicketPerOrder).toBe(100);
  expect(total.deliveredTicketPerUnit).toBe(60);
  expect(executiveEfficiency(row(), 180)).toEqual({
    costOrder: 30,
    costConfirmed: 36,
    costDelivered: 60,
    roasOrders: 600 / 180,
    roasDelivered: 2,
  });
});
it("preserves unknown revenue, missing denominators and unallocated Shopify COD spend", () => {
  expect(executiveTotal([row(), row({ deliveredRevenue: null })]).deliveredRevenue).toBeNull();
  expect(executiveEfficiency(row(), 180, false)).toEqual({
    costOrder: null,
    costConfirmed: null,
    costDelivered: null,
    roasOrders: null,
    roasDelivered: null,
  });
  expect(
    executiveEfficiency(
      row({ attributedOrders: 0, attributedConfirmed: 0, attributedDelivered: 0 }),
      0,
    ),
  ).toEqual({
    costOrder: null,
    costConfirmed: null,
    costDelivered: null,
    roasOrders: null,
    roasDelivered: null,
  });
});
it("uses only PEN attributed entities for comparable acquisition costs", () => {
  const result = executiveEfficiency(
    row({
      comparableAttributedOrders: 3,
      comparableAttributedConfirmed: 2,
      comparableAttributedDelivered: 1,
    }),
    180,
  );
  expect(result.costOrder).toBe(60);
  expect(result.costConfirmed).toBe(90);
  expect(result.costDelivered).toBe(180);
});
it("requires every selected account-day and keeps observed partial spend pending", () => {
  const summary = {
    from: "2026-10-01",
    to: "2026-10-02",
    days: [
      {
        date: "2026-10-01",
        accountId: "a",
        storeId: "s",
        channel: "web",
        currency: "PEN",
        spend: "100",
      },
      {
        date: "2026-10-02",
        accountId: "a",
        storeId: "s",
        channel: "web",
        currency: "PEN",
        spend: "80",
      },
    ],
    quality: {
      spendAvailable: false,
      accountDays: [{ accountId: "a", currency: "PEN", date: "2026-10-01", spendAvailable: true }],
    },
  } as AdsSummary;
  expect(executiveSpend(summary, "all", "a")).toBeNull();
  expect(executiveSpend(summary, "all", "a", "2026-10-01")).toBe(100);
  expect(executiveSpend(summary, "all")).toBeNull();
  summary.quality.accountDays!.push({ ...summary.quality.accountDays![0], date: "2026-10-02" });
  expect(executiveSpend(summary, "all", "a")).toBe(180);
});
it("requires matching currency and timezone before comparing spend to Lima cohorts", () => {
  const summary = {
    accounts: [
      { id: "a", currency: "PEN", timeZone: "America/Lima" },
      { id: "b", currency: "PEN", timeZone: "America/Bogota" },
    ],
  } as AdsSummary;
  expect(comparableAccounts(summary)).toBe(false);
  expect(comparableAccounts(summary, "a")).toBe(true);
  expect(comparableAccounts(summary, "missing")).toBe(false);
});

it("keeps recognized gain per billed unit separate from delivered ticket denominators", () => {
 const value = financial(0, { ...emptySales(), orders:4, delivered:2, deliveredUnits:2, billedUnits:4, eligibleBilledUnits:4, billedRevenue:"480", deliveredRevenue:"240", eligibleRevenue:"480", eligibleProductCost:"160", eligibleShippingCost:"40" }, null);
 expect(value.ticket).toBe(120);
 expect(value.revenue).toBe(240);
 expect(value.gain).toBe(280);
 expect(value.gainUnit).toBe(70);
});
