import { getPartnerResourcesApi } from "../../api/partner-resources.api";
import { getPartnerResources } from "../get-partner-resources";

jest.mock("../../api/partner-resources.api", () => ({ getPartnerResourcesApi: jest.fn() }));
afterEach(() => jest.resetAllMocks());

it("returns actual published rows and preserves null metadata/download", async () => {
  const items = [
    {
      id: "55555555-5555-4555-8555-555555555555",
      title: "Guide",
      description: null,
      kind: "PDF" as const,
      category: "Guide",
      downloadUrl: null,
    },
  ];
  jest.mocked(getPartnerResourcesApi).mockResolvedValue({ items });
  const signal = new AbortController().signal;
  expect(await getPartnerResources("fixture-session-A", signal)).toEqual(items);
  expect(getPartnerResourcesApi).toHaveBeenCalledWith("fixture-session-A", signal);
});

it("accepts an empty library without inserting examples", async () => {
  jest.mocked(getPartnerResourcesApi).mockResolvedValue({ items: [] });
  expect(await getPartnerResources("fixture-session-A")).toEqual([]);
});

it("propagates unavailable responses without a mock fallback", async () => {
  const error = new Error("Fixture unavailable");
  jest.mocked(getPartnerResourcesApi).mockRejectedValue(error);
  await expect(getPartnerResources("fixture-session-A")).rejects.toBe(error);
});
