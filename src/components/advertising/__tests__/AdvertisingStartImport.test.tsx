import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdvertisingAccountWire } from "@/services/advertisingService";
import {
  AdvertisingStartImport,
  advertisingImportStatus,
  importErrorMessage,
} from "../AdvertisingStartImport";

function account(overrides: Partial<AdvertisingAccountWire> = {}): AdvertisingAccountWire {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    provider: "meta",
    externalId: "123",
    name: "Cuenta A",
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
    ...overrides,
  };
}

describe("AdvertisingStartImport", () => {
  it("starts only the accounts the user marked", async () => {
    const onStart = jest.fn();
    render(
      <AdvertisingStartImport
        accounts={[
          account(),
          account({ id: "22222222-2222-4222-8222-222222222222", name: "Cuenta B" }),
          account({ id: "33333333-3333-4333-8333-333333333333", name: "Otra", provider: "tiktok" }),
        ]}
        canManage
        busy={false}
        onStart={onStart}
      />,
    );
    const start = screen.getByRole("button", { name: /Comenzar importación/ });
    expect(start).toBeDisabled();
    expect(screen.queryByLabelText("Importar Otra")).toBeNull();
    await userEvent.click(screen.getByLabelText("Importar Cuenta B"));
    await userEvent.click(screen.getByRole("button", { name: "Comenzar importación (1)" }));
    expect(onStart).toHaveBeenCalledWith(["22222222-2222-4222-8222-222222222222"]);
  });

  it("shows accounts nobody started as not imported, never as importing", () => {
    const status = advertisingImportStatus(
      account({
        adImport: {
          status: "paused",
          completedWindows: 2,
          totalWindows: 10,
          errorCode: "PROVIDER_RATE",
          nextAttemptAt: null,
          updatedAt: null,
        },
      }),
    );
    expect(status.phase).toBe("not_requested");
    expect(status.detail).toContain("se conservan");
  });

  it("explains Meta's rate limit in plain words with the retry time", () => {
    const status = advertisingImportStatus(
      account({
        importRequestedAt: "2026-11-25T18:00:00Z",
        adImport: {
          status: "retrying",
          completedWindows: 3,
          totalWindows: 12,
          errorCode: "PROVIDER_RATE",
          nextAttemptAt: "2026-11-25T19:30:00Z",
          updatedAt: null,
        },
      }),
    );
    expect(status.phase).toBe("retrying");
    expect(status.detail).toMatch(/Meta limitó las consultas/);
    expect(status.detail).toMatch(/Se reintenta a las/);
    expect(status.progress).toBe(25);
    expect(importErrorMessage("PROVIDER_AUTH", null)).toMatch(/Reconecta/);
  });

  it("hides the start button for viewers without permission", () => {
    render(<AdvertisingStartImport accounts={[account()]} canManage={false} busy={false} onStart={jest.fn()} />);
    expect(screen.queryByRole("button", { name: /Comenzar importación/ })).toBeNull();
    expect(screen.getByText("Sin importar")).toBeInTheDocument();
  });
});
