import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { registerPartnerReferralApi } from "@/features/partners/api/partner-referrals.api";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import { createIdempotencyKey } from "@/features/partners/utils/create-idempotency-key";
import { tokenStore } from "@/lib/tokenStore";
import { manualReferralStorageKey } from "@/features/partners/utils/manual-referral-idempotency";
import { RegisterReferralDialog } from "../register-referral-dialog";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/features/partners/api/partner-referrals.api", () => ({
  registerPartnerReferralApi: jest.fn(),
}));
jest.mock("@/features/partners/utils/create-idempotency-key", () => ({
  createIdempotencyKey: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockUseAuth = jest.mocked(useAuth);
const mockRegisterApi = jest.mocked(registerPartnerReferralApi);
const mockCreateIdempotencyKey = jest.mocked(createIdempotencyKey);

const REGISTERED = {
  id: "11111111-1111-4111-8111-111111111111",
  origin: "MANUAL" as const,
  state: "UNDER_REVIEW",
  capturedAt: "2026-10-08T12:00:00Z",
  expiresAt: null,
};

function DialogHarness() {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Abrir registro
      </button>
      <RegisterReferralDialog isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DialogHarness />
    </QueryClientProvider>,
  );
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  phone = "+51987654321",
  businessName = "Zapatería Andes",
) {
  await user.type(screen.getByLabelText(/nombre del negocio/i), businessName);
  await user.type(screen.getByLabelText(/correo del negocio/i), "andes@example.com");
  await user.type(screen.getByLabelText(/teléfono/i), phone);
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^registrar referido$/i }));
}

beforeEach(() => {
  let counter = 0;
  sessionStorage.clear();
  tokenStore.set("partner.jwt.test");
  mockCreateIdempotencyKey.mockReset();
  mockCreateIdempotencyKey.mockImplementation(() => `referral-key-${++counter}`);
  mockRegisterApi.mockReset();
  mockUseAuth.mockReturnValue({
    auth: { user: { id: "partner-user" }, accessToken: "partner.jwt.test" },
  } as unknown as ReturnType<typeof useAuth>);
});

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  Object.defineProperty(globalThis, "TextEncoder", { value: TextEncoder, configurable: true });
});
afterEach(() => {
  tokenStore.set(null);
  jest.restoreAllMocks();
});

