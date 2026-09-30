/**
 * Tests: filterReferrals
 *
 * Comportamiento verificado:
 * 1. "all" devuelve la lista completa sin modificarla.
 * 2. "pagando" devuelve solo los referidos con status "pagando".
 * 3. "sin_activar" devuelve los que están en "registrado", "en_revision", "correo_enviado" o "cuenta_creada".
 * 4. "sin_pago" devuelve solo los que están en "activo_sin_pago".
 * 5. Un filtro que no matchea a nadie devuelve un array vacío, no undefined ni error.
 * 6. "desconocido" solo aparece en "all".
 */

import { filterReferrals } from "../referral-filters";
import type { PartnerReferral } from "@/features/partners/models/partner-referral";

function makeReferral(overrides: Partial<PartnerReferral>): PartnerReferral {
  return {
    id: "ref-1",
    businessName: "Negocio",
    origin: "link",
    status: "pagando",
    registeredAt: "2026-08-01",
    planName: "Standard",
    firstMonthCommission: null,
    recurringCommission: null,
    ...overrides,
  };
}

const REFERRALS: PartnerReferral[] = [
  makeReferral({ id: "1", status: "pagando" }),
  makeReferral({ id: "2", status: "correo_enviado" }),
  makeReferral({ id: "3", status: "cuenta_creada" }),
  makeReferral({ id: "4", status: "activo_sin_pago" }),
  makeReferral({ id: "5", status: "en_revision" }),
  makeReferral({ id: "6", status: "cancelado" }),
  makeReferral({ id: "7", status: "registrado" }),
  makeReferral({ id: "8", status: "desconocido" }),
];

describe("filterReferrals", () => {
  it('"all" devuelve todos los referidos', () => {
    expect(filterReferrals(REFERRALS, "all")).toHaveLength(REFERRALS.length);
  });

  it('"pagando" devuelve solo los que están pagando', () => {
    const result = filterReferrals(REFERRALS, "pagando");
    expect(result.map((r) => r.id)).toEqual(["1"]);
  });

  it('"sin_activar" devuelve registrado, en_revision, correo_enviado y cuenta_creada', () => {
    const result = filterReferrals(REFERRALS, "sin_activar");
    expect(result.map((r) => r.id).sort()).toEqual(["2", "3", "5", "7"]);
  });

  it('"sin_pago" devuelve solo activo_sin_pago', () => {
    const result = filterReferrals(REFERRALS, "sin_pago");
    expect(result.map((r) => r.id)).toEqual(["4"]);
  });

  it('"desconocido" solo aparece en "all"', () => {
    for (const filter of ["pagando", "sin_activar", "sin_pago"] as const) {
      expect(filterReferrals(REFERRALS, filter).some((r) => r.status === "desconocido")).toBe(false);
    }
  });

  it("un filtro sin coincidencias devuelve un array vacío", () => {
    const soloCancelados = [makeReferral({ id: "1", status: "cancelado" })];
    expect(filterReferrals(soloCancelados, "pagando")).toEqual([]);
  });
});
