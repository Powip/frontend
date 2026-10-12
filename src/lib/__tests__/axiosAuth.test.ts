import type { InternalAxiosRequestConfig } from "axios";
import axiosAuth from "../axiosAuth";
import { tokenStore } from "../tokenStore";

async function requestAuthorization(headers?: Record<string, string>) {
  const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => ({
    data: {},
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  }));

  await axiosAuth.get("https://ventas.example.com/stats/summary", { headers, adapter });

  expect(adapter).toHaveBeenCalledTimes(1);
  return adapter.mock.calls[0][0].headers.get("Authorization");
}

afterEach(() => tokenStore.set(null));

describe("axiosAuth authentication", () => {
  it.each(["Authorization", "authorization"])(
    "preserves an explicit current token in the %s header when the stored token is older",
    async (header) => {
      tokenStore.set("previous-session-token");

      expect(await requestAuthorization({ [header]: "Bearer current-session-token" }))
        .toBe("Bearer current-session-token");
    },
  );

  it("injects the stored token when no Authorization header was provided", async () => {
    tokenStore.set("stored-token");

    expect(await requestAuthorization()).toBe("Bearer stored-token");
  });

  it("leaves Authorization unset when neither an explicit nor stored token is available", async () => {
    tokenStore.set(null);

    expect(await requestAuthorization()).toBeUndefined();
  });
});
