import { act, cleanup, render, waitFor } from "@testing-library/react";
import axios from "axios";
import QueryProvider from "@/components/providers/QueryProvider";
import { tokenStore } from "@/lib/tokenStore";
import { fetchCompanyById, fetchUserCompany } from "@/services/companyService";
import { fetchUserSubscription } from "@/services/fetchUserSubscription";
import { fetchSubscriptionAccess } from "@/services/subscriptionAccess";
import { AuthProvider, useAuth } from "../AuthContext";

jest.mock("@tanstack/react-query-devtools", () => ({ ReactQueryDevtools: () => null }));
jest.mock("@/services/companyService", () => ({
  fetchUserCompany: jest.fn(),
  fetchCompanyById: jest.fn(),
}));
jest.mock("@/services/fetchUserSubscription", () => ({ fetchUserSubscription: jest.fn() }));
jest.mock("@/services/subscriptionAccess", () => ({ fetchSubscriptionAccess: jest.fn() }));

const USER_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_A = "33333333-3333-4333-8333-333333333333";
const aviso = { state: "AVISO", deadline: "2026-10-23", firstChargeDate: null, owner: true } as const;
const bloqueado = { state: "BLOQUEADO", deadline: "2026-10-23", firstChargeDate: null, owner: true } as const;

function token(id: string, companyId?: string) {
  const payload = {
    id,
    email: "access@review.invalid",
    role: "ADMINISTRADOR",
    permissions: [],
    companyId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return `${btoa(JSON.stringify({ alg: "none" }))}.${btoa(JSON.stringify(payload))}.fixture`;
}

let currentAuth: ReturnType<typeof useAuth>;

function SessionProbe() {
  currentAuth = useAuth();
  return null;
}

async function renderSession() {
  render(<QueryProvider><AuthProvider><SessionProbe /></AuthProvider></QueryProvider>);
  await waitFor(() => expect(currentAuth.loading).toBe(false));
}

beforeEach(() => {
  tokenStore.set(null);
  localStorage.clear();
  jest.mocked(fetchUserCompany).mockReset().mockResolvedValue(null);
  jest.mocked(fetchCompanyById).mockReset().mockResolvedValue(null);
  jest.mocked(fetchUserSubscription).mockReset().mockResolvedValue(null);
  jest.mocked(fetchSubscriptionAccess).mockReset().mockResolvedValue(null);
  jest.spyOn(axios, "post").mockRejectedValue(new Error("No fixture session"));
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  tokenStore.set(null);
  localStorage.clear();
  jest.restoreAllMocks();
});

it("el login deja en la sesión el estado de acceso de la empresa", async () => {
  jest.mocked(fetchSubscriptionAccess).mockResolvedValue(aviso);
  const accessToken = token(USER_A, COMPANY_A);
  await renderSession();

  await act(async () => { await currentAuth.login({ accessToken }); });

  expect(currentAuth.auth?.access).toEqual(aviso);
  expect(fetchSubscriptionAccess).toHaveBeenCalledWith(accessToken);
});

it("la sesión recuperada por cookie también trae el estado de acceso", async () => {
  const accessToken = token(USER_A, COMPANY_A);
  jest.mocked(axios.post).mockResolvedValue({ data: { accessToken } });
  jest.mocked(fetchSubscriptionAccess).mockResolvedValue(bloqueado);

  await renderSession();

  await waitFor(() => expect(currentAuth.auth?.access).toEqual(bloqueado));
  expect(fetchSubscriptionAccess).toHaveBeenCalledWith(accessToken);
});

it("si no hay dato de acceso la sesión se arma igual, con access null", async () => {
  await renderSession();

  await act(async () => { await currentAuth.login({ accessToken: token(USER_A, COMPANY_A) }); });

  expect(currentAuth.auth?.user.id).toBe(USER_A);
  expect(currentAuth.auth?.access).toBeNull();
});

it("refreshSubscription vuelve a pedir el acceso y lo reemplaza", async () => {
  jest.mocked(fetchSubscriptionAccess).mockResolvedValueOnce(aviso);
  const accessToken = token(USER_A, COMPANY_A);
  await renderSession();
  await act(async () => { await currentAuth.login({ accessToken }); });
  jest.mocked(fetchSubscriptionAccess).mockResolvedValueOnce({ ...aviso, state: "OK", deadline: null });

  await act(async () => { await currentAuth.refreshSubscription(); });

  expect(currentAuth.auth?.access).toEqual({ ...aviso, state: "OK", deadline: null });
  expect(fetchSubscriptionAccess).toHaveBeenCalledTimes(2);
});