describe("reintento de referido con hook, servicio y mapper reales", () => {
  it("reproduce respuesta perdida y conserva la clave al cerrar, reabrir y reformatear teléfono", async () => {
    const committedKeys = new Set<string>();
    mockRegisterApi.mockImplementation(async (_dto, key) => {
      const isReplay = committedKeys.has(key);
      committedKeys.add(key);
      if (!isReplay && committedKeys.size === 1) throw buildAxiosError();
      return REGISTERED;
    });
    const user = userEvent.setup();
    renderDialog();

    await fillForm(user, "+51 (987) 654-321");
    await submit(user);
    await waitFor(() => expect(mockRegisterApi).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^registrar referido$/i })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: /cancelar/i }));
    await user.click(screen.getByRole("button", { name: /abrir registro/i }));
    await fillForm(user);
    await submit(user);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockRegisterApi.mock.calls.map(([, key]) => key)).toEqual([
      "referral-key-1",
      "referral-key-1",
    ]);
    expect(mockRegisterApi.mock.calls[0][0]).toEqual({
      businessName: "Zapatería Andes",
      email: "andes@example.com",
      phone: "+51987654321",
    });
    expect(mockRegisterApi.mock.calls[1][0]).toEqual(mockRegisterApi.mock.calls[0][0]);
    expect(committedKeys.size).toBe(1);
  });

  it("genera otra clave al cambiar el payload después de una respuesta perdida", async () => {
    mockRegisterApi.mockRejectedValueOnce(buildAxiosError()).mockResolvedValueOnce(REGISTERED);
    const user = userEvent.setup();
    renderDialog();

    await fillForm(user);
    await submit(user);
    await waitFor(() => expect(mockRegisterApi).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^registrar referido$/i })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: /cancelar/i }));
    await user.click(screen.getByRole("button", { name: /abrir registro/i }));
    await fillForm(user, "+51987654322");
    await submit(user);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockRegisterApi.mock.calls.map(([, key]) => key)).toEqual([
      "referral-key-1",
      "referral-key-2",
    ]);
    expect(mockRegisterApi.mock.calls[1][0].phone).toBe("+51987654322");
  });

  it("conserva A pendiente después de registrar B y volver a A", async () => {
    mockRegisterApi.mockRejectedValueOnce(buildAxiosError()).mockResolvedValue(REGISTERED);
    const user = userEvent.setup();
    renderDialog();

    await fillForm(user);
    await submit(user);
    await waitFor(() => expect(mockRegisterApi).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^registrar referido$/i })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: /cancelar/i }));
    await user.click(screen.getByRole("button", { name: /abrir registro/i }));
    await fillForm(user, "+51987654322");
    await submit(user);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /abrir registro/i }));
    await fillForm(user, "+51 (987) 654-321");
    await submit(user);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockRegisterApi.mock.calls.map(([, key]) => key)).toEqual([
      "referral-key-1",
      "referral-key-2",
      "referral-key-1",
    ]);
    expect(mockRegisterApi.mock.calls[2][0]).toEqual(mockRegisterApi.mock.calls[0][0]);
  });

  it("descarta la clave tras éxito confirmado aunque el siguiente registro use los mismos datos", async () => {
    mockRegisterApi.mockResolvedValue(REGISTERED);
    const user = userEvent.setup();
    renderDialog();

    await fillForm(user);
    await submit(user);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /abrir registro/i }));
    await fillForm(user);
    await submit(user);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockRegisterApi.mock.calls.map(([, key]) => key)).toEqual([
      "referral-key-1",
      "referral-key-2",
    ]);
  });

  it("recupera la misma clave tras desmontar y montar con respuesta previa perdida", async () => {
    mockRegisterApi.mockRejectedValueOnce(buildAxiosError()).mockResolvedValueOnce(REGISTERED);
    const user = userEvent.setup();
    const firstRender = renderDialog();
    await fillForm(user, "+51 (987) 654-321");
    await submit(user);
    await waitFor(() => expect(mockRegisterApi).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^registrar referido$/i })).toBeEnabled(),
    );
    firstRender.unmount();

    renderDialog();
    await fillForm(user);
    await submit(user);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockRegisterApi.mock.calls.map(([, key]) => key)).toEqual([
      "referral-key-1",
      "referral-key-1",
    ]);
  });

  it("no hace POST y avisa cuando sessionStorage está bloqueado", async () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const user = userEvent.setup();
    renderDialog();
    await fillForm(user);
    await submit(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(/el referido no se envió/i);
    expect(mockRegisterApi).not.toHaveBeenCalled();
  });

  it("no permite reenviar tras éxito si limpiar el journal escribe pero la verificación falla", async () => {
    const originalGetItem = Storage.prototype.getItem;
    let confirmed = false;
    let confirmationReads = 0;
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (confirmed && ++confirmationReads > 1) throw new DOMException("blocked", "SecurityError");
      return originalGetItem.call(this, key);
    });
    mockRegisterApi.mockImplementation(async () => {
      confirmed = true;
      return REGISTERED;
    });
    const user = userEvent.setup();
    renderDialog();
    await fillForm(user);
    await submit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(/el referido ya fue registrado/i);
    const button = screen.getByRole("button", { name: /^registrado$/i });
    expect(button).toBeDisabled();
    expect(screen.getByLabelText(/nombre del negocio/i)).toHaveValue("");
    expect(
      JSON.parse(originalGetItem.call(sessionStorage, manualReferralStorageKey("partner-user"))!)
        .entries,
    ).toEqual([]);
    await user.click(button);
    expect(mockRegisterApi).toHaveBeenCalledTimes(1);
  });
});
