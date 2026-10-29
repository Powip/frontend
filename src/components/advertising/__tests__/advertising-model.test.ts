import type { AdvertisingSnapshotWire } from "@/services/advertisingService";
import { createAdvertisingFixture } from "../advertising-fixtures";
import {
  type AdvertisingFilters,
  EMPTY_ADVERTISING_SNAPSHOT,
  formatAdvertisingDate,
  formatAdvertisingMoney,
  getAdvertisingSummary,
  hasAdvertisingAmount,
  isAdvertisingZero,
  snapshotFromWire,
} from "../advertising-model";

const FILTERS: AdvertisingFilters = {
  from: "2026-10-01",
  to: "2026-10-08",
  provider: "all",
  accountId: "all",
  currency: "all",
};

describe("advertising summary", () => {
  it("keeps currencies separate and excludes manual records from imported totals", () => {
    const result = getAdvertisingSummary(createAdvertisingFixture("currencies"), FILTERS);

    expect(result.totals).toEqual([
      { currency: "PEN", amountMinor: 54000, complete: true, accountCount: 2 },
      { currency: "USD", amountMinor: 3500, complete: true, accountCount: 1 },
    ]);
    expect(result.daily.PEN[7]).toEqual({
      date: "2026-10-08",
      amountMinor: 12000,
      complete: true,
    });
    expect(result.daily.USD[7].amountMinor).toBe(700);
  });

  it("recalculates coverage for the selected provider, account, currency and dates", () => {
    const snapshot = createAdvertisingFixture("partial");
    expect(getAdvertisingSummary(snapshot, FILTERS).totals[0]).toMatchObject({
      amountMinor: 50000,
      complete: false,
    });

    const meta = getAdvertisingSummary(snapshot, { ...FILTERS, provider: "meta" });
    expect(meta.totals[0]).toMatchObject({ amountMinor: 42000, complete: true });
    expect(meta.accounts[0].missingDates).toEqual([]);

    const earlierTikTok = getAdvertisingSummary(snapshot, {
      ...FILTERS,
      accountId: "t1",
      to: "2026-10-06",
    });
    expect(earlierTikTok.totals[0]).toMatchObject({ amountMinor: 8000, complete: true });

    const usd = getAdvertisingSummary(createAdvertisingFixture("currencies"), {
      ...FILTERS,
      currency: "USD",
    });
    expect(usd.accounts.map(({ account }) => account.id)).toEqual(["m3"]);
    expect(usd.totals).toEqual([
      { currency: "USD", amountMinor: 3500, complete: true, accountCount: 1 },
    ]);
  });

  it("distinguishes unavailable days from confirmed zero spend", () => {
    const missing = getAdvertisingSummary(createAdvertisingFixture("partial"), {
      ...FILTERS,
      provider: "tiktok",
      from: "2026-10-07",
    });
    expect(missing.accounts[0]).toMatchObject({
      amountMinor: null,
      complete: false,
      missingDates: ["2026-10-07", "2026-10-08"],
    });
    expect(missing.totals[0].amountMinor).toBeNull();
    expect(
      missing.daily.PEN.every(({ amountMinor, complete }) => amountMinor === null && !complete),
    ).toBe(true);

    const zero = getAdvertisingSummary(createAdvertisingFixture("zero"), FILTERS);
    expect(zero.totals[0]).toMatchObject({ amountMinor: 0, complete: true });
    expect(zero.daily.PEN.every(({ amountMinor, complete }) => amountMinor === 0 && complete)).toBe(
      true,
    );
  });

  it("treats an absent import row as missing rather than zero", () => {
    const snapshot = createAdvertisingFixture("complete");
    snapshot.days = snapshot.days.filter(
      ({ accountId, date }) => accountId !== "m1" || date !== "2026-10-08",
    );
    const result = getAdvertisingSummary(snapshot, { ...FILTERS, accountId: "m1" });
    expect(result.accounts[0]).toMatchObject({
      amountMinor: 32000,
      complete: false,
      missingDates: ["2026-10-08"],
    });
    expect(result.daily.PEN[7].amountMinor).toBeNull();
  });

  it("retains imported history when updates are paused or access needs reconnection", () => {
    const paused = createAdvertisingFixture("complete");
    paused.accounts.forEach((account) => {
      account.enabled = false;
    });
    paused.providers.meta.status = "paused";
    paused.providers.tiktok.status = "paused";
    expect(getAdvertisingSummary(paused, FILTERS).totals[0]).toMatchObject({
      amountMinor: 54000,
      complete: true,
      accountCount: 2,
    });
    expect(
      getAdvertisingSummary(createAdvertisingFixture("reconnect"), FILTERS).totals[0].amountMinor,
    ).toBe(54000);
  });

  it("adds integer minor units without rounding away cents", () => {
    const snapshot = createAdvertisingFixture("complete");
    snapshot.days = [
      { accountId: "m1", date: "2026-10-08", amountMinor: 10050 },
      { accountId: "t1", date: "2026-10-08", amountMinor: 25 },
    ];
    const result = getAdvertisingSummary(snapshot, { ...FILTERS, from: "2026-10-08" });
    expect(result.totals[0].amountMinor).toBe(10075);
    expect(formatAdvertisingMoney(10075, "PEN")).toContain("100.75");
  });

  it("preserves advertising spend on a day without orders", () => {
    const result = getAdvertisingSummary(createAdvertisingFixture("no-orders"), {
      ...FILTERS,
      from: "2026-10-07",
      to: "2026-10-07",
    });
    expect(result.totals[0]).toMatchObject({ amountMinor: 6000, complete: true });
  });

  it("starts empty with no available live provider and rejects invalid date ranges", () => {
    expect(EMPTY_ADVERTISING_SNAPSHOT.accounts).toEqual([]);
    expect(EMPTY_ADVERTISING_SNAPSHOT.providers).toEqual({
      meta: { available: false, status: "disconnected" },
      tiktok: { available: false, status: "disconnected" },
    });
    expect(getAdvertisingSummary(EMPTY_ADVERTISING_SNAPSHOT, FILTERS)).toEqual({
      accounts: [],
      totals: [],
      daily: {},
    });
    expect(
      getAdvertisingSummary(createAdvertisingFixture("complete"), {
        ...FILTERS,
        from: "2026-10-09",
      }).accounts,
    ).toEqual([]);
    expect(
      getAdvertisingSummary(createAdvertisingFixture("complete"), {
        ...FILTERS,
        to: "2026-02-30",
      }).accounts,
    ).toEqual([]);
  });

  it("formats pending values explicitly and calendar dates without a timezone shift", () => {
    expect(formatAdvertisingMoney(null, "PEN")).toBe("Pendiente");
    expect(formatAdvertisingMoney(0, "PEN")).toContain("0.00");
    expect(formatAdvertisingDate("2026-10-08")).toMatch(/^8\s+oct/);
  });
});

