/**
 * Tests: ReferralStatusBadge
 *
 * Comportamiento verificado:
 * 1. Muestra la etiqueta correcta para cada valor de ReferralStatus.
 * 2. No comunica el estado únicamente por color: cada estado tiene un texto distinto y legible.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { ReferralStatusBadge } from "../referral-status-badge";
import { REFERRAL_STATUSES } from "@/features/partners/models/referral-status.enum";
import type { ReferralStatus } from "@/features/partners/models/referral-status.enum";

describe("ReferralStatusBadge", () => {
  const cases: [ReferralStatus, string][] = [
    ["correo_enviado", "Correo enviado"],
    ["cuenta_creada", "Cuenta creada"],
    ["activo_sin_pago", "Activó · sin pago"],
    ["en_revision", "En revisión"],
    ["pagando", "Pagó · activa"],
    ["cancelado", "Canceló"],
  ];

  test.each(cases)('estado "%s" muestra la etiqueta "%s"', (status, label) => {
    render(<ReferralStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("cubre todos los valores declarados en ReferralStatus", () => {
    expect(cases.map(([status]) => status).sort()).toEqual([...REFERRAL_STATUSES].sort());
  });

  it("cada estado tiene una etiqueta de texto distinta", () => {
    const labels = cases.map(([, label]) => label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
