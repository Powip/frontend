/**
 * Tests: CommissionSimulator
 *
 * Comportamiento verificado:
 * 1. Muestra el disclaimer de que es una estimación, no la comisión real.
 * 2. Con los valores por defecto, calcula y muestra el total proyectado.
 * 3. Cambiar la cantidad de referidos recalcula el total mostrado.
 * 4. Cambiar el plan seleccionado recalcula el total mostrado.
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommissionSimulator } from "../commission-simulator";
import { COMMISSION_OPTIONS_MOCK } from "@/features/partners/mocks/commission-options.mock";
import { estimateCommissionEarnings } from "@/features/partners/utils/estimate-commission-earnings";
import { formatSoles } from "@/features/partners/utils/format-currency";

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
      <select aria-label="Plan promedio" value={value ?? ""} onChange={(e) => onValueChange?.(e.target.value)}>
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
  const SelectValue = () => null;

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

const OPTION_A = COMMISSION_OPTIONS_MOCK.find((option) => option.code === "A")!;

describe("CommissionSimulator", () => {
  it("muestra el disclaimer de que es una estimación", () => {
    render(<CommissionSimulator options={COMMISSION_OPTIONS_MOCK} selectedCode="A" discountPct={10} />);
    expect(screen.getByText(/es una/i)).toBeInTheDocument();
    expect(screen.getByText(/estimación/i)).toBeInTheDocument();
    expect(screen.getByText(/no es tu comisión real/i)).toBeInTheDocument();
  });

  it("calcula el total proyectado con los valores por defecto", () => {
    render(<CommissionSimulator options={COMMISSION_OPTIONS_MOCK} selectedCode="A" discountPct={10} />);

    const expected = estimateCommissionEarnings({
      referralsCount: 10,
      monthlyPlanPrice: 189,
      retentionMonths: 18,
      firstMonthPct: OPTION_A.firstMonthPct,
      recurringPct: OPTION_A.recurringPct,
      discountPct: 10,
    });

    expect(screen.getByText(formatSoles(expected.projectedTotal))).toBeInTheDocument();
  });

  it("cambiar la cantidad de referidos recalcula el total mostrado", () => {
    render(<CommissionSimulator options={COMMISSION_OPTIONS_MOCK} selectedCode="A" discountPct={10} />);

    const input = screen.getByLabelText(/cuántos negocios referís/i);
    fireEvent.change(input, { target: { value: "20" } });

    const expected = estimateCommissionEarnings({
      referralsCount: 20,
      monthlyPlanPrice: 189,
      retentionMonths: 18,
      firstMonthPct: OPTION_A.firstMonthPct,
      recurringPct: OPTION_A.recurringPct,
      discountPct: 10,
    });

    expect(screen.getByText(formatSoles(expected.projectedTotal))).toBeInTheDocument();
  });

  it("cambiar el plan seleccionado recalcula el total mostrado", async () => {
    const user = userEvent.setup();
    render(<CommissionSimulator options={COMMISSION_OPTIONS_MOCK} selectedCode="A" discountPct={10} />);

    await user.selectOptions(screen.getByRole("combobox"), "full");

    const expected = estimateCommissionEarnings({
      referralsCount: 10,
      monthlyPlanPrice: 269,
      retentionMonths: 18,
      firstMonthPct: OPTION_A.firstMonthPct,
      recurringPct: OPTION_A.recurringPct,
      discountPct: 10,
    });

    expect(screen.getByText(formatSoles(expected.projectedTotal))).toBeInTheDocument();
  });
});
