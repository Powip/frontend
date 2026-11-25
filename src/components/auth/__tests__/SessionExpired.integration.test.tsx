/**
 * Aviso «Tu sesión expiró»: sale solo cuando la renovación dice que el token no
 * vale. Con AuthProvider, axiosAuth y el modal reales; se simula la red.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios, { AxiosError, type AxiosAdapter } from "axios";
import QueryProvider from "@/components/providers/QueryProvider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import axiosAuth from "@/lib/axiosAuth";
import { replacePage } from "@/lib/browserNavigation";
import { markSessionStarted } from "@/lib/sessionExpiry";
import { tokenStore } from "@/lib/tokenStore";
import SessionExpiredDialog from "../SessionExpiredDialog";

let mockPathname = "/registrar-venta";
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));
jest.mock("@/lib/browserNavigation", () => ({ replacePage: jest.fn(), goToExternalPage: jest.fn() }));
jest.mock("@tanstack/react-query-devtools", () => ({ ReactQueryDevtools: () => null }));
jest.mock("@/services/companyService", () => ({
  fetchUserCompany: jest.fn().mockResolvedValue(null),
  fetchCompanyById: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/services/fetchUserSubscription", () => ({
  fetchUserSubscription: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/services/subscriptionAccess", () => ({
  fetchSubscriptionAccess: jest.fn().mockResolvedValue(null),
}));

function token(exp = Math.floor(Date.now() / 1000) + 3600) {
  const payload = { id: "fixture-user", email: "fixture@review.invalid", role: "USER", exp };
  return `${btoa(JSON.stringify({ alg: "none" }))}.${btoa(JSON.stringify(payload))}.fixture`;
}

function httpError(status: number, code?: string) {
  const error = new AxiosError(`HTTP ${status}`);
  error.response = { status, data: { code }, statusText: "", headers: {}, config: {} as never };
  return error;
}

const EXPIRED = () => httpError(401, "AUTH_SESSION_REQUIRED");
const unauthorized: AxiosAdapter = async (config) => {
  const error = httpError(401);
  error.config = config;
  throw error;
};

let session: ReturnType<typeof useAuth>;
function Probe() {
  session = useAuth();
  return null;
}

/** jsdom no trae BroadcastChannel: basta con entregar el mensaje a quien escucha. */
const channels = new Set<FakeChannel>();
class FakeChannel {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor() {
    channels.add(this);
  }
  postMessage(data: unknown) {
    channels.forEach((other) => other !== this && other.onmessage?.({ data }));
  }
  close() {
    channels.delete(this);
  }
}
Object.assign(globalThis, { BroadcastChannel: FakeChannel });

let post: jest.SpyInstance;
let refreshResult: () => Promise<unknown>;

/** Entra con sesión activa; `refreshResult` decide qué responde la renovación. */
async function renderSignedIn(accessToken = token()) {
  render(
    <QueryProvider>
      <AuthProvider>
        <Probe />
        <SessionExpiredDialog />
      </AuthProvider>
    </QueryProvider>,
  );
  await waitFor(() => expect(session.loading).toBe(false));
  await act(async () => {
    await session.login({ accessToken });
  });
}

