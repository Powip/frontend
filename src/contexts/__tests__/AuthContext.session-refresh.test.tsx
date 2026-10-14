import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import React from "react";
import QueryProvider from "@/components/providers/QueryProvider";
import { partnersKeys } from "@/features/partners/keys/partners.keys";
import { tokenStore } from "@/lib/tokenStore";
import { fetchCompanyById, fetchUserCompany } from "@/services/companyService";
import { fetchUserSubscription } from "@/services/fetchUserSubscription";
import { AuthProvider, useAuth } from "../AuthContext";

jest.mock("@tanstack/react-query-devtools", () => ({ ReactQueryDevtools: () => null }));
jest.mock("@/services/companyService", () => ({
  fetchUserCompany: jest.fn(),
  fetchCompanyById: jest.fn(),
}));
jest.mock("@/services/fetchUserSubscription", () => ({ fetchUserSubscription: jest.fn() }));

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const COMPANY_A = "33333333-3333-4333-8333-333333333333";
const company = { id: COMPANY_A, name: "Fixture Company A", userId: USER_A, stores: [] };
const subscriptionA = {
  id: "44444444-4444-4444-8444-444444444444",
  status: "ACTIVE",
  plan: { id: "55555555-5555-4555-8555-555555555555", name: "Fixture Plan A" },
};
const subscriptionB = { ...subscriptionA, id: "66666666-6666-4666-8666-666666666666" };