function createWireSnapshot(): AdvertisingSnapshotWire {
  return {
    accounts: [
      {
        id: "meta-pen",
        provider: "meta",
        externalId: "101",
        name: "Lima",
        currency: "PEN",
        timeZone: "America/Lima",
        enabled: true,
        connectionId: "meta-connection",
        syncFrom: "2026-10-01",
        lastAttemptAt: "2026-10-09T09:00:00Z",
        lastSuccessfulAt: "2026-10-09T09:00:00Z",
        updatedAt: "2026-10-09T09:00:00Z",
      },
      {
        id: "tiktok-pen",
        provider: "tiktok",
        externalId: "202",
        name: "TikTok Perú",
        currency: "PEN",
        timeZone: "America/Lima",
        enabled: true,
        connectionId: "tiktok-connection",
        syncFrom: "2026-10-01",
        lastAttemptAt: "2026-10-09T09:00:00Z",
        lastSuccessfulAt: "2026-10-09T09:00:00Z",
        updatedAt: "2026-10-09T09:00:00Z",
      },
    ],
    days: [
      {
        accountId: "meta-pen",
        date: "2026-10-08",
        amount: "0.005",
        currency: "PEN",
        provisional: true,
        sourceRevision: "first-report",
        updatedAt: "2026-10-09T09:00:00Z",
      },
      {
        accountId: "tiktok-pen",
        date: "2026-10-08",
        amount: "0.005",
        currency: "PEN",
        provisional: false,
        sourceRevision: "first-report",
        updatedAt: "2026-10-09T09:00:00Z",
      },
    ],
    manualRecords: [
      {
        id: "manual-1",
        source: "pauta-local-v1",
        browserKey: "test-browser",
        sourceId: "legacy-1",
        date: "2026-10-08",
        amount: null,
        currency: "PEN",
        status: "pending",
        importedAccountId: null,
        resolutionVersion: 1,
      },
    ],
    providers: {
      meta: { available: true, status: "connected" },
      tiktok: { available: true, status: "connected" },
    },
    capabilities: { canManage: true, canReconcile: true },
    today: "2026-10-09",
  };
}

