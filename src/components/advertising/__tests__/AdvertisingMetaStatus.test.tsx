import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  type AdvertisingAccountWire,
  type AdvertisingDiscoveredAccount,
  discoverAdvertisingAccounts,
} from "@/services/advertisingService";
import { AdvertisingLiveAccountsDialog } from "../AdvertisingLiveAccountsDialog";
import { AdvertisingStartImport } from "../AdvertisingStartImport";
import {
  accountCampaignsLabel,
  metaRateLimitLabel,
  accountDisableReasonLabel,
  accountStatusLabel,
  accountStatusState,
  effectiveStatusState,
  matchesSearch,
} from "../advertising-meta-status";

jest.mock("@/services/advertisingService", () => ({
  ...jest.requireActual("@/services/advertisingService"),
  discoverAdvertisingAccounts: jest.fn(),
}));
const discover = jest.mocked(discoverAdvertisingAccounts);

const status = (code: number | null, key: string | null, reason = 0, reasonKey = "NONE") => ({
  code,
  key,
  disableReasonCode: reason,
  disableReasonKey: reasonKey,
});
const discovered: AdvertisingDiscoveredAccount[] = [
  {
    externalId: "1",
    name: "Cuenta Lima",
    currency: "PEN",
    timeZone: "America/Lima",
    metaStatus: status(1, "ACTIVE"),
    campaigns: { known: true, active: 3, total: 5, updatedAt: "2026-11-25T15:00:00.000Z" },
  },
  {
    externalId: "2",
    name: "Cuenta Outlet",
    currency: "PEN",
    timeZone: "America/Lima",
    metaStatus: status(2, "DISABLED", 3, "RISK_PAYMENT"),
    campaigns: { known: false },
  },
  {
    externalId: "3",
    name: "Cuenta Rara",
    currency: "PEN",
    timeZone: "America/Lima",
    metaStatus: status(777, null),
    campaigns: { known: false },
  },
  {
    externalId: "4",
    name: "Cuenta Norte",
    currency: "PEN",
    timeZone: "America/Lima",
    metaStatus: status(1, "ACTIVE"),
    campaigns: { known: true, active: 0, total: 2, updatedAt: "2026-11-25T15:00:00.000Z" },
  },
];

describe("Meta status helpers", () => {
  it("keeps account status apart from campaign activity and never guesses unknown codes", () => {
    expect(accountStatusState(status(1, "ACTIVE"))).toBe("active");
    expect(accountStatusState(status(101, "CLOSED"))).toBe("inactive");
    expect(accountStatusState(status(201, "ANY_ACTIVE"))).toBe("unknown");
    expect(accountStatusState(status(777, null))).toBe("unknown");
    expect(accountStatusState(undefined)).toBe("unknown");
    expect(accountStatusLabel(status(777, null))).toBe("Estado desconocido (código 777)");
    expect(accountStatusLabel(status(null, null))).toBe("Estado no informado por Meta");
    expect(accountDisableReasonLabel(status(2, "DISABLED", 3, "RISK_PAYMENT"))).toBe(
      "Motivo: riesgo en el pago",
    );
    expect(accountDisableReasonLabel(status(2, "DISABLED", 99, ""))).toBe(
      "Motivo desconocido (código 99)",
    );
    expect(accountCampaignsLabel({ known: false })).toBe(
      "Campañas activas: sin importar, no sabemos",
    );
    expect(
      accountCampaignsLabel({ known: true, active: 0, total: 2, updatedAt: "2026-11-25T15:00:00Z" }),
    ).toMatch(/^Ninguna campaña activa · 2 pausadas o archivadas · lectura del /);
    expect(
      accountCampaignsLabel({ known: true, active: 0, total: 0, updatedAt: "2026-11-25T15:00:00Z" }),
    ).toMatch(/^Meta no devolvió campañas \(las borradas no se cuentan\)/);
    expect(
      accountCampaignsLabel({ known: true, active: 3, total: 5, updatedAt: "2026-11-25T15:00:00Z" }),
    ).toMatch(/^3 de 5 campañas activas/);
  });

  it("says since when Meta limited and from when it retries", () => {
    const now = Date.parse("2026-11-25T19:00:00Z");
    const waiting = metaRateLimitLabel(
      [
        {
          coverage: { lastAttemptAt: "2026-11-25T18:56:00Z" },
          historyImport: { nextAttemptAt: "2026-11-25T19:45:00Z" },
        },
      ],
      now,
    );
    expect(waiting).toMatch(/^Meta limitó la actualización desde .*· reintento desde /);
    expect(waiting).toContain("01:56");
    expect(waiting).toContain("02:45");
    expect(
      metaRateLimitLabel(
        [{ coverage: { lastAttemptAt: "2026-11-25T18:56:00Z" }, historyImport: null }],
        now,
      ),
    ).toMatch(/ya puedes volver a pulsar «Actualizar Meta»$/);
  });

  it("maps effective_status and searches without accents", () => {
    expect(effectiveStatusState("ACTIVE")).toBe("active");
    expect(effectiveStatusState("CAMPAIGN_PAUSED")).toBe("inactive");
    expect(effectiveStatusState(null)).toBe("unknown");
    expect(matchesSearch("campana", "Campaña Navidad")).toBe(true);
    expect(matchesSearch("999", "Campaña", "123")).toBe(false);
  });
});