function token(id: string, companyId?: string, role = "USER") {
  const payload = {
    id,
    email: `session-${id === USER_A ? "a" : "b"}@review.invalid`,
    role,
    permissions: role === "ADMINISTRADOR" ? ["FIXTURE_ADMIN_PERMISSION"] : [],
    companyId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return `${btoa(JSON.stringify({ alg: "none" }))}.${btoa(JSON.stringify(payload))}.fixture`;
}

const TOKEN_A = token(USER_A);
const TOKEN_B = token(USER_B);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

let currentAuth: ReturnType<typeof useAuth>;
let queryClient: QueryClient;
const renderedSessions: { accessToken: string | null; bearer: string | null }[] = [];

function SessionProbe() {
  currentAuth = useAuth();
  queryClient = useQueryClient();
  renderedSessions.push({
    accessToken: currentAuth.auth?.accessToken ?? null,
    bearer: tokenStore.get(),
  });
  return <p data-testid="session">{currentAuth.auth?.user.id ?? "anonymous"}</p>;
}

async function renderSession() {
  render(<QueryProvider><AuthProvider><SessionProbe /></AuthProvider></QueryProvider>);
  await waitFor(() => expect(currentAuth.loading).toBe(false));
}

async function login(accessToken: string) {
  await act(async () => { await currentAuth.login({ accessToken }); });
}

beforeEach(() => {
  tokenStore.set(null);
  localStorage.clear();
  renderedSessions.length = 0;
  jest.mocked(fetchUserCompany).mockReset().mockResolvedValue(null);
  jest.mocked(fetchCompanyById).mockReset().mockResolvedValue(null);
  jest.mocked(fetchUserSubscription).mockReset().mockResolvedValue(null);
  jest.spyOn(axios, "post").mockRejectedValue(new Error("No fixture session"));
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  queryClient?.clear();
  tokenStore.set(null);
  localStorage.clear();
  jest.restoreAllMocks();
});

it.each([COMPANY_A, undefined])("login exposes the JWT companyId or null: %s", async (companyId) => {
  await renderSession();
  await login(token(USER_A, companyId));
  expect(currentAuth.auth?.user.companyId).toBe(companyId ?? null);
});

it.each([COMPANY_A, undefined])("public refresh reloads JWT, company and subscription with a synchronized bearer: %s", async (companyId) => {
  await renderSession();
  await login(TOKEN_A);
  const refreshedToken = token(USER_A, companyId, "ADMINISTRADOR");
  jest.mocked(axios.post).mockResolvedValueOnce({ data: { accessToken: refreshedToken } });
  jest.mocked(fetchCompanyById).mockResolvedValueOnce(company);
  jest.mocked(fetchUserSubscription).mockResolvedValueOnce(subscriptionA);

  await act(async () => { expect(await currentAuth.refreshSession()).toBe(true); });

  expect(axios.post).toHaveBeenLastCalledWith(
    "/api/auth/refresh", {}, { withCredentials: true, signal: expect.any(AbortSignal) },
  );
  expect(currentAuth.auth).toEqual(expect.objectContaining({
    accessToken: refreshedToken,
    user: expect.objectContaining({ id: USER_A, role: "ADMINISTRADOR", companyId: companyId ?? null }),
    company: companyId ? company : null,
    subscription: subscriptionA,
  }));
  expect(fetchUserCompany).toHaveBeenLastCalledWith(USER_A, refreshedToken);
  expect(fetchUserSubscription).toHaveBeenLastCalledWith(USER_A, refreshedToken);
  if (companyId) expect(fetchCompanyById).toHaveBeenCalledWith(companyId, refreshedToken);
  else expect(fetchCompanyById).not.toHaveBeenCalled();
  expect(currentAuth.hasPermission("FIXTURE_ADMIN_PERMISSION")).toBe(true);
  expect(tokenStore.get()).toBe(refreshedToken);
  expect(renderedSessions.every((entry) => entry.accessToken === entry.bearer)).toBe(true);
});

it.each(["network", "invalid-token", "missing-token"])("a failed public refresh preserves the current auth and returns false: %s", async (failure) => {
  await renderSession();
  await login(TOKEN_A);
  const previousAuth = currentAuth.auth;
  if (failure === "network") jest.mocked(axios.post).mockRejectedValueOnce(new Error("Fixture refresh failed"));
  else jest.mocked(axios.post).mockResolvedValueOnce({
    data: failure === "invalid-token" ? { accessToken: "invalid-fixture-token" } : {},
  });

  await act(async () => { expect(await currentAuth.refreshSession()).toBe(false); });

  expect(currentAuth.auth).toBe(previousAuth);
  expect(tokenStore.get()).toBe(TOKEN_A);
});

it("concurrent refresh callers share one request and both receive the valid session result", async () => {
  await renderSession();
  await login(TOKEN_A);
  const refreshedToken = token(USER_A, undefined, "ADMINISTRADOR");
  const pendingRefresh = deferred<{ data: { accessToken: string } }>();
  jest.mocked(axios.post).mockClear().mockImplementationOnce(() => pendingRefresh.promise);
  jest.mocked(fetchUserSubscription).mockResolvedValueOnce(subscriptionA);
  let first!: Promise<boolean>;
  let second!: Promise<boolean>;

  act(() => {
    first = currentAuth.refreshSession();
    second = currentAuth.refreshSession();
  });

  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(first).toBe(second);
  await act(async () => {
    pendingRefresh.resolve({ data: { accessToken: refreshedToken } });
    expect(await Promise.all([first, second])).toEqual([true, true]);
  });
  expect(currentAuth.auth?.subscription).toEqual(subscriptionA);
  expect(currentAuth.auth?.user.role).toBe("ADMINISTRADOR");
  expect(tokenStore.get()).toBe(refreshedToken);
});

it("a failed shared refresh can be retried without retaining its rejected session result", async () => {
  await renderSession();
  await login(TOKEN_A);
  jest.mocked(axios.post).mockClear()
    .mockRejectedValueOnce(new Error("Fixture missing session cookie"))
    .mockResolvedValueOnce({ data: { accessToken: TOKEN_A } });

  await act(async () => {
    expect(await Promise.all([currentAuth.refreshSession(), currentAuth.refreshSession()]))
      .toEqual([false, false]);
  });
  await act(async () => { expect(await currentAuth.refreshSession()).toBe(true); });
  expect(axios.post).toHaveBeenCalledTimes(2);
});

it("a new login can refresh independently of a retained request from the previous session", async () => {
  await renderSession();
  await login(TOKEN_A);
  const pendingRefresh = deferred<{ data: { accessToken: string } }>();
  jest.mocked(axios.post).mockClear().mockImplementationOnce(() => pendingRefresh.promise)
    .mockResolvedValueOnce({ data: { accessToken: TOKEN_B } });
  let oldRefresh!: Promise<boolean>;
  act(() => { oldRefresh = currentAuth.refreshSession(); });
  const refreshSignal = jest.mocked(axios.post).mock.calls[0][2]?.signal;
  expect(refreshSignal?.aborted).toBe(false);
  await login(TOKEN_B);
  expect(refreshSignal?.aborted).toBe(true);
  await act(async () => { expect(await currentAuth.refreshSession()).toBe(true); });
  await act(async () => {
    pendingRefresh.resolve({ data: { accessToken: TOKEN_A } });
    expect(await oldRefresh).toBe(false);
  });
  expect(axios.post).toHaveBeenCalledTimes(2);
  expect(currentAuth.auth?.user.id).toBe(USER_B);
  expect(tokenStore.get()).toBe(TOKEN_B);
});

it("blocked optional preferences do not invalidate login or a successfully renewed session", async () => {
  await renderSession();
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Fixture storage blocked"); });
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Fixture storage blocked"); });
  jest.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("Fixture storage blocked"); });
  const companyWithStore = { ...company, stores: [{ id: "fixture-store", name: "Fixture Store" }] };
  jest.mocked(fetchUserCompany).mockResolvedValue(companyWithStore);
  jest.spyOn(axios, "get").mockResolvedValue({ data: [] });
  const refreshedToken = token(USER_A, COMPANY_A, "ADMINISTRADOR");
  let loggedIn!: Awaited<ReturnType<typeof currentAuth.login>>;
  await act(async () => { loggedIn = await currentAuth.login({ accessToken: TOKEN_A }); });
  expect(loggedIn?.accessToken).toBe(TOKEN_A);
  jest.mocked(axios.post).mockResolvedValueOnce({ data: { accessToken: refreshedToken } });
  jest.mocked(fetchUserSubscription).mockResolvedValueOnce(subscriptionA);

  await act(async () => { expect(await currentAuth.refreshSession()).toBe(true); });

  expect(currentAuth.selectedStoreId).toBe("fixture-store");
  expect(currentAuth.auth?.subscription).toEqual(subscriptionA);
  expect(tokenStore.get()).toBe(refreshedToken);
});

