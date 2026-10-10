import { type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { tokenStore } from "@/lib/tokenStore";
import { approveAdminApplication, rejectAdminApplication } from "../../services/decide-admin-application";
import { registerReferral } from "../../services/register-referral";
import partnersMutationsClient from "../partners-mutations.client";

jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.review.invalid/v1/partners" },
}));

const TOKEN_A = "fixture.session.a";
const TOKEN_B = "fixture.session.b";
const APPLICATION_A = "11111111-1111-4111-8111-111111111111";
const originalMutationAdapter = partnersMutationsClient.defaults.adapter;
const originalAuthAdapter = axiosAuth.defaults.adapter;
const mutationsInterceptors: number[] = [];
const authInterceptors: number[] = [];

function signal() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => { resolve = complete; });
  return { promise, resolve };
}

afterEach(() => {
  mutationsInterceptors.splice(0).forEach((id) => partnersMutationsClient.interceptors.request.eject(id));
  authInterceptors.splice(0).forEach((id) => axiosAuth.interceptors.request.eject(id));
  partnersMutationsClient.defaults.adapter = originalMutationAdapter;
  axiosAuth.defaults.adapter = originalAuthAdapter;
  tokenStore.set(null);
});

it.each([
  {
    name: "register referral",
    send: (accessToken: string) => registerReferral({
      values: { businessName: "Fixture business A", email: "referral-a@review.invalid", phone: "" },
      idempotencyKey: "fixture-register-a",
    }, accessToken),
    body: { businessName: "Fixture business A", email: "referral-a@review.invalid" },
    url: /\/me\/referrals$/,
    data: { id: APPLICATION_A, origin: "MANUAL", state: "UNDER_REVIEW", capturedAt: "2026-10-08T12:00:00Z" },
  },
  {
    name: "approve application",
    send: (accessToken: string) => approveAdminApplication({
      applicationId: APPLICATION_A, reason: "Fixture decision A", idempotencyKey: "fixture-approve-a",
    }, accessToken),
    body: { reason: "Fixture decision A" },
    url: /\/approve$/,
    data: { applicationId: APPLICATION_A, partnerId: APPLICATION_A, status: "ACTIVE", code: "FIXTUREA" },
  },
  {
    name: "reject application",
    send: (accessToken: string) => rejectAdminApplication({
      applicationId: APPLICATION_A, reason: "Fixture decision A", idempotencyKey: "fixture-reject-a",
    }, accessToken),
    body: { reason: "Fixture decision A" },
    url: /\/reject$/,
    data: { applicationId: APPLICATION_A, status: "REJECTED" },
  },
])("$name pins A's bearer when the session changes before HTTP dispatch", async (testCase) => {
  const entered = signal();
  const release = signal();
  const requests: InternalAxiosRequestConfig[] = [];
  const pause = async (config: InternalAxiosRequestConfig) => {
    entered.resolve();
    await release.promise;
    return config;
  };
  mutationsInterceptors.push(partnersMutationsClient.interceptors.request.use(pause));
  // Also pause the old mutable client so reverting to it reproduces Bearer B.
  authInterceptors.push(axiosAuth.interceptors.request.use(pause));
  const adapter: AxiosAdapter = async (config) => {
    requests.push(config);
    return { data: testCase.data, status: 200, statusText: "OK", headers: {}, config };
  };
  partnersMutationsClient.defaults.adapter = adapter;
  axiosAuth.defaults.adapter = adapter;

  tokenStore.set(TOKEN_A);
  expect(tokenStore.get()).toBe(TOKEN_A);
  const request = testCase.send(TOKEN_A);
  await entered.promise;
  tokenStore.set(TOKEN_B);
  release.resolve();
  await request;

  expect(requests).toHaveLength(1);
  expect(requests[0].url).toMatch(testCase.url);
  expect(requests[0].headers.Authorization).toBe(`Bearer ${TOKEN_A}`);
  expect(requests[0].headers.Authorization).not.toBe(`Bearer ${TOKEN_B}`);
  expect(JSON.parse(requests[0].data as string)).toEqual(testCase.body);
});
