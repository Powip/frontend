/**
 * Tests: EditPayoutSettingsDialog
 *
 * Comportamiento verificado:
 * 1. Al abrir, precarga el formulario con los datos actuales (currentSettings).
 * 2. Enviar con el número/cuenta vacío muestra el error de validación y no llama a la mutación.
 * 3. Con datos válidos, la mutación se llama con los valores exactos.
 * 4. "Cancelar" llama a onClose sin invocar la mutación.
 * 5. Mientras isPending es true, el submit se deshabilita y muestra el texto de carga.
 */

import { CancelledError } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { usePayoutSettings } from "@/features/partners/hooks/use-payout-settings";
import { useUpdatePayoutSettings } from "@/features/partners/hooks/use-update-payout-settings";
import type { PayoutSettings } from "@/features/partners/models/payout-settings";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import { EditPayoutSettingsDialog } from "../edit-payout-settings-dialog";

jest.mock("@/features/partners/hooks/use-update-payout-settings", () => ({
  useUpdatePayoutSettings: jest.fn(),
}));
jest.mock("@/features/partners/hooks/use-payout-settings", () => ({
  usePayoutSettings: jest.fn(),
}));

jest.mock("@/components/ui/select", () => {
  const ReactLib = jest.requireActual<typeof import("react")>("react");

  function extractText(node: unknown): string {
    if (node === null || node === undefined) return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (typeof node === "boolean") return "";
    if (Array.isArray(node)) return node.map(extractText).join("");
    if (typeof node === "object" && node !== null && "props" in node) {
      const el = node as { props: { children?: unknown } };
      return extractText(el.props.children);
    }
    return "";
  }

  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children?: React.ReactNode;
  }) => {
    const options: { value: string; label: string }[] = [];
    ReactLib.Children.forEach(children, (child) => {
      if (!ReactLib.isValidElement<{ children?: React.ReactNode }>(child)) return;
      if (child.props.children) {
        ReactLib.Children.forEach(child.props.children, (item) => {
          if (
            ReactLib.isValidElement<{ value?: string; children?: React.ReactNode }>(item) &&
            item.props.value !== undefined
          ) {
            options.push({ value: item.props.value, label: extractText(item.props.children) });
          }
        });
      }
    });
    return (
      <select
        aria-label="Método"
        value={value ?? ""}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  };

  const SelectContent = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectItem = ({ value, children }: { value: string; children?: React.ReactNode }) => (
    <option value={value}>{children}</option>
  );
  const SelectTrigger = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>;

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

const mockUseUpdatePayoutSettings = jest.mocked(useUpdatePayoutSettings);
const mockUsePayoutSettings = jest.mocked(usePayoutSettings);
let readSession: { userId: string; epoch: number; denied: Error | null; assertCurrent: jest.Mock };
let refetch: jest.Mock;

const CURRENT_SETTINGS: PayoutSettings = {
  method: "yape",
  accountNumber: "987 654 321",
  accountHolder: "Joel Coila",
  version: 4,
  updatedAt: "2026-10-01T00:00:00Z",
};

function setupMutation(overrides: Partial<ReturnType<typeof useUpdatePayoutSettings>> = {}) {
  const mutate = jest.fn();
  mockUseUpdatePayoutSettings.mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  } as unknown as ReturnType<typeof useUpdatePayoutSettings>);
  return mutate;
}

