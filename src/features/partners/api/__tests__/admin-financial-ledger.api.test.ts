import { API } from "@/lib/api";
import {
  ledgerBalanceFixture,
  ledgerEntryFixture,
  ledgerPageFixture,
} from "../../test-utils/financial-ledger.fixture";
import {
  financialLedgerClient,
  requestAdminFinancialBalance,
  requestAdminFinancialLedger,
} from "../financial-ledger.api";

jest.mock("axios", () => ({
  __esModule: true,
  default: { create: jest.fn(() => ({ get: jest.fn() })) },
}));
const get = jest.mocked(financialLedgerClient.get);
const PARTNER = ledgerEntryFixture.partnerId;
const OTHER = "99999999-9999-4999-8999-999999999999";
beforeEach(() => get.mockReset());

it("requests two concurrent partner-scoped endpoints with independent captured bearer and signal", async () => {
  const first = new AbortController();
  const second = new AbortController();
  get
    .mockResolvedValueOnce({ data: ledgerPageFixture(undefined, { limit: 1 }) })
    .mockResolvedValueOnce({
      data: {
        ...ledgerBalanceFixture,
        partnerId: OTHER,
        postedLedgerBalance: "-1234567890123456789012345.12345678",
      },
    });
  const [page, balance] = await Promise.all([
    requestAdminFinancialLedger({
      accessToken: "captured-A",
      signal: first.signal,
      partnerId: PARTNER,
      cursor: "exact_cursor",
      limit: 1,
    }),
    requestAdminFinancialBalance({
      accessToken: "captured-B",
      signal: second.signal,
      partnerId: OTHER,
    }),
  ]);
  expect(page.items).toEqual([ledgerEntryFixture]);
  expect(balance.postedLedgerBalance).toBe("-1234567890123456789012345.12345678");
  expect(get).toHaveBeenNthCalledWith(1, `${API.partners}/admin/financial-ledger`, {
    headers: { Authorization: "Bearer captured-A" },
    signal: first.signal,
    params: { partnerId: PARTNER, currency: "PEN", cursor: "exact_cursor", limit: 1 },
  });
  expect(get).toHaveBeenNthCalledWith(2, `${API.partners}/admin/financial-balance`, {
    headers: { Authorization: "Bearer captured-B" },
    signal: second.signal,
    params: { partnerId: OTHER, currency: "PEN" },
  });
});

it.each([
  undefined,
  null,
  "",
  " user-id",
  "../me",
  "44444444-4444-4444-8444-44444444444",
  "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
])(
  "rejects absent or noncanonical partner scope before either HTTP dispatch: %p",
  async (partnerId) => {
    await expect(
      requestAdminFinancialLedger({ accessToken: "captured", partnerId } as never),
    ).rejects.toBeDefined();
    await expect(
      requestAdminFinancialBalance({ accessToken: "captured", partnerId } as never),
    ).rejects.toBeDefined();
    expect(get).not.toHaveBeenCalled();
  },
);

it.each(["", " token", "token "])("rejects malformed captured bearer %p", async (accessToken) => {
  await expect(
    requestAdminFinancialLedger({ accessToken, partnerId: PARTNER }),
  ).rejects.toBeDefined();
  await expect(
    requestAdminFinancialBalance({ accessToken, partnerId: PARTNER }),
  ).rejects.toBeDefined();
  expect(get).not.toHaveBeenCalled();
});

it.each([
  { userId: OTHER },
  { ownerUserId: OTHER },
  { currency: "USD" },
  { country: "PE" },
  { approvalId: OTHER },
])("rejects unsupported ownership/query expansion: %p", async (extra) => {
  await expect(
    requestAdminFinancialLedger({ accessToken: "captured", partnerId: PARTNER, ...extra } as never),
  ).rejects.toBeDefined();
  await expect(
    requestAdminFinancialBalance({
      accessToken: "captured",
      partnerId: PARTNER,
      ...extra,
    } as never),
  ).rejects.toBeDefined();
  expect(get).not.toHaveBeenCalled();
});

it.each([{ limit: 0 }, { limit: 101 }, { limit: 1.5 }, { cursor: " padded" }])(
  "rejects unbounded page parameters %p",
  async (params) => {
    await expect(
      requestAdminFinancialLedger({ accessToken: "captured", partnerId: PARTNER, ...params }),
    ).rejects.toBeDefined();
    expect(get).not.toHaveBeenCalled();
  },
);

it("rejects valid financial data if it belongs to a different actual partner UUID", async () => {
  get
    .mockResolvedValueOnce({
      data: ledgerPageFixture([{ ...ledgerEntryFixture, partnerId: OTHER }]),
    })
    .mockResolvedValueOnce({ data: { ...ledgerBalanceFixture, partnerId: OTHER } });
  await expect(
    requestAdminFinancialLedger({ accessToken: "captured", partnerId: PARTNER }),
  ).rejects.toThrow("partner scope");
  await expect(
    requestAdminFinancialBalance({ accessToken: "captured", partnerId: PARTNER }),
  ).rejects.toThrow("partner scope");
});

it("rejects mismatched limits, repeated cursors and fabricated payable/numeric amounts", async () => {
  get.mockResolvedValueOnce({ data: ledgerPageFixture() });
  await expect(
    requestAdminFinancialLedger({ accessToken: "captured", partnerId: PARTNER, limit: 1 }),
  ).rejects.toBeDefined();
  get.mockResolvedValueOnce({
    data: ledgerPageFixture(undefined, { limit: 1, hasMore: true, nextCursor: "same_cursor" }),
  });
  await expect(
    requestAdminFinancialLedger({
      accessToken: "captured",
      partnerId: PARTNER,
      cursor: "same_cursor",
      limit: 1,
    }),
  ).rejects.toBeDefined();
  for (const extra of [{ postedLedgerBalance: 95.22 }, { settlementEligibility: "PAYABLE" }]) {
    get.mockResolvedValueOnce({ data: { ...ledgerBalanceFixture, ...extra } });
    await expect(
      requestAdminFinancialBalance({ accessToken: "captured", partnerId: PARTNER }),
    ).rejects.toBeDefined();
  }
});

it.each([401, 403, 404, 503])(
  "preserves actual HTTP%s without a zero or global-ledger fallback",
  async (status) => {
    const error = { response: { status } };
    get.mockRejectedValue(error);
    await expect(
      requestAdminFinancialLedger({ accessToken: "captured", partnerId: PARTNER }),
    ).rejects.toBe(error);
    await expect(
      requestAdminFinancialBalance({ accessToken: "captured", partnerId: PARTNER }),
    ).rejects.toBe(error);
  },
);
