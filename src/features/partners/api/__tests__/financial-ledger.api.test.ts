import axios from "axios";
import { API } from "@/lib/api";
import { ledgerBalanceFixture, ledgerPageFixture } from "../../test-utils/financial-ledger.fixture";
import {
  financialLedgerClient,
  requestOwnFinancialBalance,
  requestOwnFinancialLedger,
} from "../financial-ledger.api";

jest.mock("axios", () => ({
  __esModule: true,
  default: { create: jest.fn(() => ({ get: jest.fn() })) },
}));
const get = jest.mocked(financialLedgerClient.get);
beforeEach(() => get.mockReset());

it("uses per-request bearer and bounded cursor, never user_id or a global token", async () => {
  const controller = new AbortController();
  get.mockResolvedValue({ data: ledgerPageFixture([], { limit: 1 }) });
  await requestOwnFinancialLedger({
    accessToken: "captured-bearer",
    signal: controller.signal,
    cursor: "opaque",
    limit: 1,
  });
  expect(axios.create).toHaveBeenCalledWith({ timeout: 10_000 });
  expect(get).toHaveBeenCalledWith(`${API.partners}/me/financial-ledger`, {
    headers: { Authorization: "Bearer captured-bearer" },
    signal: controller.signal,
    params: { cursor: "opaque", limit: 1 },
  });
});
it("reads its real aggregate without computing money from a partial page", async () => {
  get.mockResolvedValue({ data: ledgerBalanceFixture });
  expect(await requestOwnFinancialBalance({ accessToken: "captured" })).toEqual(
    ledgerBalanceFixture,
  );
  expect(get).toHaveBeenCalledWith(`${API.partners}/me/financial-balance`, {
    headers: { Authorization: "Bearer captured" },
    signal: undefined,
  });
});
it.each(["", " token", "token "])(
  "rejects invalid sessions before any dispatch: %p",
  async (accessToken) => {
    await expect(requestOwnFinancialBalance({ accessToken })).rejects.toBeDefined();
    expect(get).not.toHaveBeenCalled();
  },
);
it("rejects owner expansion, wrong page limits, repeated cursors and malformed server data", async () => {
  await expect(
    requestOwnFinancialBalance({ accessToken: "captured", partnerId: "other" } as never),
  ).rejects.toBeDefined();
  expect(get).not.toHaveBeenCalled();
  get.mockResolvedValue({ data: ledgerPageFixture() });
  await expect(
    requestOwnFinancialLedger({ accessToken: "captured", limit: 1 }),
  ).rejects.toBeDefined();
  get.mockResolvedValue({
    data: ledgerPageFixture(undefined, { limit: 1, hasMore: true, nextCursor: "same" }),
  });
  await expect(
    requestOwnFinancialLedger({ accessToken: "captured", limit: 1, cursor: "same" }),
  ).rejects.toBeDefined();
  get.mockResolvedValue({ data: { ...ledgerBalanceFixture, postedLedgerBalance: 34.5 } });
  await expect(requestOwnFinancialBalance({ accessToken: "captured" })).rejects.toBeDefined();
});
it.each([401, 403, 503])(
  "preserves denial/availability errors (%s) without a zero fallback",
  async (status) => {
    const error = { response: { status } };
    get.mockRejectedValue(error);
    await expect(requestOwnFinancialBalance({ accessToken: "captured" })).rejects.toBe(error);
  },
);
