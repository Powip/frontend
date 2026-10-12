import type { AdvertisingBusinessMetrics } from "@/services/advertisingBusinessMetricsService";
import type {
  AdvertisingAssignmentsV11,
  AdvertisingSummaryV11,
} from "@/services/advertisingV11Service";

export function summaryV11(): AdvertisingSummaryV11 {
  return {
    from: "2026-10-01",
    to: "2026-10-03",
    storeId: "all",
    seriesBy: "store",
    currencies: [
      {
        currency: "PEN",
        spend: "100.10",
        coverage: "complete",
        costPerResult: [
          {
            type: "messages",
            label: "Conversaciones",
            count: "10",
            costPerResult: "10.01",
            status: "complete",
          },
        ],
        ctr: "1.25",
        frequency: "3.20",
        frequencyApproximate: true,
        frequencyHigh: true,
        unassignedSpend: "0",
        costPerDelivered: null,
        timeZones: ["America/Lima"],
        spendSource: "effective",
        metricsSource: "meta",
        completeDates: ["2026-10-01", "2026-10-02", "2026-10-03"],
        periodMetricsStatus: "available",
      },
    ],
    series: [
      {
        date: "2026-10-01",
        segment: { id: "store-a", name: "Centro", type: "store", color: "#123ABC" },
        currency: "PEN",
        spend: "100.10",
      },
    ],
    byAccount: [],
    warnings: [],
    channelDaily: [],
  };
}
export function businessV11(): AdvertisingBusinessMetrics {
  return {
    source: "powip-business-metrics",
    definition: "delivered-order-grand-total-v1",
    from: "2026-10-01",
    to: "2026-10-03",
    basis: "delivered",
    timeZone: "America/Lima",
    storeId: "all",
    channelId: "all",
    deliveredCount: 10,
    totalOrders: 12,
    attributedDeliveredCount: 6,
    unknownChannelCount: 0,
    legacyStoreCount: 0,
    quality: { missingDeliveredDateCount: 0, missingPaidDateCount: 0, unknownCurrencyCount: 0 },
    currencies: [
      {
        currency: "PEN",
        deliveredCount: 10,
        totalOrders: 12,
        deliveredRevenue: "1001.00",
        attributedDeliveredCount: 6,
        attributedRevenue: "600.00",
        unknownChannelCount: 0,
        legacyStoreCount: 0,
      },
    ],
    coverage: { complete: true, reasons: [] },
  };
}
export function assignmentsV11(): AdvertisingAssignmentsV11 {
  return {
    from: "2026-09-13",
    to: "2026-10-12",
    today: "2026-10-12",
    capabilities: { canConfigure: true },
    stores: [
      { id: "store-a", name: "Centro", color: null },
      { id: "store-b", name: "Norte", color: null },
    ],
    channels: [],
    accounts: [
      {
        id: "account-a",
        externalId: "123",
        name: "Cuenta Meta",
        currency: "PEN",
        timeZone: "America/Lima",
        mode: "multi",
        storeId: null,
        version: 2,
        spend: "100.10",
        status: "unassigned",
        destinations: [],
        adsets: [
          {
            id: "456",
            name: "Conjunto Centro",
            campaignId: "999",
            campaignName: "Ventas",
            storeId: null,
            version: 3,
            spend: "100.10",
            destinations: ["@centro"],
            suggestion: { storeId: "store-a", reason: "destination-match" },
            unresolvedChannelCount: 0,
          },
        ],
      },
    ],
    pending: {
      adsetCount: 1,
      byCurrency: [{ currency: "PEN", spend: "100.10" }],
      suggestionCount: 1,
    },
  };
}
