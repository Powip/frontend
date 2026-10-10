import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import axios, { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import React from "react";
import { toast } from "sonner";
import AuthGuard from "@/components/auth/AuthGuard";
import QueryProvider from "@/components/providers/QueryProvider";
import { PartnerPortalGate } from "@/app/partners/_components/partner-portal-gate";
import { useCurrentPartner } from "@/features/partners/context/current-partner.context";
import { useAdminApplications } from "@/features/partners/hooks/use-admin-applications";
import { useRecentReferrals } from "@/features/partners/hooks/use-recent-referrals";
import { useReferrals } from "@/features/partners/hooks/use-referrals";
import { useRegisterReferral } from "@/features/partners/hooks/use-register-referral";
import { partnersKeys } from "@/features/partners/keys/partners.keys";
import partnersMutationsClient from "@/features/partners/api/partners-mutations.client";
import axiosAuth from "@/lib/axiosAuth";
import { tokenStore } from "@/lib/tokenStore";
import { AuthProvider, useAuth } from "../AuthContext";

let mockPathname = "/partners/referidos";

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@tanstack/react-query-devtools", () => ({ ReactQueryDevtools: () => null }));
jest.mock("@/services/companyService", () => ({
  fetchUserCompany: jest.fn(async () => null),
  fetchCompanyById: jest.fn(async () => null),
}));
jest.mock("@/services/fetchUserSubscription", () => ({
  fetchUserSubscription: jest.fn(async () => null),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const timestamp = "2026-10-08T12:00:00Z";

function token(id: string, letter: string) {
  const payload = {
    id,
    email: `partner-${letter.toLowerCase()}@review.invalid`,
    role: "ADMIN",
    permissions: ["PARTNERS_VIEW"],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return `${btoa(JSON.stringify({ alg: "none" }))}.${btoa(JSON.stringify(payload))}.fixture`;
}

const TOKEN_A = token(USER_A, "A");
const TOKEN_B = token(USER_B, "B");

function letterFor(bearer: string) {
  return bearer === `Bearer ${TOKEN_A}` ? "A" : "B";
}

function profile(letter: string, permissions = ["REFERRALS_READ", "REFERRALS_CREATE"]) {
  return {
    id: letter === "A" ? USER_A : USER_B,
    status: "ACTIVE",
    displayName: `Fixture Partner ${letter}`,
    country: "PE",
    currency: "PEN",
    referralLink: `https://review.invalid/?ref=FIXTURE${letter}`,
    referralCode: `FIXTURE${letter}`,
    permissions,
  };
}

function referrals(letter: string) {
  return {
    items: [{
      id: letter === "A" ? USER_A : USER_B,
      businessLabel: `Referral ${letter}`,
      origin: "MANUAL",
      state: "UNDER_REVIEW",
      capturedAt: timestamp,
    }],
    nextCursor: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function response(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { data, status: 200, statusText: "OK", headers: {}, config };
}

const fixtureConfig: InternalAxiosRequestConfig = { headers: new AxiosHeaders() };

let currentAuth: ReturnType<typeof useAuth>;
let currentMutation: ReturnType<typeof useRegisterReferral>;
let queryClient: QueryClient;
let loadProfile: (bearer: string, config: InternalAxiosRequestConfig) => unknown;
let loadReferrals: (bearer: string) => unknown;
let mutationResponse: unknown;
const requests: { url: string; bearer: string; method: string }[] = [];
const renderedProfiles: { userId: string | undefined; name: string }[] = [];
const originalAdapter = axiosAuth.defaults.adapter;
const originalMutationAdapter = partnersMutationsClient.defaults.adapter;

function SessionProbe() {
  currentAuth = useAuth();
  currentMutation = useRegisterReferral();
  queryClient = useQueryClient();
  return <p data-testid="session">{currentAuth.auth?.user.id ?? "anonymous"}</p>;
}

function PartnerContent() {
  const partner = useCurrentPartner();
  const { auth } = useAuth();
  const referralsQuery = useReferrals();
  const recentQuery = useRecentReferrals(5);
  renderedProfiles.push({ userId: auth?.user.id, name: partner.displayName });
  return (
    <>
      <p>{partner.displayName}</p>
      <p>{referralsQuery.data?.pages[0].items[0]?.businessName ?? "Loading referrals"}</p>
      <p>{recentQuery.data?.[0]?.businessName ?? "Loading recent"}</p>
    </>
  );
}

function AdminContent() {
  const applicationsQuery = useAdminApplications("APPLIED");
  return <p>{applicationsQuery.data?.pages[0].items[0]?.displayName ?? "Loading applications"}</p>;
}

function renderSession(admin = false) {
  return render(
    <QueryProvider>
      <AuthProvider>
        <SessionProbe />
        <AuthGuard>
          <PartnerPortalGate>{admin ? <AdminContent /> : <PartnerContent />}</PartnerPortalGate>
        </AuthGuard>
      </AuthProvider>
    </QueryProvider>,
  );
}

async function login(accessToken: string) {
  await act(async () => { await currentAuth.login({ accessToken }); });
}

beforeEach(() => {
  mockPathname = "/partners/referidos";
  requests.length = 0;
  renderedProfiles.length = 0;
  tokenStore.set(null);
  loadProfile = (bearer) => profile(letterFor(bearer));
  loadReferrals = (bearer) => referrals(letterFor(bearer));
  mutationResponse = { id: USER_A, origin: "MANUAL", state: "UNDER_REVIEW", capturedAt: timestamp };
  jest.spyOn(axios, "post").mockRejectedValue(new Error("No fixture session"));
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.mocked(toast.success).mockReset();
  jest.mocked(toast.error).mockReset();
  const adapter = async (config: InternalAxiosRequestConfig) => {
    const url = config.url ?? "";
    const bearer = String(config.headers.Authorization ?? "");
    const method = config.method ?? "get";
    requests.push({ url, bearer, method });
    if (url.endsWith("/me")) return response(config, await loadProfile(bearer, config));
    if (url.endsWith("/me/referrals")) {
      return response(config, await (method === "post" ? mutationResponse : loadReferrals(bearer)));
    }
    if (url.endsWith("/admin/applications")) {
      const letter = letterFor(bearer);
      return response(config, {
        items: [{
          id: letter === "A" ? USER_A : USER_B,
          applicationReference: `FIXTURE-${letter}`,
          email: `application-${letter.toLowerCase()}@review.invalid`,
          displayName: `Application ${letter}`,
          country: "PE",
          status: "APPLIED",
          appliedAt: timestamp,
        }],
        nextCursor: null,
      });
    }
    throw new Error(`Unexpected fixture request: ${url}`);
  };
  axiosAuth.defaults.adapter = adapter;
  partnersMutationsClient.defaults.adapter = adapter;
});

afterEach(() => {
  cleanup();
  queryClient?.clear();
  axiosAuth.defaults.adapter = originalAdapter;
  partnersMutationsClient.defaults.adapter = originalMutationAdapter;
  tokenStore.set(null);
  jest.restoreAllMocks();
});

it("switches A → B without rendering A's profile/referrals under B, using the real provider defaults", async () => {
  renderSession();
  await waitFor(() => expect(currentAuth.loading).toBe(false));
  await login(TOKEN_A);
  await waitFor(() => expect(screen.getAllByText("Referral A")).toHaveLength(2));
  queryClient.setQueryData(partnersKeys.payoutSettings(), { accountNumber: "fixture-only" });

  const pendingB = deferred<ReturnType<typeof profile>>();
  loadProfile = (bearer) => letterFor(bearer) === "B" ? pendingB.promise : profile("A");
  await login(TOKEN_B);

  expect(screen.getByTestId("session")).toHaveTextContent(USER_B);
  expect(screen.queryByText("Fixture Partner A")).not.toBeInTheDocument();
  expect(screen.queryByText("Referral A")).not.toBeInTheDocument();
  expect(queryClient.getQueryData(partnersKeys.me(USER_A))).toBeUndefined();
  expect(queryClient.getQueryData(partnersKeys.payoutSettings())).toBeUndefined();
  expect(screen.getByText(/verificando tu cuenta de partner/i)).toBeInTheDocument();

  await act(async () => { pendingB.resolve(profile("B")); });
  await waitFor(() => expect(screen.getAllByText("Referral B")).toHaveLength(2));
  expect(renderedProfiles.filter((entry) => entry.userId === USER_B).every(
    (entry) => entry.name === "Fixture Partner B",
  )).toBe(true);
  expect(requests.filter((request) => request.bearer === `Bearer ${TOKEN_B}`)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ url: expect.stringMatching(/\/me$/) }),
      expect.objectContaining({ url: expect.stringMatching(/\/me\/referrals$/) }),
    ]),
  );
  expect(queryClient.getQueryData(partnersKeys.me(USER_B))).toEqual(
    expect.objectContaining({ kind: "partner", profile: expect.objectContaining({ id: USER_B }) }),
  );
});

it("a new non-partner is blocked rather than inheriting A's cached access", async () => {
  renderSession();
  await waitFor(() => expect(currentAuth.loading).toBe(false));
  await login(TOKEN_A);
  await waitFor(() => expect(screen.getByText("Fixture Partner A")).toBeInTheDocument());
  loadProfile = (bearer, config) => {
    if (letterFor(bearer) === "B") {
      throw new AxiosError("No partner", "ERR_BAD_REQUEST", config, undefined, {
        ...response(config, { code: "PARTNER_NOT_FOUND" }), status: 404,
      });
    }
    return profile("A");
  };

  await login(TOKEN_B);
  await waitFor(() => expect(screen.getByText(/esta cuenta no tiene un perfil de partner/i)).toBeInTheDocument());
  expect(screen.queryByText("Fixture Partner A")).not.toBeInTheDocument();
  expect(requests.some((request) => request.bearer === `Bearer ${TOKEN_B}` && request.url.endsWith("/me/referrals"))).toBe(false);
});

it.each([401, 503])("a live /me %i hides cached private content, then a healthy retry restores it without changing Auth", async (status) => {
  renderSession();
  await waitFor(() => expect(currentAuth.loading).toBe(false));
  await login(TOKEN_A);
  await waitFor(() => expect(screen.getAllByText("Referral A")).toHaveLength(2));
  const previousIdentity = queryClient.getQueryData(partnersKeys.me(USER_A));
  loadProfile = (_bearer, config) => {
    throw new AxiosError("Synthetic failed authority check", "ERR_BAD_REQUEST", config, undefined, {
      ...response(config, { code: status === 401 ? "UNAUTHORIZED" : "UNAVAILABLE" }), status,
    });
  };

  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: partnersKeys.me(USER_A) });
  });

  const errorMessage = status === 401
    ? /no pudimos validar tu sesión para el programa de partners/i
    : /no pudimos verificar tu cuenta de partner/i;
  await waitFor(() => expect(screen.getByText(errorMessage)).toBeInTheDocument());
  expect(queryClient.getQueryData(partnersKeys.me(USER_A))).toEqual(previousIdentity);
  expect(queryClient.getQueryState(partnersKeys.me(USER_A))?.error).toBeInstanceOf(AxiosError);
  expect(screen.queryByText("Fixture Partner A")).not.toBeInTheDocument();
  expect(screen.queryByText("Referral A")).not.toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: /secciones de partners/i })).not.toBeInTheDocument();
  expect(tokenStore.get()).toBe(TOKEN_A);
  expect(currentAuth.auth?.user.id).toBe(USER_A);

  loadProfile = () => profile("A");
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: partnersKeys.me(USER_A) });
  });
  await waitFor(() => expect(screen.getAllByText("Referral A")).toHaveLength(2));
  expect(screen.getByText("Fixture Partner A")).toBeInTheDocument();
  expect(queryClient.getQueryState(partnersKeys.me(USER_A))?.error).toBeNull();
  expect(tokenStore.get()).toBe(TOKEN_A);
  expect(currentAuth.auth?.user.id).toBe(USER_A);
});

