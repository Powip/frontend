import axios from "axios";
import { cancelSubscription, deleteSubscription } from "../subscriptionService";

jest.mock("axios");
const mockedPut = axios.put as jest.Mock;
const mockedDelete = axios.delete as jest.Mock;

describe("cancelSubscription", () => {
  beforeEach(() => {
    mockedPut.mockReset().mockResolvedValue({ data: {} });
    mockedDelete.mockReset().mockResolvedValue({});
  });

  it("usa PUT /{id}/cancel (cancela también en Flow) y no borra la fila", async () => {
    await cancelSubscription("jwt", "s1");

    expect(mockedPut).toHaveBeenCalledTimes(1);
    expect(mockedPut.mock.calls[0][0]).toMatch(/\/subscriptions\/s1\/cancel$/);
    expect(mockedPut.mock.calls[0][2]).toEqual({ headers: { Authorization: "Bearer jwt" } });
    expect(mockedDelete).not.toHaveBeenCalled();
  });
});

describe("deleteSubscription", () => {
  beforeEach(() => mockedDelete.mockReset().mockResolvedValue({}));

  it("borra la fila con DELETE /{id} (solo para rollback del alta manual)", async () => {
    await deleteSubscription("jwt", "s1");

    expect(mockedDelete.mock.calls[0][0]).toMatch(/\/subscriptions\/s1$/);
    expect(mockedDelete.mock.calls[0][1]).toEqual({ headers: { Authorization: "Bearer jwt" } });
  });
});