async function failingRequest(client = axiosAuth) {
  await act(async () => {
    await expect(
      client.get("https://api.invalid/orders", {
        adapter: unauthorized,
        ...(client === axiosAuth ? {} : { headers: { Authorization: `Bearer ${tokenStore.get()}` } }),
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });
}

beforeEach(() => {
  mockPathname = "/registrar-venta";
  window.history.replaceState(null, "", "/registrar-venta?orderId=7");
  tokenStore.set(null);
  localStorage.clear();
  markSessionStarted();
  jest.mocked(replacePage).mockClear();
  // Sin cookie al cargar: la app arranca anónima.
  refreshResult = async () => {
    throw EXPIRED();
  };
  post = jest.spyOn(axios, "post").mockImplementation(async (url: string) => {
    if (url === "/api/auth/refresh") return refreshResult() as never;
    return { data: {} } as never;
  });
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const dialog = () => screen.queryByRole("alertdialog");

describe("sesión vencida", () => {
  it("la primera visita sin sesión no muestra el aviso", async () => {
    render(
      <QueryProvider>
        <AuthProvider>
          <Probe />
          <SessionExpiredDialog />
        </AuthProvider>
      </QueryProvider>,
    );
    await waitFor(() => expect(session.loading).toBe(false));
    expect(dialog()).not.toBeInTheDocument();
  });

  it("muestra un solo aviso, cuenta 5-1 y lleva al login con el retorno", async () => {
    await renderSignedIn();
    jest.useFakeTimers();
    await act(async () => {
      const get = () => axiosAuth.get("https://api.invalid/orders", { adapter: unauthorized }).catch(() => {});
      await Promise.all([get(), get(), get()]);
    });

    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    expect(screen.getByText("Tu sesión expiró")).toBeInTheDocument();
    for (const n of [5, 4, 3, 2, 1]) {
      expect(dialog()).toHaveAccessibleDescription(
        `Por seguridad, vuelve a iniciar sesión. Te llevamos en ${n}`,
      );
      expect(replacePage).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }
    expect(replacePage).toHaveBeenCalledTimes(1);
    expect(replacePage).toHaveBeenCalledWith("/login?volver=%2Fregistrar-venta%3ForderId%3D7");
    // La sesión en memoria se conserva hasta salir: la pantalla no se vacía detrás del aviso.
    expect(session.auth).not.toBeNull();
  });

  it("el botón va al login sin esperar y Escape o clic fuera no lo cierran", async () => {
    await renderSignedIn();
    await failingRequest();
    expect(screen.getByRole("button", { name: "Iniciar sesión ahora" })).toHaveFocus();

    fireEvent.keyDown(dialog()!, { key: "Escape" });
    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);
    expect(dialog()).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión ahora" }));
    expect(replacePage).toHaveBeenCalledWith("/login?volver=%2Fregistrar-venta%3ForderId%3D7");
  });

  it("también sale cuando el 401 llega a una llamada sin axiosAuth", async () => {
    await renderSignedIn();
    await failingRequest(axios as unknown as typeof axiosAuth);
    await waitFor(() => expect(dialog()).toBeInTheDocument());
  });

  it("al volver a la pestaña con el access token vencido comprueba la sesión", async () => {
    await renderSignedIn(token(Math.floor(Date.now() / 1000) - 60));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(dialog()).toBeInTheDocument());
  });

  it.each([
    ["sin conexión", () => new AxiosError("Network Error", "ERR_NETWORK")],
    ["timeout", () => new AxiosError("timeout", "ECONNABORTED")],
    ["500", () => httpError(500)],
    ["502", () => httpError(502, "AUTH_UNAVAILABLE")],
    ["503", () => httpError(503, "AUTH_UNAVAILABLE")],
    ["504", () => httpError(504, "AUTH_TIMEOUT")],
    ["429", () => httpError(429, "AUTH_RATE_LIMITED")],
    ["409", () => httpError(409, "AUTH_RETRY_REQUIRED")],
    ["403 CSRF", () => httpError(403, "AUTH_CSRF_REJECTED")],
    ["401 ajeno al proxy", () => httpError(401)],
  ])("renovación con %s: ni aviso ni cierre de sesión", async (_name, failure) => {
    await renderSignedIn();
    refreshResult = async () => {
      throw failure();
    };
    post.mockClear();

    await failingRequest();

    expect(post).toHaveBeenCalledWith("/api/auth/refresh", {}, expect.anything());
    expect(post).not.toHaveBeenCalledWith("/api/auth/logout", expect.anything(), expect.anything());
    expect(dialog()).not.toBeInTheDocument();
    expect(replacePage).not.toHaveBeenCalled();
    expect(session.auth).not.toBeNull();
  });

  it("el cierre de sesión manual no muestra el aviso", async () => {
    await renderSignedIn();
    await act(async () => {
      await session.logout();
    });
    await act(async () => {
      await session.refreshSession();
    });
    expect(dialog()).not.toBeInTheDocument();
    expect(replacePage).not.toHaveBeenCalled();
  });

  it("si se cerró sesión en otra pestaña va al login sin aviso ni retorno", async () => {
    await renderSignedIn();
    act(() => {
      new FakeChannel().postMessage(true);
    });
    await failingRequest();
    expect(dialog()).not.toBeInTheDocument();
    await waitFor(() => expect(replacePage).toHaveBeenCalledWith("/login"));
  });

  it("en una página que se usa sin sesión no interrumpe", async () => {
    mockPathname = "/rastreo/abc";
    await renderSignedIn();
    await failingRequest();
    expect(dialog()).not.toBeInTheDocument();
  });
});
