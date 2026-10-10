import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosError } from "axios";
import axios from "axios";
import { type ReactNode, StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdvertisingCallbackPage from "@/app/configuracion/integraciones/publicidad/callback/page";
import LoginForm from "@/components/forms/LoginForm";
import AppContainer from "@/components/layout/AppContainer";
import { AuthProvider } from "@/contexts/AuthContext";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => window.location.pathname,
}));
jest.mock("@/components/layout/Sidebar", () => ({
  Sidebar: () => <aside aria-label="Fixture sidebar">Navigation fixture</aside>,
}));
jest.mock("@/components/modals/forgotPasswortModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return {
    ...actual,
    __esModule: true,
    // LoginForm also imports the optional Partners lookup. Keep a real Axios
    // instance factory so its interceptor setup works without any HTTP calls.
    default: {
      ...actual.default,
      post: jest.fn(),
      get: jest.fn(),
      isAxiosError: jest.fn(),
    },
  };
});

const post = jest.mocked(axios.post);
const get = jest.mocked(axios.get);
const ACTOR_ID = "a1111111-1111-4111-8111-111111111111";
const COMPANY_ID = "b2222222-2222-4222-8222-222222222222";
const CODE = "fixture-one-use-meta-code";
const STATE = "s".repeat(43);
const CALLBACK_PATH = "/configuracion/integraciones/publicidad/callback";
const ADS_BASE = "https://integrations.example.test";
const CALLBACK_ENDPOINT = `${ADS_BASE}/advertising/companies/${COMPANY_ID}/meta/callback`;
const LOGIN_EMAIL = "recovery@example.test";
const LOGIN_PASSWORD = "fixture-password";

function encoded(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

const TOKEN = `${encoded({ alg: "HS256", typ: "JWT" })}.${encoded({
  id: ACTOR_ID,
  email: LOGIN_EMAIL,
  role: "ADMINISTRADOR",
  permissions: ["VIEW_FINANCES", "MANAGE_ADVERTISING_CONNECTIONS"],
  companyId: COMPANY_ID,
  exp: Math.floor(Date.now() / 1000) + 3600,
})}.fixture-signature`;

const previousEnvironment = {
  users: process.env.NEXT_PUBLIC_API_USERS,
  company: process.env.NEXT_PUBLIC_API_COMPANY,
  integrations: process.env.NEXT_PUBLIC_API_INTEGRATIONS,
};

let refreshFails = false;
let companyAvailable = true;
let callbackStatus: number | null = null;
let releaseRefresh: (() => void) | null = null;
let pendingRefresh: Promise<void> | null = null;
let storageWrites: jest.SpyInstance;
let queryClients: QueryClient[] = [];

function callbackRequests() {
  return post.mock.calls.filter(([url]) => url === CALLBACK_ENDPOINT);
}

function renderApplication(path: string, children: ReactNode = <AdvertisingCallbackPage />) {
  window.history.replaceState(null, "", path);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  queryClients.push(queryClient);
  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppContainer>{children}</AppContainer>
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  process.env.NEXT_PUBLIC_API_USERS = "https://auth.example.test/api/v1";
  process.env.NEXT_PUBLIC_API_COMPANY = "https://company.example.test";
  process.env.NEXT_PUBLIC_API_INTEGRATIONS = ADS_BASE;
  refreshFails = false;
  companyAvailable = true;
  callbackStatus = null;
  releaseRefresh = null;
  pendingRefresh = null;
  storageWrites = jest.spyOn(Storage.prototype, "setItem");
  jest
    .mocked(axios.isAxiosError)
    .mockImplementation(
      (value: unknown): value is AxiosError =>
        typeof value === "object" && value !== null && "isAxiosError" in value,
    );
  post.mockImplementation(async (url) => {
    if (url.endsWith("/api/v1/auth/refresh")) {
      if (pendingRefresh) await pendingRefresh;
      if (refreshFails) throw { isAxiosError: true, response: { status: 401 } };
      return { data: { accessToken: TOKEN } };
    }
    if (url === "https://auth.example.test/api/v1/auth/login") {
      return { data: { accessToken: TOKEN } };
    }
    if (url === CALLBACK_ENDPOINT) {
      expect(window.location.search).toBe("?provider=meta");
      expect(window.location.href).not.toContain(CODE);
      expect(window.location.href).not.toContain(STATE);
      if (callbackStatus) throw { isAxiosError: true, response: { status: callbackStatus } };
      return { data: { connected: true } };
    }
    throw new Error(`Unexpected fixture POST: ${url}`);
  });
  get.mockImplementation(async (url) => {
    if (
      url === `https://company.example.test/company/user/${ACTOR_ID}` ||
      url === `https://company.example.test/company/${COMPANY_ID}/with-stores`
    ) {
      return {
        data: companyAvailable
          ? { id: COMPANY_ID, name: "Empresa de prueba", user_id: ACTOR_ID, stores: [] }
          : null,
      };
    }
    if (url.endsWith("/subscription/subscriptions/me")) return { data: null };
    throw new Error(`Unexpected fixture GET: ${url}`);
  });
});

afterEach(() => {
  cleanup();
  for (const queryClient of queryClients) queryClient.clear();
  queryClients = [];
  storageWrites.mockRestore();
});