it("logout clears immediately and an old in-flight referral response cannot repopulate A's cache", async () => {
  const pendingA = deferred<ReturnType<typeof referrals>>();
  const pendingLogout = deferred<AxiosResponse>();
  loadReferrals = (bearer) => letterFor(bearer) === "A" ? pendingA.promise : referrals("B");
  renderSession();
  await waitFor(() => expect(currentAuth.loading).toBe(false));
  await login(TOKEN_A);
  await waitFor(() => expect(requests.filter((request) => request.url.endsWith("/me/referrals"))).toHaveLength(2));
  jest.mocked(axios.post).mockImplementation(() => pendingLogout.promise);

  let logoutDone!: Promise<void>;
  act(() => { logoutDone = currentAuth.logout() as unknown as Promise<void>; });
  expect(screen.getByTestId("session")).toHaveTextContent("anonymous");
  expect(tokenStore.get()).toBeNull();
  expect(queryClient.getQueryCache().findAll({ queryKey: partnersKeys.all })).toHaveLength(0);

  await login(TOKEN_B);
  await waitFor(() => expect(screen.getAllByText("Referral B")).toHaveLength(2));
  await act(async () => {
    pendingA.resolve(referrals("A"));
    pendingLogout.resolve(response(fixtureConfig, {}));
    await logoutDone;
  });

  expect(screen.getByTestId("session")).toHaveTextContent(USER_B);
  expect(screen.queryByText("Referral A")).not.toBeInTheDocument();
  expect(queryClient.getQueryCache().findAll({ queryKey: partnersKeys.user(USER_A) })).toHaveLength(0);
});

