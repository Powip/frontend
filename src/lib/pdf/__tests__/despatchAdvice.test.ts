/**
 * @jest-environment node
 */
import type { DespatchAdvice } from "@/features/sunat/despatch-advice/types/despatch-advice.types";
import { despatchAdvicePdfSpec } from "../despatchAdvice";

// FEAT-24 H12 — la guía impresa va a nombre del RUC que la emitió (multi-RUC).

const ADVICE = {
  id: "gre-1",
  sunatProfileId: "p-1",
  rucIssuer: "20111111111",
  documentType: "09",
  series: "T001",
  correlative: "00000001",
  number: "T001-00000001",
  issueDate: "2026-11-18",
  issueTime: "10:00:00",
  transferReason: "01",
  transportMode: "01",
  externalReference: "ORD-1001",
  status: "ACCEPTED",
  ticket: "tk",
  ticketReceivedAt: null,
  sunatCode: "0",
  sunatDescription: "Aceptada",
  observations: [],
  qrUrl: null,
  hasSignedXml: true,
  hasCdr: true,
  sendAttempts: 1,
  lastError: null,
  payload: {
    transferReason: "01",
    transportMode: "01",
    transferStartDate: "2026-11-18",
    grossWeightKg: 1.5,
    packageCount: 1,
    recipient: { identityDocumentType: "1", identityDocumentNumber: "45678912", name: "María Pérez" },
    origin: { ubigeo: "150101", address: "Jr. Puno 890" },
    destination: { ubigeo: "150122", address: "Av. Larco 123" },
    carrier: { ruc: "20100070970", name: "Olva Courier S.A.C." },
    items: [{ description: "Polo", quantity: 2, unitCode: "NIU" }],
  },
  createdAt: "2026-11-18T15:00:00Z",
  updatedAt: "2026-11-18T15:00:00Z",
} as DespatchAdvice;

describe("despatchAdvicePdfSpec — emisor", () => {
  it("pone el RUC, la razón social y la dirección del emisor en el encabezado", () => {
    const spec = despatchAdvicePdfSpec(ADVICE, { issuer: { ruc: "20111111111", razonSocial: "ACME S.A.C.", direccion: "Av. Arequipa 100" } });
    expect(spec.issuer).toEqual({ name: "ACME S.A.C.", ruc: "20111111111", address: "Av. Arequipa 100" });
    expect(spec.meta).toEqual(expect.arrayContaining([["Emisor", "ACME S.A.C. · RUC 20111111111"]]));
  });

  it("ignora un emisor de otro RUC: el documento no se pone a nombre equivocado", () => {
    const spec = despatchAdvicePdfSpec(ADVICE, { issuer: { ruc: "20222222222", razonSocial: "SEGUNDA E.I.R.L." } });
    expect(spec.issuer).toBeUndefined();
    expect(spec.meta).toEqual(expect.arrayContaining([["Emisor", "RUC 20111111111"]]));
  });

  it("sin dirección del emisor el encabezado va sin dirección (no usa la de la empresa)", () => {
    const spec = despatchAdvicePdfSpec(ADVICE, { issuer: { ruc: "20111111111", razonSocial: "ACME S.A.C.", direccion: "" } });
    expect(spec.issuer).toEqual({ name: "ACME S.A.C.", ruc: "20111111111", address: null });
  });
});
