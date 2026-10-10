import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import AdvertisingCallbackPage from "@/app/configuracion/integraciones/publicidad/callback/page";
import { useAuth } from "@/contexts/AuthContext";
import { useAdvertisingSnapshot } from "@/hooks/useAdvertisingSnapshot";
import {
  completeAdvertisingAuthorization,
  discoverAdvertisingAccounts,
} from "@/services/advertisingService";
import { AdvertisingLiveAccountsDialog } from "../AdvertisingLiveAccountsDialog";
import {
  AdvertisingLivePanel,
  validatedAdvertisingAuthorizationUrl,
} from "../AdvertisingLivePanel";

const replace = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/hooks/useAdvertisingSnapshot", () => ({ useAdvertisingSnapshot: jest.fn() }));
jest.mock("@/services/advertisingService", () => ({
  ...jest.requireActual("@/services/advertisingService"),
  completeAdvertisingAuthorization: jest.fn(),
  discoverAdvertisingAccounts: jest.fn(),
}));
const complete = jest.mocked(completeAdvertisingAuthorization);
const discover = jest.mocked(discoverAdvertisingAccounts);
const auth = {
  accessToken: "test-access-token",
  user: { id: "actor-id" },
  company: { id: "company-id", name: "Empresa" },
};
const authMock = jest.mocked(useAuth);
const snapshotMock = jest.mocked(useAdvertisingSnapshot);

beforeEach(() => {
  jest.clearAllMocks();
  authMock.mockReturnValue({ auth, loading: false } as ReturnType<typeof useAuth>);
  complete.mockResolvedValue({ connected: true });
  discover.mockResolvedValue({
    accounts: [
      { externalId: "123", name: "Cuenta Lima", currency: "PEN", timeZone: "America/Lima" },
    ],
  });
});

