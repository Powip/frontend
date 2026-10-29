import axios from "axios";
import {
  getAdvertisingWorkspace,
  saveAdvertisingAssignment,
  saveAdvertisingPlan,
  saveAdvertisingRule,
} from "../advertisingWorkspaceService";

jest.mock("axios");
const base = process.env.NEXT_PUBLIC_API_INTEGRATIONS;
beforeEach(() => {
  jest.resetAllMocks();
  process.env.NEXT_PUBLIC_API_INTEGRATIONS = "https://integrations.example.test";
});
afterAll(() => {
  if (base === undefined) delete process.env.NEXT_PUBLIC_API_INTEGRATIONS;
  else process.env.NEXT_PUBLIC_API_INTEGRATIONS = base;
});
const root = "https://integrations.example.test/advertising/companies/company/workspace";

it("reads the complete workspace totals with period, authentication and abort without mutations", async () => {
  const data = { allocated: { totals: [{ currency: "PEN", amount: "100.005" }] } };
  jest.mocked(axios.get).mockResolvedValue({ data });
  const signal = new AbortController().signal;
  await expect(
    getAdvertisingWorkspace("token", "company", "2026-10-01", "2026-10-02", signal),
  ).resolves.toBe(data);
  expect(axios.get).toHaveBeenCalledWith(
    root,
    expect.objectContaining({
      params: { from: "2026-10-01", to: "2026-10-02" },
      signal,
      headers: { Authorization: "Bearer token" },
      withCredentials: false,
    }),
  );
  expect(axios.post).not.toHaveBeenCalled();
  expect(axios.put).not.toHaveBeenCalled();
});
it("preserves assignment version, future validity, original shares and reason in an explicit save", async () => {
  jest.mocked(axios.put).mockResolvedValue({ data: {} });
  const payload = {
    expectedVersion: 2,
    effectiveFrom: "2026-10-12",
    shares: [{ storeId: "store", channel: null, basisPoints: 10_000 }],
    reason: "Cuenta para tienda",
  };
  await saveAdvertisingAssignment("token", "company", "account", payload);
  expect(axios.put).toHaveBeenCalledWith(
    `${root}/accounts/account/assignment`,
    payload,
    expect.objectContaining({ headers: { Authorization: "Bearer token" } }),
  );
});
it("uses creation versus versioned update for rules and keeps budget amounts exact", async () => {
  jest.mocked(axios.post).mockResolvedValue({ data: {} });
  jest.mocked(axios.put).mockResolvedValue({ data: {} });
  const rule = {
    name: "Límite",
    accountId: null,
    currency: "PEN",
    threshold: "0.000000000001",
    enabled: true,
    expectedVersion: 0,
  };
  await saveAdvertisingRule("token", "company", null, rule);
  await saveAdvertisingRule("token", "company", "rule-id", { ...rule, expectedVersion: 3 });
  expect(axios.post).toHaveBeenCalledWith(`${root}/rules`, rule, expect.any(Object));
  expect(axios.put).toHaveBeenCalledWith(
    `${root}/rules/rule-id`,
    { ...rule, expectedVersion: 3 },
    expect.any(Object),
  );
  const plan = {
    name: "Escenario",
    from: "2026-10-01",
    to: "2026-10-02",
    currency: "PEN",
    budget: "100.005",
    targets: [{ accountId: "account", basisPoints: 10_000 }],
  };
  await saveAdvertisingPlan("token", "company", plan);
  expect(axios.post).toHaveBeenLastCalledWith(`${root}/plans`, plan, expect.any(Object));
});
