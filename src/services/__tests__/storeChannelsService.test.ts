jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import {
  createStoreSalesChannel,
  deactivateStoreSalesChannel,
  fetchStoreSalesChannels,
  storeChannelError,
  updateStorePresentation,
  updateStoreSalesChannel,
} from "../storeChannelsService";

const storeId = "shop-a";
const row = {
  id: "channel-a",
  storeId,
  type: "WEB",
  label: "Web LIVII",
  identifier: "livii.pe",
  externalId: null,
  normalizedIdentifier: "livii.pe",
  isActive: true,
};

describe("Canales concretos de una tienda", () => {
  beforeEach(() => jest.resetAllMocks());
  it("fetches through the authenticated company gateway with a cancellation signal", async () => {
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: [row] });
    const signal = new AbortController().signal;
    await expect(fetchStoreSalesChannels(storeId, signal)).resolves.toEqual([row]);
    expect(axiosAuth.get).toHaveBeenCalledWith(`${GATEWAY.company}/stores/${storeId}/channels`, {
      signal,
    });
  });
  it.each([
    [{ ...row, storeId: "foreign" }],
    [{ ...row, type: "unknown" }],
    [row, row],
    [{ ...row, isActive: "true" }],
    [{ ...row, normalizedIdentifier: { secret: "x" } }],
    null,
  ])("rejects invalid or cross-store responses", async (data) => {
    jest.mocked(axiosAuth.get).mockResolvedValue({ data });
    await expect(fetchStoreSalesChannels(storeId)).rejects.toThrow();
  });
  it("keeps only the canonical create fields and no company or user ID in its payload", async () => {
    jest.mocked(axiosAuth.post).mockResolvedValue({ data: row });
    await createStoreSalesChannel(storeId, {
      type: "WEB",
      label: " Web LIVII ",
      identifier: " livii.pe ",
      companyId: "spoof",
      userId: "spoof",
    } as any);
    expect(axiosAuth.post).toHaveBeenCalledWith(`${GATEWAY.company}/stores/${storeId}/channels`, {
      type: "WEB",
      label: "Web LIVII",
      identifier: "livii.pe",
      externalId: null,
    });
  });
  it("updates only mutable properties, preserving the destination identity", async () => {
    jest.mocked(axiosAuth.patch).mockResolvedValue({ data: { ...row, label: "Ventas" } });
    await updateStoreSalesChannel(storeId, row.id, {
      label: " Ventas ",
      identifier: "other.pe",
      storeId: "other",
    } as any);
    expect(axiosAuth.patch).toHaveBeenCalledWith(
      `${GATEWAY.company}/stores/${storeId}/channels/${row.id}`,
      { label: "Ventas" },
    );
  });
  it("does not accept a save response for another channel or store", async () => {
    jest.mocked(axiosAuth.patch).mockResolvedValue({ data: { ...row, id: "foreign" } });
    await expect(updateStoreSalesChannel(storeId, row.id, { label: "Ventas" })).rejects.toThrow();
  });
  it("deactivates instead of deleting history, and checks the returned state", async () => {
    jest
      .mocked(axiosAuth.delete)
      .mockResolvedValueOnce({ data: { ...row, isActive: false } })
      .mockResolvedValueOnce({ data: row });
    expect((await deactivateStoreSalesChannel(storeId, row.id)).isActive).toBe(false);
    expect(axiosAuth.delete).toHaveBeenCalledWith(
      `${GATEWAY.company}/stores/${storeId}/channels/${row.id}`,
    );
    await expect(deactivateStoreSalesChannel(storeId, row.id)).rejects.toThrow();
  });
  it("saves or resets only the protected presentation field", async () => {
    jest.mocked(axiosAuth.patch).mockResolvedValue({
      data: { id: storeId, color: null, is_legacy: false },
    });
    await expect(updateStorePresentation(storeId, null)).resolves.toEqual({
      id: storeId,
      color: null,
      is_legacy: false,
    });
    expect(axiosAuth.patch).toHaveBeenCalledWith(
      `${GATEWAY.company}/stores/${storeId}/presentation`,
      { color: null },
    );
  });
  it.each([
    { id: "foreign", color: "#7C3AED", is_legacy: false },
    { id: storeId, color: "url(secret)", is_legacy: false },
  ])("rejects unsafe or foreign presentation responses", async (data) => {
    jest.mocked(axiosAuth.patch).mockResolvedValue({ data });
    await expect(updateStorePresentation(storeId, "#7C3AED")).rejects.toThrow();
  });
  it("keeps raw errors and credentials out of displayed messages", () => {
    const failure = {
      isAxiosError: true,
      message: "Bearer secret",
      config: { Authorization: "secret" },
      response: { status: 403, data: { message: "leaked-secret" } },
    };
    expect(storeChannelError(failure)).toBe("Necesitas permiso para configurar esta tienda.");
    expect(storeChannelError({ ...failure, response: { status: 409 } })).toContain("inactivos");
    expect(storeChannelError(new Error("https://secret?token=value"))).not.toContain("secret");
  });
});
