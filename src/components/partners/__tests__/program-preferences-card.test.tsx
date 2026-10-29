import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanPageContent } from "@/app/partners/plan/_components/plan-page-content";
import {
  requestProgramPreferences,
  requestUpdateProgramPreferences,
} from "@/features/partners/api/program-preferences.api";
import type { ProgramPreferencesResponse } from "@/features/partners/models/program-preferences";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import { programPreferencesFixture } from "@/features/partners/test-utils/program-preferences.fixture";
import { clearAdminReadDenial } from "@/features/partners/utils/admin-read-session-state";
import { clearProgramPreferencesDenial } from "@/features/partners/utils/program-preferences-session-state";
import { tokenStore } from "@/lib/tokenStore";
import { ProgramPreferencesCard } from "../program-preferences-card";

let mockAuth: { user: { id: string }; accessToken: string } | null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("@/features/partners/api/program-preferences.api", () => ({
  requestProgramPreferences: jest.fn(),
  requestUpdateProgramPreferences: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const USER = "11111111-1111-4111-8111-111111111111";
const original = {
  optionCode: "A" as const,
  discountPct: "5",
  expectedVersion: 2,
  reason: "Original protected reason",
};
const existingSettings = {
  optionCode: "A" as const,
  discountPct: "0",
  version: 2,
  updatedAt: "2026-10-11T10:00:00Z",
};
const existing = programPreferencesFixture(existingSettings);
const savedSettings = {
  optionCode: "A" as const,
  discountPct: "5",
  version: 3,
  updatedAt: "2026-10-11T11:00:00Z",
};
const saved = programPreferencesFixture(savedSettings);
let client: QueryClient;
function renderCard(component = <ProgramPreferencesCard />) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{component}</QueryClientProvider>);
}
async function fill() {
  await screen.findByRole("textbox", { name: "Motivo del cambio" });
  const option = screen.queryByRole("combobox", { name: "Opción de comisión preferida" });
  if (option) await userEvent.selectOptions(option, "B");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Descuento preferido" }), "5");
  await userEvent.type(screen.getByRole("textbox", { name: "Motivo del cambio" }), original.reason);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  Object.defineProperty(globalThis, "TextEncoder", { value: TextEncoder, configurable: true });
});
beforeEach(() => {
  clearAdminReadDenial();
  clearProgramPreferencesDenial();
  sessionStorage.clear();
  mockAuth = { user: { id: USER }, accessToken: "private-preference-A" };
  tokenStore.set(mockAuth.accessToken);
  jest.mocked(requestProgramPreferences).mockReset().mockResolvedValue(existing);
  jest.mocked(requestUpdateProgramPreferences).mockReset().mockResolvedValue(saved);
});
afterEach(() => {
  cleanup();
  client?.clear();
  tokenStore.set(null);
  clearAdminReadDenial();
  clearProgramPreferencesDenial();
  sessionStorage.clear();
});

