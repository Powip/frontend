import axios from "axios";
import { fetchUserSubscription } from "../fetchUserSubscription";

jest.mock("axios");
const mockedGet = axios.get as jest.Mock;

const sub = (id: string, status: string) => ({ id, status, plan: { id: "p", name: "Basic" } });

describe("fetchUserSubscription", () => {
  beforeEach(() => mockedGet.mockReset());

  it("usa /subscriptions/me por el gateway con el JWT", async () => {
    mockedGet.mockResolvedValueOnce({ data: sub("s1", "ACTIVE") });

    await expect(fetchUserSubscription("u1", "jwt")).resolves.toEqual(sub("s1", "ACTIVE"));
    expect(mockedGet.mock.calls[0][0]).toMatch(/\/subscription\/subscriptions\/me$/);
    expect(mockedGet.mock.calls[0][1]).toEqual({ headers: { Authorization: "Bearer jwt" } });
  });

  it("null si /me dice que no tiene suscripción", async () => {
    mockedGet.mockResolvedValueOnce({ data: null });
    await expect(fetchUserSubscription("u1", "jwt")).resolves.toBeNull();
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it("si /me no existe todavía, cae a la lista y prioriza la ACTIVE (antes tomaba la [0])", async () => {
    mockedGet
      .mockRejectedValueOnce(new Error("404"))
      .mockResolvedValueOnce({ data: [sub("vieja", "CANCELED"), sub("pend", "PENDING_PAYMENT"), sub("ok", "ACTIVE")] });

    await expect(fetchUserSubscription("u1", "jwt")).resolves.toMatchObject({ id: "ok" });
  });

  it("null si ambas fuentes fallan", async () => {
    mockedGet.mockRejectedValue(new Error("down"));
    await expect(fetchUserSubscription("u1", "jwt")).resolves.toBeNull();
  });
});