describe("live advertising connection flow", () => {
  it("selects no new accounts automatically and requires a review before saving", async () => {
    const user = userEvent.setup();
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <AdvertisingLiveAccountsDialog
        provider="meta"
        companyId="company-id"
        companyName="Empresa"
        token="test-access-token"
        from="2026-10-01"
        today="2026-10-09"
        initialSelectedIds={[]}
        busy={false}
        error={null}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );
    const box = await screen.findByRole("checkbox", { name: /Cuenta Lima/ });
    expect(box).not.toBeChecked();
    expect(screen.getByRole("button", { name: /Continuar con 0 cuentas/ })).toBeDisabled();
    await user.click(box);
    await user.click(screen.getByRole("button", { name: /Continuar con 1 cuenta/ }));
    expect(screen.getByRole("heading", { name: "Revisa las cuentas" })).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Guardar cuentas" }));
    expect(onSave).toHaveBeenCalledWith({ externalIds: ["123"], syncFrom: "2026-10-01" });
  });

  it("preserves only previous enabled selections and blocks future dates", async () => {
    render(
      <AdvertisingLiveAccountsDialog
        provider="meta"
        companyId="company-id"
        companyName="Empresa"
        token="test-access-token"
        from="2026-10-01"
        today="2026-10-09"
        initialSelectedIds={["123", "unavailable-account"]}
        busy={false}
        error={null}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(await screen.findByRole("checkbox", { name: /Cuenta Lima/ })).toBeChecked();
    fireEvent.change(screen.getByLabelText("Consultar desde"), { target: { value: "2026-10-10" } });
    expect(screen.getByRole("button", { name: /Continuar con 1 cuenta/ })).toBeDisabled();
    expect(screen.getByText("Elige una fecha hasta hoy.")).toBeVisible();
  });

  it.each([
    ["meta", "https://www.facebook.com.evil.test/v23.0/dialog/oauth"],
    ["meta", "http://www.facebook.com/v23.0/dialog/oauth"],
    ["meta", "https://www.facebook.com/other-page"],
    ["tiktok", "https://business-api.tiktok.com/portal/auth"],
  ] as const)("rejects unexpected authorization destinations for %s", (provider, url) => {
    expect(() => validatedAdvertisingAuthorizationUrl(provider, url)).toThrow();
  });

  it("accepts the exact Meta authorization endpoint", () => {
    expect(
      validatedAdvertisingAuthorizationUrl(
        "meta",
        "https://www.facebook.com/v23.0/dialog/oauth?state=opaque-state",
      ),
    ).toBe("https://www.facebook.com/v23.0/dialog/oauth?state=opaque-state");
  });

  it("removes callback secrets before posting and executes once under StrictMode", async () => {
    window.history.replaceState(
      null,
      "",
      "/configuracion/integraciones/publicidad/callback?provider=meta&code=one-use-code&state=opaque-state",
    );
    complete.mockImplementation(async () => {
      expect(window.location.search).toBe("?provider=meta");
      return { connected: true };
    });
    render(
      <StrictMode>
        <AdvertisingCallbackPage />
      </StrictMode>,
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "/configuracion/integraciones/publicidad?connected=meta",
      ),
    );
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("test-access-token", "company-id", "meta", {
      state: "opaque-state",
      code: "one-use-code",
    });
    expect(window.location.href).not.toContain("one-use-code");
  });

  it("waits for silent Auth recovery without retaining secrets in the URL", async () => {
    window.history.replaceState(
      null,
      "",
      "/configuracion/integraciones/publicidad/callback?provider=meta&code=one-use-code&state=opaque-state",
    );
    authMock.mockReturnValue({ auth: null, loading: true } as ReturnType<typeof useAuth>);
    const view = render(<AdvertisingCallbackPage />);
    expect(complete).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?provider=meta");
    authMock.mockReturnValue({ auth, loading: false } as ReturnType<typeof useAuth>);
    view.rerender(<AdvertisingCallbackPage />);
    await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
  });

  it("does not report a connection when the provider cancelled authorization", async () => {
    window.history.replaceState(
      null,
      "",
      "/configuracion/integraciones/publicidad/callback?provider=meta&error=access_denied&error_description=private-details",
    );
    render(<AdvertisingCallbackPage />);
    expect(await screen.findByText("Conexión cancelada.")).toBeVisible();
    expect(complete).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?provider=meta");
  });

  it("rejects duplicate provider parameters before completing authorization", async () => {
    window.history.replaceState(
      null,
      "",
      "/configuracion/integraciones/publicidad/callback?provider=meta&provider=meta&code=one-use-code&state=opaque-state",
    );
    render(<AdvertisingCallbackPage />);
    expect(
      await screen.findByText("No pudimos completar la conexión. Vuelve a iniciarla."),
    ).toBeVisible();
    expect(complete).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });

  it("hides manual records when financial access is denied", () => {
    const refetch = jest.fn();
    snapshotMock.mockReturnValue({
      data: undefined,
      isError: true,
      isAccessDenied: true,
      error: { isAxiosError: true, response: { status: 403 } },
      refetch,
    } as unknown as ReturnType<typeof useAdvertisingSnapshot>);
    render(
      <AdvertisingLivePanel
        companyId="company-id"
        actorId="actor-id"
        token="test-access-token"
        companyName="Empresa"
        from="2026-10-01"
        to="2026-10-09"
        manualContent={<span>Registros privados</span>}
      />,
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
        ),
      },
    );
    expect(screen.getByRole("alert")).toHaveTextContent("No tienes permiso para continuar.");
    expect(screen.queryByText("Registros privados")).not.toBeInTheDocument();
    expect(screen.queryByText("Ver registros manuales")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volver a intentar" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows a retry when malformed financial data cannot be read", () => {
    snapshotMock.mockReturnValue({
      data: {
        accounts: [],
        days: [
          {
            accountId: "unknown-account",
            date: "2026-10-09",
            amount: "1.01",
            currency: "PEN",
            provisional: false,
            sourceRevision: null,
            updatedAt: "2026-10-09T00:00:00Z",
          },
        ],
        manualRecords: [],
        providers: {
          meta: { available: false, status: "disconnected" },
          tiktok: { available: false, status: "disconnected" },
        },
        capabilities: { canManage: false, canReconcile: false },
        today: "2026-10-09",
      },
      isError: false,
      isAccessDenied: false,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useAdvertisingSnapshot>);
    render(
      <AdvertisingLivePanel
        companyId="company-id"
        actorId="actor-id"
        token="test-access-token"
        companyName="Empresa"
        from="2026-10-01"
        to="2026-10-09"
      />,
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
        ),
      },
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos leer los datos de publicidad. Inténtalo de nuevo.",
    );
    expect(screen.getByRole("button", { name: "Volver a intentar" })).toBeVisible();
  });
});
