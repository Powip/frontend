/**
 * Tests: RegisterReferralDialog
 *
 * Comportamiento verificado:
 * 1. Al enviar el formulario vacío, muestra los mensajes de validación (nombre, correo)
 *    y NO llama a la mutación.
 * 2. Un correo con formato inválido muestra "Ingresa un correo válido" y no envía.
 * 3. Con datos válidos, la mutación recibe los valores del formulario (sin plan) y una Idempotency-Key.
 * 4. La selección de plan está bloqueada y explica por qué.
 * 5. Reintentar con los mismos datos reutiliza la Idempotency-Key; cambiar los datos genera otra.
 * 6. El botón "Cancelar" llama a onClose sin invocar la mutación.
 * 7. Mientras la mutación está en curso (isPending), el botón de submit se deshabilita
 *    y muestra el texto de carga.
 */

import React from "react";
import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import { RegisterReferralDialog } from "../register-referral-dialog";
import { useRegisterReferral } from "@/features/partners/hooks/use-register-referral";
import { createIdempotencyKey } from "@/features/partners/utils/create-idempotency-key";

jest.mock("@/features/partners/hooks/use-register-referral", () => ({
  useRegisterReferral: jest.fn(),
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));

jest.mock("@/features/partners/utils/create-idempotency-key", () => ({
  createIdempotencyKey: jest.fn(),
}));

jest.mock("@/components/ui/select", () => {
  const Select = ({ disabled }: { disabled?: boolean; children?: React.ReactNode }) => (
    <select aria-label="Plan que le interesa" disabled={disabled} />
  );
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

  return {
    Select,
    SelectContent: Passthrough,
    SelectTrigger: Passthrough,
    SelectValue: Passthrough,
  };
});

const mockUseRegisterReferral = jest.mocked(useRegisterReferral);
const mockCreateIdempotencyKey = jest.mocked(createIdempotencyKey);

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  Object.defineProperty(globalThis, "TextEncoder", { value: TextEncoder, configurable: true });
});

function setupMutation(overrides: Partial<ReturnType<typeof useRegisterReferral>> = {}) {
  const mutate = jest.fn();
  mockUseRegisterReferral.mockReturnValue({
    mutate,
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useRegisterReferral>);
  return mutate;
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/nombre del negocio/i), "Zapatería Andes");
  await user.type(screen.getByLabelText(/correo del negocio/i), "andes@mail.com");
}

describe("RegisterReferralDialog", () => {
  beforeEach(() => {
    let counter = 0;
    sessionStorage.clear();
    jest
      .mocked(useAuth)
      .mockReturnValue({ auth: { user: { id: "partner-user" } } } as unknown as ReturnType<
        typeof useAuth
      >);
    mockUseRegisterReferral.mockReset();
    mockCreateIdempotencyKey.mockReset();
    mockCreateIdempotencyKey.mockImplementation(() => `referral-key-${++counter}`);
  });

  it("muestra mensajes de validación con el formulario vacío y no llama a la mutación", async () => {
    const mutate = setupMutation();
    const user = userEvent.setup();

    render(<RegisterReferralDialog isOpen={true} onClose={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: /registrar referido/i }));

    expect(await screen.findByText(/el nombre del negocio es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/el correo es obligatorio/i)).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("muestra error de formato cuando el correo es inválido", async () => {
    setupMutation();
    const user = userEvent.setup();

    render(<RegisterReferralDialog isOpen={true} onClose={jest.fn()} />);
    await user.type(screen.getByLabelText(/nombre del negocio/i), "Zapatería Andes");
    await user.type(screen.getByLabelText(/correo del negocio/i), "no-es-un-correo");
    await user.click(screen.getByRole("button", { name: /registrar referido/i }));

    expect(await screen.findByText(/ingresa un correo válido/i)).toBeInTheDocument();
  });

  it("llama a la mutación con los valores del formulario, sin plan, y una Idempotency-Key", async () => {
    const mutate = setupMutation();
    const user = userEvent.setup();

    render(<RegisterReferralDialog isOpen={true} onClose={jest.fn()} />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /registrar referido/i }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        {
          values: { businessName: "Zapatería Andes", email: "andes@mail.com", phone: "" },
          idempotencyKey: "referral-key-1",
        },
        expect.anything(),
      ),
    );
    const [{ values }] = mutate.mock.calls[0];
    expect(values).not.toHaveProperty("planValue");
    expect(values).not.toHaveProperty("planId");
  });

  it("bloquea la selección de plan y explica el motivo", () => {
    setupMutation();

    render(<RegisterReferralDialog isOpen={true} onClose={jest.fn()} />);

    expect(screen.getByRole("combobox", { name: /plan que le interesa/i })).toBeDisabled();
    expect(screen.getByText(/falta el identificador del plan/i)).toBeInTheDocument();
  });

  it("reutiliza la Idempotency-Key al reintentar con los mismos datos", async () => {
    const mutate = setupMutation();
    const user = userEvent.setup();

    render(<RegisterReferralDialog isOpen={true} onClose={jest.fn()} />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /registrar referido/i }));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /registrar referido/i })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: /registrar referido/i }));

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
    expect(mutate.mock.calls[1][0].idempotencyKey).toBe(mutate.mock.calls[0][0].idempotencyKey);
  });

  it("genera otra Idempotency-Key si el usuario cambia los datos antes de reintentar", async () => {
    const mutate = setupMutation();
    const user = userEvent.setup();

    render(<RegisterReferralDialog isOpen={true} onClose={jest.fn()} />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /registrar referido/i }));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /registrar referido/i })).toBeEnabled(),
    );
    await user.type(screen.getByLabelText(/teléfono/i), "+51987654321");
    await user.click(screen.getByRole("button", { name: /registrar referido/i }));

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
    expect(mutate.mock.calls[1][0].idempotencyKey).not.toBe(mutate.mock.calls[0][0].idempotencyKey);
  });

  it('el botón "Cancelar" llama a onClose sin invocar la mutación', async () => {
    const mutate = setupMutation();
    const onClose = jest.fn();
    const user = userEvent.setup();

    render(<RegisterReferralDialog isOpen={true} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("deshabilita el submit y muestra el texto de carga mientras isPending es true", () => {
    setupMutation({ isPending: true });

    render(<RegisterReferralDialog isOpen={true} onClose={jest.fn()} />);

    const submitButton = screen.getByRole("button", { name: /registrando/i });
    expect(submitButton).toBeDisabled();
  });
});
