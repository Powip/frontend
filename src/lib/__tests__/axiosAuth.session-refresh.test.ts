import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import axiosAuth from "../axiosAuth";
import {
  cancelSessionRefresh,
  registerSessionRefresher,
  requestSessionToken,
} from "../sessionRefresh";
import { tokenStore } from "../tokenStore";

const SCOPE = "user-a:company-a";
let unregister: (() => void) | undefined;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function response(config: InternalAxiosRequestConfig, status = 200): AxiosResponse {
  return { data: {}, status, statusText: String(status), headers: {}, config };
}

function reject(config: InternalAxiosRequestConfig, status = 401): never {
  throw new AxiosError(
    "Request rejected",
    AxiosError.ERR_BAD_REQUEST,
    config,
    undefined,
    response(config, status),
  );
}

function registerRenewal() {
  const renew = jest.fn(async () => {
    const session = tokenStore.snapshot();
    const token = await requestSessionToken(session);
    if (!token || !tokenStore.isCurrent(session)) return false;
    tokenStore.set(token, SCOPE);
    return true;
  });
  unregister = registerSessionRefresher(renew);
  return renew;
}

beforeEach(() => {
  tokenStore.set("expired-token", SCOPE);
  jest.spyOn(axios, "post").mockResolvedValue({ data: { accessToken: "renewed-token" } });
});

afterEach(() => {
  unregister?.();
  unregister = undefined;
  cancelSessionRefresh();
  tokenStore.set(null);
  jest.restoreAllMocks();
});

it("renews an expired bearer and retries the same sale payload exactly once", async () => {
  registerRenewal();
  const attempts: { bearer: unknown; body: unknown }[] = [];
  const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
    attempts.push({ bearer: config.headers.get("Authorization"), body: config.data });
    if (attempts.length === 1) reject(config);
    return response(config);
  });
  const payload = {
    items: [{ productVariantId: "replacement", quantity: 1, unitPrice: 59 }],
    shippingTotal: 10,
  };

  await axiosAuth.put("/ventas/order-header/manual/order-1/full", payload, { adapter });

  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post).toHaveBeenCalledWith(
    "/api/auth/refresh",
    {},
    {
      withCredentials: true,
      signal: expect.any(AbortSignal),
    },
  );
  expect(attempts).toEqual([
    { bearer: "Bearer expired-token", body: JSON.stringify(payload) },
    { bearer: "Bearer renewed-token", body: JSON.stringify(payload) },
  ]);
});

it("coalesces simultaneous 401s into one cookie refresh", async () => {
  registerRenewal();
  const pending = deferred<{ data: { accessToken: string } }>();
  jest.mocked(axios.post).mockImplementationOnce(() => pending.promise);
  const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
    if (config.headers.get("Authorization") === "Bearer expired-token") reject(config);
    return response(config);
  });
  const first = axiosAuth.get("/ventas/a", { adapter });
  const second = axiosAuth.get("/ventas/b", { adapter });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  pending.resolve({ data: { accessToken: "renewed-token" } });
  await Promise.all([first, second]);
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(adapter).toHaveBeenCalledTimes(4);
});

it("reuses a newer bearer for a delayed 401 without refreshing again", async () => {
  registerRenewal();
  const late = deferred<void>();
  let attempt = 0;
  const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
    if (++attempt === 1) {
      await late.promise;
      reject(config);
    }
    return response(config);
  });
  const request = axiosAuth.get("/ventas/a", { adapter });
  await Promise.resolve();
  await Promise.resolve();
  tokenStore.set("renewed-token", SCOPE);
  late.resolve();
  await request;
  expect(axios.post).not.toHaveBeenCalled();
  expect(adapter.mock.calls[1][0].headers.get("Authorization")).toBe("Bearer renewed-token");
});

