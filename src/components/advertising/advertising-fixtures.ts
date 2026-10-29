import type { AdvertisingAccount, AdvertisingDay, AdvertisingSnapshot } from "./advertising-model";

export type AdvertisingFixtureScenario =
  | "complete"
  | "partial"
  | "disconnected"
  | "reconnect"
  | "currencies"
  | "zero"
  | "no-orders";

const FIXTURE_TODAY = "2026-10-08";
const FIXTURE_UPDATED_AT = "2026-10-08T14:30:00-05:00";

const FIXTURE_ACCOUNTS: AdvertisingAccount[] = [
  {
    id: "m1",
    provider: "meta",
    name: "Casa Andina · Lima",
    externalId: "123456001",
    currency: "PEN",
    timeZone: "America/Lima",
    enabled: true,
    updatedAt: FIXTURE_UPDATED_AT,
  },
  {
    id: "t1",
    provider: "tiktok",
    name: "Casa Andina · TikTok",
    externalId: "987654001",
    currency: "PEN",
    timeZone: "America/Lima",
    enabled: true,
    updatedAt: FIXTURE_UPDATED_AT,
  },
  {
    id: "m3",
    provider: "meta",
    name: "Casa Andina · Internacional",
    externalId: "123456003",
    currency: "USD",
    timeZone: "America/Lima",
    enabled: true,
    updatedAt: FIXTURE_UPDATED_AT,
  },
];

const FIXTURE_AMOUNTS: Record<string, number[]> = {
  m1: [3000, 4000, 5000, 4000, 6000, 4000, 6000, 10000],
  t1: [1000, 1000, 1000, 1500, 1500, 2000, 2000, 2000],
  m3: [200, 300, 400, 400, 500, 400, 600, 700],
};

/** Sample-only data for the approved prototype, separate from live adapters. */
export function createAdvertisingFixture(scenario: string): AdvertisingSnapshot {
  const disconnected = scenario === "disconnected";
  const accountIds = disconnected
    ? []
    : scenario === "currencies"
      ? ["m1", "t1", "m3"]
      : scenario === "no-orders"
        ? ["m1"]
        : ["m1", "t1"];

  const accounts = FIXTURE_ACCOUNTS.filter((account) => accountIds.includes(account.id)).map(
    (account) => ({
      ...account,
      updatedAt:
        scenario === "partial" && account.id === "t1"
          ? "2026-10-06T14:30:00-05:00"
          : account.updatedAt,
    }),
  );

  const days: AdvertisingDay[] = accounts.flatMap((account) =>
    FIXTURE_AMOUNTS[account.id].map((amountMinor, index) => ({
      accountId: account.id,
      date: `2026-10-${String(index + 1).padStart(2, "0")}`,
      amountMinor:
        scenario === "partial" && account.id === "t1" && index >= 6
          ? null
          : scenario === "zero"
            ? 0
            : amountMinor,
    })),
  );

  return {
    accounts,
    days,
    manualRecords: disconnected
      ? []
      : [
          {
            id: "manual-1",
            date: FIXTURE_TODAY,
            amountMinor: 10000,
            currency: "PEN",
            status: "pending",
            importedAccountId: "m1",
          },
        ],
    providers: {
      meta: {
        available: true,
        status: disconnected
          ? "disconnected"
          : scenario === "reconnect"
            ? "needs-auth"
            : "connected",
      },
      tiktok: {
        available: true,
        status: disconnected || scenario === "no-orders" ? "disconnected" : "connected",
      },
    },
    today: FIXTURE_TODAY,
  };
}