describe("Elige tus cuentas", () => {
  beforeEach(() => discover.mockResolvedValue({ accounts: discovered }));

  it("filters accounts by Meta account_status and search without saving or importing", async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();
    render(
      <AdvertisingLiveAccountsDialog
        provider="meta"
        companyId="company-id"
        companyName="Empresa"
        token="token"
        initialSelectedIds={[]}
        busy={false}
        error={null}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );
    await screen.findByRole("checkbox", { name: /Cuenta Lima/ });
    expect(screen.getByRole("button", { name: "Todas (4)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Estado desconocido (código 777)")).toBeVisible();
    expect(screen.getByText(/Ninguna campaña activa · 2 pausadas o archivadas/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Activas (2)" }));
    expect(screen.getByRole("checkbox", { name: /Cuenta Lima/ })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: /Cuenta Norte/ })).toBeVisible();
    expect(screen.queryByRole("checkbox", { name: /Cuenta Outlet/ })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /Cuenta Rara/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Inactivas (1)" }));
    expect(screen.getByRole("checkbox", { name: /Cuenta Outlet/ })).toBeVisible();
    expect(screen.getByText("Motivo: riesgo en el pago")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Todas (4)" }));
    await user.type(screen.getByRole("searchbox"), "norte");
    expect(screen.getByRole("checkbox", { name: /Cuenta Norte/ })).toBeVisible();
    expect(screen.queryByRole("checkbox", { name: /Cuenta Lima/ })).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
    expect(discover).toHaveBeenCalledTimes(1);
  });
});

describe("Comenzar importación", () => {
  const wire = (id: string, externalId: string, name: string): AdvertisingAccountWire => ({
    id,
    provider: "meta",
    externalId,
    name,
    currency: "PEN",
    timeZone: "America/Lima",
    enabled: true,
    connectionId: "c",
    syncFrom: null,
    lastAttemptAt: null,
    lastSuccessfulAt: null,
    updatedAt: null,
    historyImport: null,
    importRequestedAt: null,
    adImport: null,
  });

  it("shows Meta status per account and filters without starting an import", async () => {
    const user = userEvent.setup();
    const onStart = jest.fn();
    const loadStatuses = jest.fn().mockResolvedValue(discovered);
    render(
      <AdvertisingStartImport
        accounts={[
          wire("11111111-1111-4111-8111-111111111111", "1", "Cuenta Lima"),
          wire("22222222-2222-4222-8222-222222222222", "2", "Cuenta Outlet"),
        ]}
        canManage
        busy={false}
        onStart={onStart}
        loadStatuses={loadStatuses}
      />,
    );
    await waitFor(() => expect(screen.getByText("Deshabilitada")).toBeVisible());
    await user.click(screen.getByRole("button", { name: "Inactivas (1)" }));
    expect(screen.getByLabelText("Importar Cuenta Outlet")).toBeVisible();
    expect(screen.queryByLabelText("Importar Cuenta Lima")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Activas (1)" }));
    expect(screen.getByLabelText("Importar Cuenta Lima")).toBeVisible();
    expect(onStart).not.toHaveBeenCalled();
    expect(loadStatuses).toHaveBeenCalledTimes(1);
  });
});