it("has no default option/discount for an absent setting and labels the factual catalog as not effective", async () => {
  jest.mocked(requestProgramPreferences).mockResolvedValue(programPreferencesFixture());
  renderCard(<PlanPageContent />);
  await screen.findByRole("combobox", { name: "Opción de comisión preferida" });
  expect(screen.getByRole("combobox", { name: "Opción de comisión preferida" })).toHaveValue("");
  expect(screen.getByRole("combobox", { name: "Descuento preferido" })).toHaveValue("");
  expect(screen.getByText(/Condiciones efectivas: no configuradas/)).toBeInTheDocument();
  expect(screen.getByText("Catálogo documentado, no condiciones efectivas")).toBeInTheDocument();
  expect(
    screen.getByText(/MRR atribuido y nivel del programa: no disponibles/),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Simulador|S\/|Bronce/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Guardar preferencias" }));
  expect(requestUpdateProgramPreferences).not.toHaveBeenCalled();
  await fill();
  await userEvent.click(screen.getByRole("button", { name: "Guardar preferencias" }));
  await waitFor(() => expect(requestUpdateProgramPreferences).toHaveBeenCalledTimes(1));
  expect(jest.mocked(requestUpdateProgramPreferences).mock.calls[0][0].command).toEqual({
    ...original,
    optionCode: "B",
    expectedVersion: null,
  });
});

it("keeps the option locked and preserves a historical custom decimal", async () => {
  jest
    .mocked(requestProgramPreferences)
    .mockResolvedValue(
      programPreferencesFixture({ ...existingSettings, discountPct: "2.7500000001" }),
    );
  renderCard();
  await screen.findByRole("combobox", { name: "Descuento preferido" });
  expect(screen.getByRole("combobox", { name: "Descuento preferido" })).toHaveValue("2.7500000001");
  expect(screen.getByRole("option", { name: "2.7500000001% (configurado)" })).toBeInTheDocument();
  expect(
    screen.queryByRole("combobox", { name: "Opción de comisión preferida" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Opción de comisión preferida" })).toHaveValue(
    "Opción A",
  );
  expect(screen.getByRole("textbox", { name: "Opción de comisión preferida" })).toHaveAttribute(
    "readonly",
  );
  await userEvent.type(
    screen.getByRole("textbox", { name: "Motivo del cambio" }),
    "Preservar descuento configurado",
  );
  await userEvent.click(screen.getByRole("button", { name: "Guardar preferencias" }));
  await waitFor(() => expect(requestUpdateProgramPreferences).toHaveBeenCalledTimes(1));
  expect(jest.mocked(requestUpdateProgramPreferences).mock.calls[0][0].command).toEqual({
    optionCode: "A",
    discountPct: "2.7500000001",
    expectedVersion: 2,
    reason: "Preservar descuento configurado",
  });
});

it.each([
  { failure: new Error("Response lost"), readFails: false },
  { failure: new Error("Response lost"), readFails: true },
  { failure: buildAxiosError(503), readFails: false },
  { failure: buildAxiosError(503), readFails: true },
])(
  "retains exactly the original unknown proposal through a background GET: %#",
  async ({ failure, readFails }) => {
    jest
      .mocked(requestUpdateProgramPreferences)
      .mockRejectedValueOnce(failure)
      .mockResolvedValue(saved);
    renderCard();
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Guardar preferencias" }));
    await screen.findByText(/El resultado de la solicitud es desconocido/);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Motivo de la solicitud original" })).toHaveValue(
      original.reason,
    );
    if (readFails) {
      jest.mocked(requestProgramPreferences).mockRejectedValueOnce(buildAxiosError(500));
      await act(async () => {
        await client.invalidateQueries({ queryKey: ["partners", "own-program-preferences"] });
      });
      await screen.findByText("No pudimos leer tus preferencias.");
    } else {
      await act(async () => {
        for (const query of client.getQueryCache().getAll())
          client.setQueryData(
            query.queryKey,
            programPreferencesFixture({
              ...savedSettings,
              optionCode: "C",
              discountPct: "10",
              version: 9,
            }),
          );
      });
    }
    expect(screen.getByText(/Opción A · descuento 5% · versión esperada 2/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar preferencias" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar misma solicitud" }));
    await waitFor(() => expect(requestUpdateProgramPreferences).toHaveBeenCalledTimes(2));
    const calls = jest.mocked(requestUpdateProgramPreferences).mock.calls;
    expect(calls[0][0].command).toEqual(original);
    expect(calls[1][0].command).toEqual(original);
    expect(calls[0][0].idempotencyKey).toBe(calls[1][0].idempotencyKey);
  },
);

it("does not expose a new form while the original request remains pending and a GET changes", async () => {
  const pending = deferred<ProgramPreferencesResponse>();
  jest.mocked(requestUpdateProgramPreferences).mockReturnValueOnce(pending.promise);
  renderCard();
  await fill();
  await userEvent.click(screen.getByRole("button", { name: "Guardar preferencias" }));
  await screen.findByText("Guardando la solicitud original…");
  await act(async () => {
    for (const query of client.getQueryCache().getAll()) client.setQueryData(query.queryKey, saved);
  });
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reintentar misma solicitud" })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: "Motivo de la solicitud original" })).toHaveValue(
    original.reason,
  );
  await act(async () => {
    pending.resolve(saved);
  });
});