describe("EditPayoutSettingsDialog", () => {
  beforeEach(() => {
    mockUseUpdatePayoutSettings.mockReset();
    readSession = {
      userId: "11111111-1111-4111-8111-111111111111",
      epoch: 1,
      denied: null,
      assertCurrent: jest.fn(),
    };
    refetch = jest.fn().mockResolvedValue({ data: CURRENT_SETTINGS, error: null });
    mockUsePayoutSettings.mockImplementation(
      () => ({ session: readSession, refetch }) as unknown as ReturnType<typeof usePayoutSettings>,
    );
  });

  it("precarga el formulario con los datos actuales al abrir", () => {
    setupMutation();
    render(
      <EditPayoutSettingsDialog
        isOpen={true}
        onClose={jest.fn()}
        currentSettings={CURRENT_SETTINGS}
      />,
    );
    expect(screen.getByDisplayValue("987 654 321")).toBeInTheDocument();
  });

  it("muestra error de validación cuando el número/cuenta está vacío y no llama a la mutación", async () => {
    const mutate = setupMutation();
    const user = userEvent.setup();

    render(
      <EditPayoutSettingsDialog
        isOpen={true}
        onClose={jest.fn()}
        currentSettings={CURRENT_SETTINGS}
      />,
    );
    await user.clear(screen.getByLabelText(/número \/ cuenta/i));
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByText(/el número o cuenta es obligatorio/i)).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("llama a la mutación con los valores exactos cuando el formulario es válido", async () => {
    const mutate = setupMutation();
    const user = userEvent.setup();

    render(
      <EditPayoutSettingsDialog
        isOpen={true}
        onClose={jest.fn()}
        currentSettings={CURRENT_SETTINGS}
      />,
    );
    await user.clear(screen.getByLabelText(/número \/ cuenta/i));
    await user.type(screen.getByLabelText(/número \/ cuenta/i), "999 111 222");
    await user.selectOptions(screen.getByRole("combobox"), "plin");
    await user.type(screen.getByLabelText(/motivo del cambio/i), "Cuenta propia actualizada");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(mutate).toHaveBeenCalledWith(
      {
        method: "plin",
        accountNumber: "999 111 222",
        accountHolder: "Joel Coila",
        expectedVersion: 4,
        reason: "Cuenta propia actualizada",
      },
      expect.anything(),
    );
  });

  it('"Cancelar" llama a onClose sin invocar la mutación', async () => {
    const mutate = setupMutation();
    const onClose = jest.fn();
    const user = userEvent.setup();

    render(
      <EditPayoutSettingsDialog
        isOpen={true}
        onClose={onClose}
        currentSettings={CURRENT_SETTINGS}
      />,
    );
    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("deshabilita el submit y muestra el texto de carga mientras isPending es true", () => {
    setupMutation({ isPending: true });
    render(
      <EditPayoutSettingsDialog
        isOpen={true}
        onClose={jest.fn()}
        currentSettings={CURRENT_SETTINGS}
      />,
    );
    expect(screen.getByRole("button", { name: /guardando/i })).toBeDisabled();
  });

  it("fija el baseline al abrir y no adopta silenciosamente una versión recibida mientras se edita", async () => {
    const mutate = setupMutation();
    const user = userEvent.setup();
    const props = { isOpen: true, onClose: jest.fn(), currentSettings: CURRENT_SETTINGS };
    const { rerender } = render(<EditPayoutSettingsDialog {...props} />);
    await user.clear(screen.getByLabelText(/número \/ cuenta/i));
    await user.type(screen.getByLabelText(/número \/ cuenta/i), "Cuenta editada");
    rerender(
      <EditPayoutSettingsDialog
        {...props}
        currentSettings={{ ...CURRENT_SETTINGS, accountNumber: "Cuenta externa", version: 5 }}
      />,
    );
    expect(screen.getByLabelText(/número \/ cuenta/i)).toHaveValue("Cuenta editada");
    await user.type(screen.getByLabelText(/motivo del cambio/i), "Cambio propio");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));
    expect(mutate.mock.calls[0][0]).toMatchObject({
      accountNumber: "Cuenta editada",
      expectedVersion: 4,
      reason: "Cambio propio",
    });
  });

  it("conserva y reintenta exactamente el intento desconocido pese GET background y cierre/reapertura", async () => {
    const mutate = setupMutation();
    const onClose = jest.fn();
    const user = userEvent.setup();
    const props = { isOpen: true, onClose, currentSettings: CURRENT_SETTINGS };
    const { rerender } = render(<EditPayoutSettingsDialog {...props} />);
    await user.type(screen.getByLabelText(/motivo del cambio/i), "Motivo original protegido");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));
    const original = mutate.mock.calls[0][0];
    const oldCallback = mutate.mock.calls[0][1].onSuccess;
    expect(Object.isFrozen(original)).toBe(true);
    setupMutation({ mutate, isError: true, error: new Error("Response lost after commit") });
    const updated = {
      ...CURRENT_SETTINGS,
      accountNumber: "GET posterior",
      accountHolder: "Titular posterior",
      version: 5,
    };
    rerender(<EditPayoutSettingsDialog {...props} currentSettings={updated} />);
    expect(screen.getByLabelText(/número \/ cuenta/i)).toHaveValue(CURRENT_SETTINGS.accountNumber);
    expect(screen.getByLabelText(/motivo del cambio/i)).toHaveValue(original.reason);
    expect(screen.getByLabelText(/número \/ cuenta/i)).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<EditPayoutSettingsDialog {...props} isOpen={false} currentSettings={updated} />);
    rerender(<EditPayoutSettingsDialog {...props} currentSettings={updated} />);
    await act(async () => {
      oldCallback();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: /reintentar misma solicitud/i }));
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mutate.mock.calls[1][0]).toBe(original);
    expect(mutate.mock.calls[1][0]).toMatchObject({
      expectedVersion: 4,
      reason: "Motivo original protegido",
    });
  });

  it.each([
    new Error("GET unavailable"),
    new CancelledError({ silent: true }),
    buildAxiosError(403),
  ])("un GET de reconciliación fallido conserva el intento original: %#", async (error) => {
    const mutate = setupMutation();
    const user = userEvent.setup();
    const props = { isOpen: true, onClose: jest.fn(), currentSettings: CURRENT_SETTINGS };
    const { rerender } = render(<EditPayoutSettingsDialog {...props} />);
    await user.type(screen.getByLabelText(/motivo del cambio/i), "Motivo a conservar");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));
    const original = mutate.mock.calls[0][0];
    setupMutation({ mutate, isError: true, error: new Error("Response lost") });
    rerender(<EditPayoutSettingsDialog {...props} />);
    refetch.mockRejectedValueOnce(error);
    await user.click(screen.getByRole("button", { name: /revisar datos guardados/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /reintentar misma solicitud/i })).toBeEnabled(),
    );
    expect(refetch).toHaveBeenCalledWith({ throwOnError: true });
    await user.click(screen.getByRole("button", { name: /reintentar misma solicitud/i }));
    expect(mutate.mock.calls[1][0]).toBe(original);
  });

  it("solo adopta datos y versión del GET exitoso explícito, no props anteriores", async () => {
    const mutate = setupMutation();
    const user = userEvent.setup();
    const props = { isOpen: true, onClose: jest.fn(), currentSettings: CURRENT_SETTINGS };
    const { rerender } = render(<EditPayoutSettingsDialog {...props} />);
    await user.type(screen.getByLabelText(/motivo del cambio/i), "Intento desconocido");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));
    setupMutation({ mutate, isError: true, error: new Error("Response lost") });
    rerender(<EditPayoutSettingsDialog {...props} />);
    const latest = {
      ...CURRENT_SETTINGS,
      method: "plin" as const,
      accountNumber: "Cuenta realmente guardada",
      accountHolder: "Titular actual",
      version: 9,
    };
    refetch.mockResolvedValueOnce({ data: latest, error: null });
    await user.click(screen.getByRole("button", { name: /revisar datos guardados/i }));
    await waitFor(() =>
      expect(screen.getByLabelText(/número \/ cuenta/i)).toHaveValue(latest.accountNumber),
    );
    expect(screen.getByLabelText(/número \/ cuenta/i)).toBeEnabled();
    expect(screen.getByLabelText(/motivo del cambio/i)).toHaveValue("");
    await user.type(screen.getByLabelText(/motivo del cambio/i), "Nueva solicitud explícita");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));
    expect(mutate.mock.calls[1][0]).toMatchObject({
      method: "plin",
      accountNumber: latest.accountNumber,
      expectedVersion: 9,
      reason: "Nueva solicitud explícita",
    });
  });

  it("no adopta una reconciliación ni ejecuta callback de la identidad anterior", async () => {
    const mutate = setupMutation();
    const onClose = jest.fn();
    const user = userEvent.setup();
    const props = { isOpen: true, onClose, currentSettings: CURRENT_SETTINGS };
    const { rerender } = render(<EditPayoutSettingsDialog {...props} />);
    await user.type(screen.getByLabelText(/motivo del cambio/i), "Intento de A");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));
    const oldCallback = mutate.mock.calls[0][1].onSuccess;
    setupMutation({ mutate, isError: true, error: new Error("Response lost") });
    rerender(<EditPayoutSettingsDialog {...props} />);
    let complete!: (value: { data: PayoutSettings; error: null }) => void;
    refetch.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    await user.click(screen.getByRole("button", { name: /revisar datos guardados/i }));
    readSession = { ...readSession, userId: "22222222-2222-4222-8222-222222222222", epoch: 2 };
    const ownB = { ...CURRENT_SETTINGS, accountNumber: "Cuenta B", version: 7 };
    rerender(<EditPayoutSettingsDialog {...props} currentSettings={ownB} />);
    await act(async () => {
      complete({ data: CURRENT_SETTINGS, error: null });
      oldCallback();
    });
    expect(screen.getByLabelText(/número \/ cuenta/i)).toHaveValue("Cuenta B");
    expect(screen.getByLabelText(/motivo del cambio/i)).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: /reintentar misma solicitud/i }),
    ).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("oculta campos sensibles y bloquea retry al perder acceso durante un intento desconocido", async () => {
    const mutate = setupMutation();
    const user = userEvent.setup();
    const props = { isOpen: true, onClose: jest.fn(), currentSettings: CURRENT_SETTINGS };
    const { rerender } = render(<EditPayoutSettingsDialog {...props} />);
    await user.type(screen.getByLabelText(/motivo del cambio/i), "Motivo protegido");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));
    setupMutation({ mutate, isError: true, error: new Error("Response lost") });
    readSession = { ...readSession, denied: buildAxiosError(403) };
    rerender(<EditPayoutSettingsDialog {...props} currentSettings={undefined} />);
    expect(screen.getByLabelText(/número \/ cuenta/i)).toHaveValue("");
    expect(screen.getByLabelText(/titular/i)).toHaveValue("");
    expect(screen.getByLabelText(/motivo del cambio/i)).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: /reintentar misma solicitud/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^guardar$/i })).toBeDisabled();
  });
});
