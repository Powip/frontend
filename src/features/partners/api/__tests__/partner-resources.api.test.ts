import { AxiosError } from "axios";
import { tokenStore } from "@/lib/tokenStore";
import { buildAxiosError } from "../../test-utils/axios-error";
import { getPartnerResourcesApi, partnerResourcesClient } from "../partner-resources.api";

jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.review.invalid/v1/partners" },
}));

const resource = {
  id: "55555555-5555-4555-8555-555555555555",
  title: "Guide",
  description: null,
  kind: "PDF",
  category: "Guide",
  downloadUrl: "https://assets.powip.tech/partners/guide.pdf",
};
const page = { items: [resource] };
const originalAdapter = partnerResourcesClient.defaults.adapter;
const interceptors: number[] = [];
afterEach(() => {
  jest.restoreAllMocks();
  interceptors.splice(0).forEach((id) => {
    partnerResourcesClient.interceptors.request.eject(id);
  });
  partnerResourcesClient.defaults.adapter = originalAdapter;
  tokenStore.set(null);
});

it("pins the bearer without a client-selected country/partner", async () => {
  const get = jest.spyOn(partnerResourcesClient, "get").mockResolvedValue({ data: page });
  const signal = new AbortController().signal;
  expect(await getPartnerResourcesApi("fixture-A", signal)).toEqual(page);
  expect(get).toHaveBeenCalledWith("https://partners.review.invalid/v1/partners/me/resources", {
    headers: { Authorization: "Bearer fixture-A" },
    signal,
  });
});
it.each(["VIDEO", "PDF", "LOGOS"])(
  "accepts actual kind %s with null metadata/download",
  async (kind) => {
    const data = { items: [{ ...resource, kind, downloadUrl: null }] };
    jest.spyOn(partnerResourcesClient, "get").mockResolvedValue({ data });
    expect(await getPartnerResourcesApi("fixture-A")).toEqual(data);
  },
);
it.each([
  "javascript:alert(1)",
  "http://assets.powip.tech/guide.pdf",
  "https://localhost/guide.pdf",
  "https://127.0.0.1/guide.pdf",
  "https://[::1]/guide.pdf",
  "https://example.internal/guide.pdf",
  "https://a:b@assets.powip.tech/guide.pdf",
  "https://assets.powip.tech/guide.pdf?token=secret",
  "https://assets.powip.tech/guide.pdf#secret",
  "https://assets.powip.tech:8443/guide.pdf",
  " https://assets.powip.tech/guide.pdf",
  "https://assets.powip.tech/guide.pdf\n",
  "https://assets.powip.tech\\guide.pdf",
])("rejects unsafe URL %s before rendering", async (downloadUrl) => {
  jest
    .spyOn(partnerResourcesClient, "get")
    .mockResolvedValue({ data: { items: [{ ...resource, downloadUrl }] } });
  await expect(getPartnerResourcesApi("fixture-A")).rejects.toThrow();
});
it.each([
  { ...page, ownerUserId: "client-scope" },
  { items: [{ ...resource, email: "private@review.invalid" }] },
  { items: [{ ...resource, id: "not-a-uuid" }] },
  { items: [{ ...resource, kind: "templates" }] },
  { items: [{ ...resource, description: undefined }] },
  { items: Array.from({ length: 201 }, () => resource) },
])("fails closed on malformed/expanded contracts: %#", async (data) => {
  jest.spyOn(partnerResourcesClient, "get").mockResolvedValue({ data });
  await expect(getPartnerResourcesApi("fixture-A")).rejects.toThrow();
});
it.each([401, 403, 503])("propagates HTTP %s without fabricated rows", async (status) => {
  const error = buildAxiosError(status, { code: "RESOURCES_UNAVAILABLE" });
  jest.spyOn(partnerResourcesClient, "get").mockRejectedValue(error);
  await expect(getPartnerResourcesApi("fixture-A")).rejects.toBe(error);
});
it("requires a token before HTTP dispatch", async () => {
  const get = jest.spyOn(partnerResourcesClient, "get");
  await expect(getPartnerResourcesApi("")).rejects.toThrow();
  expect(get).not.toHaveBeenCalled();
});
it("uses ten-second timeout and propagates timeout failures", async () => {
  expect(partnerResourcesClient.defaults.timeout).toBe(10_000);
  const error = new AxiosError("Fixture timeout", "ECONNABORTED");
  jest.spyOn(partnerResourcesClient, "get").mockRejectedValue(error);
  await expect(getPartnerResourcesApi("fixture-A")).rejects.toBe(error);
});
it("dispatches with Bearer A even after tokenStore switches to B", async () => {
  let entered!: () => void;
  let release!: () => void;
  const entering = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const paused = new Promise<void>((resolve) => {
    release = resolve;
  });
  interceptors.push(
    partnerResourcesClient.interceptors.request.use(async (config) => {
      entered();
      await paused;
      return config;
    }),
  );
  let bearer: unknown;
  partnerResourcesClient.defaults.adapter = async (config) => {
    bearer = config.headers.Authorization;
    return { data: page, status: 200, statusText: "OK", headers: {}, config };
  };
  tokenStore.set("fixture-A");
  const request = getPartnerResourcesApi("fixture-A");
  await entering;
  tokenStore.set("fixture-B");
  release();
  await request;
  expect(bearer).toBe("Bearer fixture-A");
});