it("gives current denial priority over the original private proposal and cached GET", async () => {
  jest.mocked(requestUpdateProgramPreferences).mockRejectedValueOnce(new Error("Response lost"));
  renderCard();
  await fill();
  await userEvent.click(screen.getByRole("button", { name: "Guardar preferencias" }));
  await screen.findByText(/El resultado de la solicitud es desconocido/);
  jest.mocked(requestProgramPreferences).mockRejectedValueOnce(buildAxiosError(403));
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["partners", "own-program-preferences"] });
  });
  await screen.findByText("No tenés acceso a las preferencias de un Partner activo.");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Reintentar misma solicitud" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(original.reason)).not.toBeInTheDocument();
});

it("hides an old-user proposal immediately after an account switch", async () => {
  jest.mocked(requestUpdateProgramPreferences).mockRejectedValueOnce(new Error("Response lost"));
  const rendered = renderCard();
  await fill();
  await userEvent.click(screen.getByRole("button", { name: "Guardar preferencias" }));
  await screen.findByText(/El resultado de la solicitud es desconocido/);
  mockAuth = { user: { id: "22222222-2222-4222-8222-222222222222" }, accessToken: "private-B" };
  tokenStore.set(mockAuth.accessToken);
  jest.mocked(requestProgramPreferences).mockReturnValueOnce(new Promise(() => {}));
  rendered.rerender(
    <QueryClientProvider client={client}>
      <ProgramPreferencesCard />
    </QueryClientProvider>,
  );
  expect(
    screen.queryByRole("textbox", { name: "Motivo de la solicitud original" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(original.reason)).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Reintentar misma solicitud" }),
  ).not.toBeInTheDocument();
});

it("blocks a new MAX version proposal but permits an original MAX-1 replay", async () => {
  jest
    .mocked(requestProgramPreferences)
    .mockResolvedValueOnce(
      programPreferencesFixture({ ...existingSettings, version: Number.MAX_SAFE_INTEGER }),
    );
  const rendered = renderCard();
  await screen.findByText(/alcanzó el límite de versión/);
  expect(screen.queryByRole("button", { name: "Guardar preferencias" })).not.toBeInTheDocument();
  rendered.unmount();
  client.clear();
  jest
    .mocked(requestProgramPreferences)
    .mockResolvedValue(
      programPreferencesFixture({ ...existingSettings, version: Number.MAX_SAFE_INTEGER - 1 }),
    );
  jest.mocked(requestUpdateProgramPreferences).mockRejectedValueOnce(new Error("Response lost"));
  renderCard();
  await fill();
  await userEvent.click(screen.getByRole("button", { name: "Guardar preferencias" }));
  await screen.findByText(/El resultado de la solicitud es desconocido/);
  await act(async () => {
    for (const query of client.getQueryCache().getAll())
      client.setQueryData(
        query.queryKey,
        programPreferencesFixture({ ...savedSettings, version: Number.MAX_SAFE_INTEGER }),
      );
  });
  expect(screen.getByRole("button", { name: "Reintentar misma solicitud" })).toBeEnabled();
  await userEvent.click(screen.getByRole("button", { name: "Reintentar misma solicitud" }));
  await waitFor(() => expect(requestUpdateProgramPreferences).toHaveBeenCalledTimes(2));
  expect(
    jest.mocked(requestUpdateProgramPreferences).mock.calls[1][0].command.expectedVersion,
  ).toBe(Number.MAX_SAFE_INTEGER - 1);
});
