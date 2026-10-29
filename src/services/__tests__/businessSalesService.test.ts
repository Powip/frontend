import { waitFor } from "@testing-library/react";
import axiosAuth from "@/lib/axiosAuth";
import type { OrderHeader } from "@/interfaces/IOrder";
import {
  getBusinessSalesExport,
  getBusinessSalesPage,
  type BusinessSalesPage,
  type BusinessSalesQuery,
} from "../businessSalesService";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));

const query: BusinessSalesQuery = { tab: "todas", page: 7, limit: 10, search: "Angela", region: "LIMA" };
const order = (id: string, grandTotal = "10") => ({ id, grandTotal }) as OrderHeader;
const page = (data: OrderHeader[], pageNumber: number, totalPages = 3): BusinessSalesPage => ({
  data, page: pageNumber, total: 250, totalPages,
  counts: { pendientes: 0, anuladas: 0, todas: 250 },
  kpis: { pendientes: 0, anuladas: 0, amounts: [] },
});

beforeEach(() => { jest.resetAllMocks(); });

it("forwards the abort signal and bounds a page request without downloading exports", async () => {
  const response = page([order("visible")], 1);
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: response });
  const controller = new AbortController();
  expect(axiosAuth.get).not.toHaveBeenCalled();
  expect(await getBusinessSalesPage(["store-b", "store-a", "store-b"], { ...query, page: 1 }, controller.signal)).toBe(response);
  expect(axiosAuth.get).toHaveBeenCalledTimes(1);
  const [url, config] = jest.mocked(axiosAuth.get).mock.calls[0];
  const params = new URL(String(url), "http://localhost").searchParams;
  expect(params.get("storeIds")).toBe("store-a,store-b");
  expect(params.get("page")).toBe("1");
  expect(params.get("limit")).toBe("10");
  expect(params.get("search")).toBe("Angela");
  expect(params.has("includeCustomerService")).toBe(false);
  expect(config).toEqual({ signal: controller.signal });
});

it("downloads export pages of 100 sequentially only on explicit invocation and deduplicates IDs", async () => {
  const resolvers: ((value: { data: BusinessSalesPage }) => void)[] = [];
  jest.mocked(axiosAuth.get).mockImplementation(() => new Promise((resolve) => {
    resolvers.push(resolve);
  }));
  const controller = new AbortController();
  expect(axiosAuth.get).not.toHaveBeenCalled();
  const exporting = getBusinessSalesExport(["store-a", "store-b"], query, controller.signal);
  void exporting.catch(() => {});
  expect(axiosAuth.get).toHaveBeenCalledTimes(1);
  resolvers[0]({ data: page([order("first"), order("duplicate", "10")], 1) });
  await waitFor(() => expect(axiosAuth.get).toHaveBeenCalledTimes(2));
  expect(resolvers).toHaveLength(2);
  resolvers[1]({ data: page([order("second"), order("duplicate", "20")], 2) });
  await waitFor(() => expect(axiosAuth.get).toHaveBeenCalledTimes(3));
  resolvers[2]({ data: page([order("third")], 3) });
  expect(await exporting).toEqual([
    order("first"), order("duplicate", "20"), order("second"), order("third"),
  ]);
  for (const [index, [url, config]] of jest.mocked(axiosAuth.get).mock.calls.entries()) {
    const params = new URL(String(url), "http://localhost").searchParams;
    expect(params.get("limit")).toBe("100");
    expect(params.get("page")).toBe(String(index + 1));
    expect(params.get("search")).toBe("Angela");
    expect(params.get("region")).toBe("LIMA");
    expect(params.get("storeIds")).toBe("store-a,store-b");
    expect(params.get("includeSummary")).toBe("false");
    expect(params.has("includeCustomerService")).toBe(false);
    expect(config).toEqual({ signal: controller.signal });
  }
});

it("rejects an export instead of returning a partial file when a later page fails", async () => {
  const error = new Error("The second page is unavailable");
  jest.mocked(axiosAuth.get)
    .mockResolvedValueOnce({ data: page([order("first")], 1) })
    .mockRejectedValueOnce(error);
  await expect(getBusinessSalesExport(["store-a"], query)).rejects.toBe(error);
  expect(axiosAuth.get).toHaveBeenCalledTimes(2);
});

it("stops the export before its next page after cancellation", async () => {
  const controller = new AbortController();
  jest.mocked(axiosAuth.get).mockImplementation(async () => {
    controller.abort();
    return { data: page([order("first")], 1) };
  });
  await expect(getBusinessSalesExport(["store-a"], query, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(axiosAuth.get).toHaveBeenCalledTimes(1);
});

it("rejects unbounded or unscoped requests before contacting the server", async () => {
  await expect(getBusinessSalesPage([], query)).rejects.toThrow("Selecciona tiendas válidas");
  await expect(getBusinessSalesPage([""], query)).rejects.toThrow("Selecciona tiendas válidas");
  await expect(getBusinessSalesPage(["store-a"], { ...query, page: 0 })).rejects.toThrow("La página solicitada");
  await expect(getBusinessSalesPage(["store-a"], { ...query, limit: 101 })).rejects.toThrow("La página solicitada");
  expect(axiosAuth.get).not.toHaveBeenCalled();
});
