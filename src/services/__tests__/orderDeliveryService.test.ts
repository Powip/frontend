import axiosAuth from "@/lib/axiosAuth";
import { updateClient } from "@/services/clients.service";
import { saveAliclikDestinationCoordinates } from "../orderDeliveryService";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() },
}));
jest.mock("@/services/clients.service", () => ({ updateClient: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

it("stores new destination coordinates on the order without changing the shared client", async () => {
  jest
    .mocked(axiosAuth.get)
    .mockResolvedValue({
      data: { id: "order", companyId: "company", deliverySnapshot: { version: 1 } },
    });
  await saveAliclikDestinationCoordinates("order", "company", "client", -12, -77);
  expect(axiosAuth.put).toHaveBeenCalledWith(expect.stringContaining("/manual/order/full"), {
    delivery: { latitude: -12, longitude: -77 },
  });
  expect(updateClient).not.toHaveBeenCalled();
});

it("keeps legacy client coordinates behavior after verifying the order", async () => {
  jest
    .mocked(axiosAuth.get)
    .mockResolvedValue({ data: { id: "order", companyId: "company", deliverySnapshot: null } });
  await saveAliclikDestinationCoordinates("order", "company", "client", -12, -77);
  expect(updateClient).toHaveBeenCalledWith("client", {
    companyId: "company",
    latitude: -12,
    longitude: -77,
  });
  expect(axiosAuth.put).not.toHaveBeenCalled();
});

it.each(["read error", "wrong order", "wrong company"])(
  "never falls back to changing the client after %s",
  async (reason) => {
    if (reason === "read error")
      jest.mocked(axiosAuth.get).mockRejectedValue(new Error("Read failed"));
    else
      jest
        .mocked(axiosAuth.get)
        .mockResolvedValue({
          data: {
            id: reason === "wrong order" ? "other" : "order",
            companyId: reason === "wrong company" ? "other" : "company",
          },
        });
    await expect(
      saveAliclikDestinationCoordinates("order", "company", "client", -12, -77),
    ).rejects.toThrow();
    expect(axiosAuth.put).not.toHaveBeenCalled();
    expect(updateClient).not.toHaveBeenCalled();
  },
);

it("does not fall back to shared client coordinates if the order update fails", async () => {
  jest
    .mocked(axiosAuth.get)
    .mockResolvedValue({
      data: { id: "order", companyId: "company", deliverySnapshot: { version: 1 } },
    });
  jest.mocked(axiosAuth.put).mockRejectedValue(new Error("Destination locked"));
  await expect(
    saveAliclikDestinationCoordinates("order", "company", undefined, -12, -77),
  ).rejects.toThrow("Destination locked");
  expect(updateClient).not.toHaveBeenCalled();
});