it("logout captures the current bearer before clearing the session and sends it to the same-origin proxy", async () => {
  await renderSession();
  await login(TOKEN_A);
  const retainedLogout = currentAuth.logout;
  const refreshedToken = token(USER_A, undefined, "ADMINISTRADOR");
  jest.mocked(axios.post).mockResolvedValueOnce({ data: { accessToken: refreshedToken } });
  await act(async () => { await currentAuth.refreshSession(); });
  jest.mocked(axios.post).mockImplementationOnce(async () => {
    expect(tokenStore.get()).toBeNull();
    return { data: {} };
  });

  await act(async () => { await retainedLogout(); });

  expect(axios.post).toHaveBeenLastCalledWith("/api/auth/logout", {}, {
    withCredentials: true,
    headers: { Authorization: `Bearer ${refreshedToken}` },
  });
  expect(currentAuth.auth).toBeNull();
});

it("a late public refresh cannot restore A or remove B's Partners cache after logout and login B", async () => {
  await renderSession();
  await login(TOKEN_A);
  const pendingRefresh = deferred<{ data: { accessToken: string } }>();
  jest.mocked(axios.post).mockResolvedValue({ data: {} }).mockImplementationOnce(() => pendingRefresh.promise);
  let refreshing!: Promise<boolean>;
  act(() => { refreshing = currentAuth.refreshSession(); });
  const refreshSignal = jest.mocked(axios.post).mock.calls.at(-1)?.[2]?.signal;
  expect(refreshSignal?.aborted).toBe(false);

  await act(async () => { await currentAuth.logout(); });
  expect(refreshSignal?.aborted).toBe(true);
  await login(TOKEN_B);
  queryClient.setQueryData(partnersKeys.me(USER_B), { fixture: "B" });
  await act(async () => {
    pendingRefresh.resolve({ data: { accessToken: TOKEN_A } });
    expect(await refreshing).toBe(false);
  });

  expect(screen.getByTestId("session")).toHaveTextContent(USER_B);
  expect(currentAuth.auth?.accessToken).toBe(TOKEN_B);
  expect(tokenStore.get()).toBe(TOKEN_B);
  expect(queryClient.getQueryData(partnersKeys.me(USER_B))).toEqual({ fixture: "B" });
});