it("a late initial refresh cannot restore A after logout and login B", async () => {
  const pendingRefresh = deferred<AxiosResponse>();
  jest.mocked(axios.post).mockImplementation((url) => String(url).endsWith("/refresh")
    ? pendingRefresh.promise : Promise.resolve(response(fixtureConfig, {})));
  renderSession();
  act(() => { currentAuth.logout(); });
  await login(TOKEN_B);
  await act(async () => { pendingRefresh.resolve(response(fixtureConfig, { accessToken: TOKEN_A })); });

  await waitFor(() => expect(screen.getAllByText("Referral B")).toHaveLength(2));
  expect(currentAuth.auth?.user.id).toBe(USER_B);
  expect(tokenStore.get()).toBe(TOKEN_B);
  expect(requests.every((request) => request.bearer === `Bearer ${TOKEN_B}`)).toBe(true);
});

it("blocked preference cleanup still logs out on the server and clears auth, bearer and Partners cache", async () => {
  renderSession();
  await waitFor(() => expect(currentAuth.loading).toBe(false));
  await login(TOKEN_A);
  await waitFor(() => expect(screen.getAllByText("Referral A")).toHaveLength(2));
  jest.mocked(axios.post).mockResolvedValue(response(fixtureConfig, {}));
  jest.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
    throw new Error("Fixture storage blocked");
  });

  await act(async () => { await currentAuth.logout(); });

  expect(axios.post).toHaveBeenCalledWith(
    expect.stringMatching(/\/api\/v1\/auth\/logout$/),
    {},
    { withCredentials: true },
  );
  expect(currentAuth.auth).toBeNull();
  expect(tokenStore.get()).toBeNull();
  expect(screen.getByTestId("session")).toHaveTextContent("anonymous");
  expect(queryClient.getQueryCache().findAll({ queryKey: partnersKeys.all })).toHaveLength(0);
});

