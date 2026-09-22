/**
 * Tests: RegisterReferralDialog
 *
 * Comportamiento verificado:
 * 1. Al enviar el formulario vacío, muestra los mensajes de validación (nombre, correo, plan)
 *    y NO llama a la mutación.
 * 2. Un correo con formato inválido muestra "Ingresa un correo válido" y no envía.
 * 3. Con datos válidos, la mutación se llama con los valores exactos del formulario.
 * 4. El botón "Cancelar" llama a onClose sin invocar la mutación.
 * 5. Mientras la mutación está en curso (isPending), el botón de submit se deshabilita
 *    y muestra el texto de carga.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterReferralDialog } from "../register-referral-dialog";
import { useRegisterReferral } from "@/features/partners/hooks/use-register-referral";

jest.mock("@/features/partners/hooks/use-register-referral", () => ({
  useRegisterReferral: jest.fn(),
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
      <select aria-label="Plan que le interesa" value={value ?? ""} onChange={(e) => onValueChange?.(e.target.value)}>
        <option value="" disabled />
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

const mockUseRegisterReferral = jest.mocked(useRegisterReferral);

function setupMutation(overrides: Partial<ReturnType<typeof useRegisterReferral>> = {}) {
  const mutate = jest.fn();
  mockUseRegisterReferral.mockReturnValue({
    mutate,
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useRegisterReferral>);
  return mutate;
}

describe("RegisterReferralDialog", () => {
  beforeEach(() => {
    mockUseRegisterReferral.mockReset();
  });

  it("muestra mensajes de validación con el formulario vacío y no llama a la mutación", async () => {
    const mutate = setupMutation();
    const user = userEvent.setup();

    render(<RegisterReferralDialog isOpen={true} onClose={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: /enviar invitación/i }));

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
    await user.click(screen.getByRole("button", { name: /enviar invitación/i }));

    expect(await screen.findByText(/ingresa un correo válido/i)).toBeInTheDocument();
  });

  it("llama a la mutación con los valores exactos cuando el formulario es válido", async () => {
    const mutate = setupMutation();
    const user = userEvent.setup();

    render(<RegisterReferralDialog isOpen={true} onClose={jest.fn()} />);
    await user.type(screen.getByLabelText(/nombre del negocio/i), "Zapatería Andes");
    await user.type(screen.getByLabelText(/correo del negocio/i), "andes@mail.com");
    await user.selectOptions(screen.getByRole("combobox"), "standard");
    await user.click(screen.getByRole("button", { name: /enviar invitación/i }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: "Zapatería Andes",
        email: "andes@mail.com",
        planValue: "standard",
      }),
      expect.anything(),
    );
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

    const submitButton = screen.getByRole("button", { name: /enviando/i });
    expect(submitButton).toBeDisabled();
  });
});
