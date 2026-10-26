import axios from "axios";
import { getAllAdsCatalog } from "@/services/advertisingV22Service";

jest.mock("axios");
const identity = { companyId: "company", token: "token" };
const filters = { from: "2026-10-01", to: "2026-10-25", level: "ad" as const };
const pageData = (page: number, total = 601, canManageAds = true) => ({
  rows: [{ id: String(page) }],
  accounts: [],
  capabilities: { canManageAds },
  pagination: { page, pageSize: 100, total, hasMore: page * 100 < total },
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_API_INTEGRATIONS = "https://integrations.test";
});

it("loads at most four remaining catalog pages together and preserves server order", async () => {
  const pending = new Map<number, (value: unknown) => void>();
  const signal = new AbortController().signal;
  (axios.get as jest.Mock).mockImplementation((_url, options) => {
    const page = options.params.page;
    expect(options.signal).toBe(signal);
    if (page === 1) return Promise.resolve({ data: pageData(1) });
    return new Promise((resolve) => pending.set(page, resolve));
  });
  const request = getAllAdsCatalog(identity, filters, signal);
  await Promise.resolve();
  await Promise.resolve();
  expect([...pending.keys()]).toEqual([2, 3, 4, 5]);
  // Completion order must not change the visible catalog order.
  for (const page of [5, 4, 3, 2]) pending.get(page)!({ data: pageData(page) });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect([...pending.keys()]).toEqual([2, 3, 4, 5, 6, 7]);
  pending.get(7)!({ data: pageData(7) });
  pending.get(6)!({ data: pageData(6) });
  const catalog = await request;
  expect(catalog.rows.map((row) => row.id)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
  expect(catalog.capabilities.canManageAds).toBe(true);
});

it("requires every page to confirm management capability", async () => {
  (axios.get as jest.Mock).mockImplementation(async (_url, options) => ({
    data: pageData(options.params.page, 301, options.params.page !== 2),
  }));
  const catalog = await getAllAdsCatalog(identity, filters);
  expect(catalog.rows).toHaveLength(4);
  expect(catalog.capabilities.canManageAds).toBe(false);
});

it("follows hasMore if the catalog grows beyond its initial total", async () => {
  (axios.get as jest.Mock).mockImplementation(async (_url, options) => ({
    data: { ...pageData(options.params.page, 201), pagination: {
      page: options.params.page, total: 101, pageSize: 100, hasMore: options.params.page < 3,
    } },
  }));
  const catalog = await getAllAdsCatalog(identity, filters);
  expect(catalog.rows.map((row) => row.id)).toEqual(["1", "2", "3"]);
});