it.each(["explicit-different", "403", "auth-endpoint", "anonymous"])(
  "does not refresh or replay %s",
  async (scenario) => {
    const renew = registerRenewal();
    if (scenario === "anonymous") tokenStore.set(null);
    const adapter = jest.fn(async (config: InternalAxiosRequestConfig) =>
      reject(config, scenario === "403" ? 403 : 401),
    );
    const headers =
      scenario === "explicit-different" ? { Authorization: "Bearer another-token" } : undefined;
    await expect(
      axiosAuth.get(scenario === "auth-endpoint" ? "/api/auth/refresh" : "/ventas/a", {
        headers,
        adapter,
      }),
    ).rejects.toMatchObject({ response: { status: scenario === "403" ? 403 : 401 } });
    expect(renew).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(adapter).toHaveBeenCalledTimes(1);
    if (headers)
      expect(adapter.mock.calls[0][0].headers.get("Authorization")).toBe(headers.Authorization);
  },
);

it("recovers an explicitly supplied bearer only when it matches the active session", async () => {
  registerRenewal();
  let attempt = 0;
  const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
    if (++attempt === 1) reject(config);
    return response(config);
  });
  await axiosAuth.get("/ventas/a", { headers: { authorization: "Bearer expired-token" }, adapter });
  expect(adapter).toHaveBeenCalledTimes(2);
  expect(axios.post).toHaveBeenCalledTimes(1);
});

it("does not loop when a renewed request is still unauthorized", async () => {
  registerRenewal();
  const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => reject(config));
  await expect(axiosAuth.put("/ventas/a", { amount: 59 }, { adapter })).rejects.toMatchObject({
    response: { status: 401 },
  });
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(adapter).toHaveBeenCalledTimes(2);
});

it("preserves the original failure and session if cookie renewal fails", async () => {
  registerRenewal();
  jest.mocked(axios.post).mockRejectedValueOnce(new Error("Refresh unavailable"));
  const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => reject(config));
  await expect(axiosAuth.get("/ventas/a", { adapter })).rejects.toMatchObject({
    response: { status: 401 },
  });
  expect(adapter).toHaveBeenCalledTimes(1);
  expect(tokenStore.get()).toBe("expired-token");
});

it.each(["logout", "account", "company", "relogin-same-token"])(
  "does not replay across a %s boundary while renewing",
  async (transition) => {
    registerRenewal();
    const pending = deferred<{ data: { accessToken: string } }>();
    jest.mocked(axios.post).mockImplementationOnce(() => pending.promise);
    const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => reject(config));
    const request = axiosAuth.put("/ventas/a", { amount: 59 }, { adapter });
    const failed = expect(request).rejects.toMatchObject({ response: { status: 401 } });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    if (transition === "logout") tokenStore.set(null);
    else if (transition === "account") tokenStore.set("account-b-token", "user-b:company-a");
    else if (transition === "company") tokenStore.set("expired-token", "user-a:company-b");
    else {
      tokenStore.invalidate();
      tokenStore.set("expired-token", SCOPE);
    }
    pending.resolve({ data: { accessToken: "renewed-token" } });
    await failed;
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(tokenStore.get()).not.toBe("renewed-token");
  },
);

it("does not replay when the original request is canceled during renewal", async () => {
  registerRenewal();
  const pending = deferred<{ data: { accessToken: string } }>();
  jest.mocked(axios.post).mockImplementationOnce(() => pending.promise);
  const controller = new AbortController();
  const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => reject(config));
  const request = axiosAuth.get("/ventas/a", { adapter, signal: controller.signal });
  const failed = expect(request).rejects.toBeDefined();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  controller.abort();
  pending.resolve({ data: { accessToken: "renewed-token" } });
  await failed;
  expect(adapter).toHaveBeenCalledTimes(1);
});

it.each(["implicit", "current-bearer"])(
  "blocks an %s request while login is replacing the active session",
  async (scenario) => {
    tokenStore.invalidate();
    const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => response(config));
    await expect(
      axiosAuth.put(
        "/ventas/a",
        {},
        {
          adapter,
          headers:
            scenario === "current-bearer" ? { Authorization: "Bearer expired-token" } : undefined,
        },
      ),
    ).rejects.toMatchObject({ code: "ERR_CANCELED" });
    expect(adapter).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  },
);

it("keeps an explicit different bearer intact during a session transition", async () => {
  tokenStore.invalidate();
  const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => response(config));
  await axiosAuth.get("/ventas/a", {
    adapter,
    headers: { Authorization: "Bearer explicit-other-token" },
  });
  expect(adapter.mock.calls[0][0].headers.get("Authorization")).toBe("Bearer explicit-other-token");
});