it("staff B gets its own applications rather than A's fresh administration cache", async () => {
  mockPathname = "/partners/admin/solicitudes";
  renderSession(true);
  await waitFor(() => expect(currentAuth.loading).toBe(false));
  await login(TOKEN_A);
  await waitFor(() => expect(screen.getByText("Application A")).toBeInTheDocument());
  await login(TOKEN_B);
  expect(screen.queryByText("Application A")).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("Application B")).toBeInTheDocument());
  expect(requests.filter((request) => request.url.endsWith("/admin/applications")).map(
    (request) => request.bearer,
  )).toEqual([`Bearer ${TOKEN_A}`, `Bearer ${TOKEN_B}`]);
});

it("a late A mutation exposes no referral toast or invalidation while B is logged in", async () => {
  const pendingMutation = deferred<unknown>();
  mutationResponse = pendingMutation.promise;
  renderSession();
  await waitFor(() => expect(currentAuth.loading).toBe(false));
  await login(TOKEN_A);
  await waitFor(() => expect(screen.getByText("Fixture Partner A")).toBeInTheDocument());
  act(() => {
    currentMutation.mutate({
      values: { businessName: "Private fixture A", email: "referral-a@review.invalid", phone: "" },
      idempotencyKey: "fixture-key-a",
    });
  });
  await waitFor(() => expect(requests.some((request) => request.method === "post")).toBe(true));
  await login(TOKEN_B);
  await waitFor(() => expect(screen.getAllByText("Referral B")).toHaveLength(2));
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  await act(async () => {
    pendingMutation.resolve({ id: USER_A, origin: "MANUAL", state: "UNDER_REVIEW", capturedAt: timestamp });
  });

  expect(toast.success).not.toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  expect(queryClient.getMutationCache().findAll({ mutationKey: partnersKeys.user(USER_A) })).toHaveLength(0);
});

it("an action queued before logout cannot dispatch later using another session's bearer", async () => {
  renderSession();
  await waitFor(() => expect(currentAuth.loading).toBe(false));
  await login(TOKEN_A);
  await waitFor(() => expect(screen.getByText("Fixture Partner A")).toBeInTheDocument());
  jest.mocked(axios.post).mockResolvedValue(response(fixtureConfig, {}));
  let mutationDone!: Promise<unknown>;
  act(() => {
    mutationDone = currentMutation.mutateAsync({
      values: { businessName: "Private fixture A", email: "referral-a@review.invalid", phone: "" },
      idempotencyKey: "fixture-key-a",
    });
    currentAuth.logout();
  });
  await expect(mutationDone).rejects.toThrow(/la sesión de partners cambió/i);

  expect(requests.some((request) => request.method === "post")).toBe(false);
  expect(toast.success).not.toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
});
