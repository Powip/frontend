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

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditPayoutSettingsDialog } from "../edit-payout-settings-dialog";
import { useUpdatePayoutSettings } from "@/features/partners/hooks/use-update-payout-settings";
import type { PayoutSettings } from "@/features/partners/models/payout-settings";

jest.mock("@/features/partners/hooks/use-update-payout-settings", () => ({
  useUpdatePayoutSettings: jest.fn(),
}));

jest.mock("@/components/ui/select", () => {
  const ReactLib = require("react");

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
    ReactLib.Children.forEach(children, (child: React.ReactElement<{ children?: React.ReactNode }>) => {
      if (!child || !child.props) return;
      if (child.props.children) {
        ReactLib.Children.forEach(
          child.props.children,
          (item: React.ReactElement<{ value?: string; children?: React.ReactNode }>) => {
            if (item && item.props && item.props.value !== undefined) {
              options.push({ value: item.props.value, label: extractText(item.props.children) });
            }
          },
        );
      }
    });
    return (
      <select aria-label="Método" value={value ?? ""} onChange={(e) => onValueChange?.(e.target.value)}>
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

const CURRENT_SETTINGS: PayoutSettings = {
  method: "yape",
  accountNumber: "987 654 321",
  accountHolder: "Joel Coila",
  minimumThreshold: 50,
};

function setupMutation(overrides: Partial<ReturnType<typeof useUpdatePayoutSettings>> = {}) {
  const mutate = jest.fn();
  mockUseUpdatePayoutSettings.mockReturnValue({
    mutate,
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useUpdatePayoutSettings>);
  return mutate;
}

describe("EditPayoutSettingsDialog", () => {
  beforeEach(() => {
    mockUseUpdatePayoutSettings.mockReset();
  });

  it("precarga el formulario con los datos actuales al abrir", () => {
    setupMutation();
    render(
      <EditPayoutSettingsDialog isOpen={true} onClose={jest.fn()} currentSettings={CURRENT_SETTINGS} />,
    );
    expect(screen.getByDisplayValue("987 654 321")).toBeInTheDocument();
  });

  it("muestra error de validación cuando el número/cuenta está vacío y no llama a la mutación", async () => {
    const mutate = setupMutation();
    const user = userEvent.setup();

    render(
      <EditPayoutSettingsDialog isOpen={true} onClose={jest.fn()} currentSettings={CURRENT_SETTINGS} />,
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
      <EditPayoutSettingsDialog isOpen={true} onClose={jest.fn()} currentSettings={CURRENT_SETTINGS} />,
    );
    await user.clear(screen.getByLabelText(/número \/ cuenta/i));
    await user.type(screen.getByLabelText(/número \/ cuenta/i), "999 111 222");
    await user.selectOptions(screen.getByRole("combobox"), "plin");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ method: "plin", accountNumber: "999 111 222" }),
      expect.anything(),
    );
  });

  it('"Cancelar" llama a onClose sin invocar la mutación', async () => {
    const mutate = setupMutation();
    const onClose = jest.fn();
    const user = userEvent.setup();

    render(
      <EditPayoutSettingsDialog isOpen={true} onClose={onClose} currentSettings={CURRENT_SETTINGS} />,
    );
    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("deshabilita el submit y muestra el texto de carga mientras isPending es true", () => {
    setupMutation({ isPending: true });
    render(
      <EditPayoutSettingsDialog isOpen={true} onClose={jest.fn()} currentSettings={CURRENT_SETTINGS} />,
    );
    expect(screen.getByRole("button", { name: /guardando/i })).toBeDisabled();
  });
});