afterAll(() => {
  for (const [key, value] of [
    ["NEXT_PUBLIC_API_USERS", previousEnvironment.users],
    ["NEXT_PUBLIC_API_COMPANY", previousEnvironment.company],
    ["NEXT_PUBLIC_API_INTEGRATIONS", previousEnvironment.integrations],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("advertising callback session recovery with the real guard and Auth provider", () => {
  it("captures the return before session recovery and posts once after a successful refresh", async () => {
    pendingRefresh = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    renderApplication(`${CALLBACK_PATH}?provider=meta&code=${CODE}&state=${STATE}`);

    expect(window.location.search).toBe("?provider=meta");
    expect(screen.queryByLabelText("Fixture sidebar")).not.toBeInTheDocument();
    expect(callbackRequests()).toHaveLength(0);
    expect(mockPush).not.toHaveBeenCalled();

    await act(async () => {
      releaseRefresh?.();
    });
    await waitFor(() => expect(callbackRequests()).toHaveLength(1));
    expect(callbackRequests()[0]).toEqual([
      CALLBACK_ENDPOINT,
      { state: STATE, code: CODE },
      expect.objectContaining({
        headers: { Authorization: `Bearer ${TOKEN}` },
        withCredentials: false,
      }),
    ]);
    expect(mockReplace).toHaveBeenCalledWith(
      "/configuracion/integraciones/publicidad?connected=meta",
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(storageWrites).not.toHaveBeenCalled();
  });

  it("keeps a failed refresh on the callback, logs in inline with Enter, and resumes once without navigation", async () => {
    refreshFails = true;
    const user = userEvent.setup();
    renderApplication(`${CALLBACK_PATH}?provider=meta&code=${CODE}&state=${STATE}`);

    const email = await screen.findByLabelText("Correo electrónico");
    expect(window.location.search).toBe("?provider=meta");
    expect(callbackRequests()).toHaveLength(0);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Fixture sidebar")).not.toBeInTheDocument();

    await user.type(email, LOGIN_EMAIL);
    await user.type(screen.getByLabelText("Contraseña"), LOGIN_PASSWORD);
    await user.keyboard("{Enter}");

    await waitFor(() => expect(callbackRequests()).toHaveLength(1));
    expect(post).toHaveBeenCalledWith(
      "https://auth.example.test/api/v1/auth/login",
      { email: LOGIN_EMAIL, password: LOGIN_PASSWORD },
      { withCredentials: true },
    );
    expect(callbackRequests()[0][1]).toEqual({ state: STATE, code: CODE });
    expect(mockReplace).toHaveBeenCalledWith(
      "/configuracion/integraciones/publicidad?connected=meta",
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(storageWrites).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain(CODE);
    expect(window.location.href).not.toContain(STATE);
  });

  it("does not complete authorization without the real company recovered by Auth", async () => {
    companyAvailable = false;
    renderApplication(`${CALLBACK_PATH}?provider=meta&code=${CODE}&state=${STATE}`);
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        `https://company.example.test/company/${COMPANY_ID}/with-stores`,
      ),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/empresa/);
    expect(callbackRequests()).toHaveLength(0);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(storageWrites).not.toHaveBeenCalled();
  });

  it("keeps a backend rejection as an error without reporting a connection", async () => {
    callbackStatus = 403;
    renderApplication(`${CALLBACK_PATH}?provider=meta&code=${CODE}&state=${STATE}`);
    expect(await screen.findByRole("alert")).toHaveTextContent("No tienes permiso para continuar.");
    expect(callbackRequests()).toHaveLength(1);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(storageWrites).not.toHaveBeenCalled();
  });

  it.each([
    ["cancelled", `?provider=meta&error=access_denied&state=${STATE}`],
    ["missing code", `?provider=meta&state=${STATE}`],
    ["duplicate provider", `?provider=meta&provider=meta&code=${CODE}&state=${STATE}`],
  ])("does not post or offer inline login for a %s return", async (_name, query) => {
    refreshFails = true;
    renderApplication(`${CALLBACK_PATH}${query}`);
    await screen.findByRole("alert");
    expect(callbackRequests()).toHaveLength(0);
    expect(screen.queryByLabelText("Correo electrónico")).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain(CODE);
    expect(window.location.href).not.toContain(STATE);
    expect(storageWrites).not.toHaveBeenCalled();
  });

  it.each([
    "/configuracion/integraciones/publicidad",
    "/configuracion/integraciones/publicidad/callback-extra",
    "/configuracion/integraciones/publicidad/callback/other",
  ])("continues protecting the neighboring route %s", async (path) => {
    refreshFails = true;
    renderApplication(path, <span>Protected company content</span>);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Protected company content")).not.toBeInTheDocument();
    expect(callbackRequests()).toHaveLength(0);
  });

  it("preserves the ordinary LoginForm redirect outside advertising", async () => {
    refreshFails = true;
    const user = userEvent.setup();
    renderApplication("/login", <LoginForm />);
    await user.type(await screen.findByLabelText("Correo electrónico"), LOGIN_EMAIL);
    await user.type(screen.getByLabelText("Contraseña"), LOGIN_PASSWORD);
    await user.click(screen.getByRole("button", { name: /Ingresar/ }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
    expect(callbackRequests()).toHaveLength(0);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