it("subscription refresh updates only subscription and preserves the latest company, bearer and Partners cache", async () => {
  await renderSession();
  await login(TOKEN_A);
  const pendingSubscription = deferred<typeof subscriptionA>();
  jest.mocked(fetchUserSubscription).mockImplementationOnce(() => pendingSubscription.promise);
  queryClient.setQueryData(partnersKeys.me(USER_A), { fixture: "A" });
  let refreshing!: Promise<void>;
  act(() => { refreshing = currentAuth.refreshSubscription(); });
  act(() => { currentAuth.updateCompany(company); });
  const previousAuth = currentAuth.auth;

  await act(async () => { pendingSubscription.resolve(subscriptionA); await refreshing; });

  expect(fetchUserSubscription).toHaveBeenLastCalledWith(USER_A, TOKEN_A);
  expect(currentAuth.auth).toEqual({ ...previousAuth, subscription: subscriptionA });
  expect(tokenStore.get()).toBe(TOKEN_A);
  expect(queryClient.getQueryData(partnersKeys.me(USER_A))).toEqual({ fixture: "A" });
});

it.each(["logout-login-B", "relogin-A", "refresh-A"])("a late subscription response cannot overwrite a newer session: %s", async (transition) => {
  await renderSession();
  await login(TOKEN_A);
  const pendingSubscription = deferred<typeof subscriptionA>();
  jest.mocked(fetchUserSubscription).mockImplementationOnce(() => pendingSubscription.promise);
  let refreshing!: Promise<void>;
  act(() => { refreshing = currentAuth.refreshSubscription(); });
  jest.mocked(fetchUserSubscription).mockResolvedValueOnce(subscriptionB);
  jest.mocked(axios.post).mockResolvedValue({ data: { accessToken: TOKEN_A } });

  if (transition === "logout-login-B") {
    await act(async () => { await currentAuth.logout(); });
    await login(TOKEN_B);
  } else if (transition === "relogin-A") await login(TOKEN_A);
  else await act(async () => { expect(await currentAuth.refreshSession()).toBe(true); });
  const newerAuth = currentAuth.auth;

  await act(async () => { pendingSubscription.resolve(subscriptionA); await refreshing; });

  expect(currentAuth.auth).toBe(newerAuth);
  expect(currentAuth.auth?.subscription).toEqual(subscriptionB);
  expect(tokenStore.get()).toBe(transition === "logout-login-B" ? TOKEN_B : TOKEN_A);
});

it("subscription refresh without a session does not request user data", async () => {
  await renderSession();
  await act(async () => { await currentAuth.refreshSubscription(); });
  expect(fetchUserSubscription).not.toHaveBeenCalled();
});

it("a retained A subscription callback cannot request or modify data after B logs in", async () => {
  await renderSession();
  await login(TOKEN_A);
  const retainedRefresh = currentAuth.refreshSubscription;
  await login(TOKEN_B);
  const newerAuth = currentAuth.auth;
  jest.mocked(fetchUserSubscription).mockClear();

  await act(async () => { await retainedRefresh(); });

  expect(fetchUserSubscription).not.toHaveBeenCalled();
  expect(currentAuth.auth).toBe(newerAuth);
  expect(tokenStore.get()).toBe(TOKEN_B);
});