const ONE_DAY_FILTERS = { ...FILTERS, from: "2026-10-08" };

describe("advertising wire precision and coverage", () => {
  it("sums exact provider decimals before rounding account and currency totals", () => {
    const snapshot = snapshotFromWire(createWireSnapshot());
    const result = getAdvertisingSummary(snapshot, ONE_DAY_FILTERS);

    expect(snapshot.days.map((day) => day.amountDecimal)).toEqual(["0.005", "0.005"]);
    expect(result.accounts.map((account) => account.amountMinor)).toEqual([1, 1]);
    expect(result.totals[0]).toMatchObject({
      amountDecimal: "0.010",
      amountMinor: 1,
      complete: true,
    });
    expect(result.daily.PEN[0]).toMatchObject({
      amountDecimal: "0.010",
      amountMinor: 1,
      complete: true,
      provisional: true,
    });
    expect(
      formatAdvertisingMoney(result.totals[0].amountMinor, "PEN", result.totals[0].amountDecimal),
    ).toContain("0.01");
  });

  it("keeps unavailable manual and imported wire amounts pending without adding zero", () => {
    const wire = createWireSnapshot();
    wire.days[0].amount = null;
    wire.days[1].amount = "0.00";
    const snapshot = snapshotFromWire(wire);
    const result = getAdvertisingSummary(snapshot, ONE_DAY_FILTERS);

    expect(snapshot.manualRecords[0]).toMatchObject({
      amountMinor: null,
      amountDecimal: null,
      status: "pending",
    });
    expect(formatAdvertisingMoney(null, "PEN", null)).toBe("Pendiente");
    expect(result.accounts[0]).toMatchObject({
      amountMinor: null,
      amountDecimal: null,
      complete: false,
      missingDates: ["2026-10-08"],
    });
    expect(result.accounts[1]).toMatchObject({
      amountMinor: 0,
      amountDecimal: "0.00",
      complete: true,
    });
    expect(result.totals[0]).toMatchObject({
      amountMinor: 0,
      amountDecimal: "0.00",
      complete: false,
    });
    expect(result.daily.PEN[0].complete).toBe(false);
  });

  it("recomputes exact coverage after filtering out a missing account", () => {
    const wire = createWireSnapshot();
    wire.days[1].amount = null;
    const snapshot = snapshotFromWire(wire);
    expect(getAdvertisingSummary(snapshot, ONE_DAY_FILTERS).totals[0].complete).toBe(false);
    const selected = getAdvertisingSummary(snapshot, { ...ONE_DAY_FILTERS, provider: "meta" });
    expect(selected.totals[0]).toMatchObject({
      amountDecimal: "0.005",
      amountMinor: 1,
      complete: true,
      accountCount: 1,
    });
    expect(selected.accounts[0].missingDates).toEqual([]);
    expect(selected.daily.PEN[0].complete).toBe(true);
  });

  it("keeps known large amounts complete and formats them despite numeric overflow", () => {
    const wire = createWireSnapshot();
    wire.days[0].amount = "90071992547409931234567890.125";
    const result = getAdvertisingSummary(snapshotFromWire(wire), ONE_DAY_FILTERS);

    expect(result.accounts[0]).toMatchObject({
      amountMinor: null,
      amountDecimal: "90071992547409931234567890.125",
      complete: true,
      missingDates: [],
    });
    expect(result.totals[0]).toMatchObject({
      amountMinor: null,
      amountDecimal: "90071992547409931234567890.130",
      complete: true,
    });
    expect(
      formatAdvertisingMoney(null, "PEN", result.totals[0].amountDecimal).replace(/[^\d.]/g, ""),
    ).toBe("90071992547409931234567890.13");
  });

  it("keeps JPY and KWD totals separate and preserves each provider precision", () => {
    const wire = createWireSnapshot();
    wire.accounts[0].currency = wire.days[0].currency = "JPY";
    wire.accounts[1].currency = wire.days[1].currency = "KWD";
    wire.days[0].amount = "12.50";
    wire.days[1].amount = "1.2345";
    const result = getAdvertisingSummary(snapshotFromWire(wire), ONE_DAY_FILTERS);

    expect(result.totals).toEqual([
      {
        currency: "JPY",
        amountMinor: 13,
        amountDecimal: "12.50",
        complete: true,
        accountCount: 1,
      },
      {
        currency: "KWD",
        amountMinor: 1235,
        amountDecimal: "1.2345",
        complete: true,
        accountCount: 1,
      },
    ]);
    expect(Object.keys(result.daily)).toEqual(["JPY", "KWD"]);
    expect(result.daily.KWD[0].amountDecimal).toBe("1.2345");
  });

  it("rejects a wire day that would mix its currency with another account", () => {
    const wire = createWireSnapshot();
    wire.days[0].currency = "USD";
    expect(() => snapshotFromWire(wire)).toThrow("La moneda del gasto no coincide con la cuenta");
  });

  it("preserves exact imported history for paused and disabled accounts", () => {
    const wire = createWireSnapshot();
    wire.accounts.forEach((account) => {
      account.enabled = false;
    });
    wire.providers.meta.status = "paused";
    wire.providers.tiktok.status = "needs-auth";
    const result = getAdvertisingSummary(snapshotFromWire(wire), ONE_DAY_FILTERS);

    expect(result.accounts).toHaveLength(2);
    expect(result.totals[0]).toMatchObject({
      amountDecimal: "0.010",
      amountMinor: 1,
      complete: true,
      accountCount: 2,
    });
  });

  it("replaces a repeated account/day report instead of adding a stale row twice", () => {
    const wire = createWireSnapshot();
    wire.days.push({
      ...wire.days[0],
      amount: "0.015",
      provisional: false,
      sourceRevision: "corrected-report",
      updatedAt: "2026-10-09T10:00:00Z",
    });
    const result = getAdvertisingSummary(snapshotFromWire(wire), ONE_DAY_FILTERS);

    expect(result.accounts[0].amountDecimal).toBe("0.015");
    expect(result.totals[0]).toMatchObject({ amountDecimal: "0.020", amountMinor: 2 });
    expect(result.daily.PEN[0].provisional).toBe(false);
  });

  it("does not describe a tiny positive amount rounded to zero as confirmed zero", () => {
    expect(isAdvertisingZero(0, "0.0001")).toBe(false);
    expect(isAdvertisingZero(null, null)).toBe(false);
    expect(isAdvertisingZero(0, "0.0000")).toBe(true);
    expect(isAdvertisingZero(0)).toBe(true);
  });

  it("recognizes an exact amount even when its presentation value is unavailable", () => {
    expect(
      hasAdvertisingAmount({
        amountMinor: null,
        amountDecimal: "90071992547409931234567890.125",
      }),
    ).toBe(true);
    expect(hasAdvertisingAmount({ amountMinor: 0, amountDecimal: null })).toBe(false);
    expect(hasAdvertisingAmount({ amountMinor: null, amountDecimal: null })).toBe(false);
    expect(hasAdvertisingAmount({ amountMinor: 0, amountDecimal: "0.0000" })).toBe(true);
    expect(hasAdvertisingAmount({ amountMinor: 0 })).toBe(true);
    expect(hasAdvertisingAmount(undefined)).toBe(false);
  });
});
