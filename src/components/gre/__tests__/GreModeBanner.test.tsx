/**
 * Tests: aviso de modo de pruebas de la guía de remisión (FEAT-24 H12-D6).
 * Se muestra mientras ms-sunat no envía a SUNAT o falten credenciales GRE; con SUNAT y credenciales, nada.
 */

import { render, screen } from "@testing-library/react";
import type { GreSettings } from "@/features/sunat/despatch-advice/types/despatch-advice.types";
import { GreModeBanner } from "../GreModeBanner";

const profile = (sunatProfileId: string, configured: boolean) => ({
  sunatProfileId,
  ruc: "20111111111",
  razonSocial: "ACME",
  isDefault: false,
  isActive: true,
  configured,
  clientId: configured ? "cid" : null,
  series: configured ? "T001" : null,
  nextCorrelative: configured ? 1 : null,
  updatedAt: null,
});

const settings = (
  sunatConnection: GreSettings["sunatConnection"],
  configured = true,
  enabledForCompany = true,
  autoEnableByCredentials = true,
): GreSettings => ({
  sunatConnection,
  enabledForCompany,
  autoEnableByCredentials,
  profiles: [profile("p-1", configured), profile("p-2", false)],
});

describe("GreModeBanner", () => {
  it("no muestra nada mientras carga ni con SUNAT y credenciales", () => {
    const { rerender } = render(<GreModeBanner settings={undefined} />);
    expect(screen.queryByTestId("gre-mode-banner")).not.toBeInTheDocument();
    rerender(<GreModeBanner settings={settings("SUNAT_PRODUCTION")} />);
    expect(screen.queryByTestId("gre-mode-banner")).not.toBeInTheDocument();
  });

  it("sin conexión con SUNAT: modo de pruebas y empresa piloto", () => {
    render(<GreModeBanner settings={settings("NOT_CONFIGURED")} />);
    expect(screen.getByTestId("gre-mode-banner")).toHaveTextContent("Guías de remisión en modo de pruebas.");
    expect(screen.getByTestId("gre-mode-banner")).toHaveTextContent("La emisión real de guías de remisión se habilita con la empresa piloto.");
  });

  it("contra un simulador avisa que las guías no sirven para trasladar", () => {
    render(<GreModeBanner settings={settings("OTHER")} />);
    expect(screen.getByTestId("gre-mode-banner")).toHaveTextContent("no sirven para trasladar mercadería");
  });

  it("modo solo lista: con SUNAT producción y la empresa fuera de la lista dice que todavía no está habilitada", () => {
    render(<GreModeBanner settings={settings("SUNAT_PRODUCTION", true, false, false)} />);
    expect(screen.getByTestId("gre-mode-banner")).toHaveTextContent("La guía de remisión electrónica todavía no está habilitada para tu empresa.");
  });

  it("habilitación automática: sin credenciales y no habilitada pide cargarlas, no dice «todavía no está habilitada»", () => {
    render(<GreModeBanner settings={settings("SUNAT_PRODUCTION", false, false, true)} />);
    const banner = screen.getByTestId("gre-mode-banner");
    expect(banner).toHaveTextContent("Falta configurar las credenciales GRE.");
    expect(banner).not.toHaveTextContent("todavía no está habilitada");
    expect(banner).toHaveTextContent("Con las credenciales completas, la emisión se habilita sola.");
  });

  it("con SUNAT pero sin credenciales (o el RUC elegido sin ellas) pide cargarlas", () => {
    const { rerender } = render(<GreModeBanner settings={settings("SUNAT_PRODUCTION", false)} />);
    expect(screen.getByTestId("gre-mode-banner")).toHaveTextContent("Falta configurar las credenciales GRE.");
    rerender(<GreModeBanner settings={settings("SUNAT_PRODUCTION")} sunatProfileId="p-2" />);
    expect(screen.getByTestId("gre-mode-banner")).toHaveTextContent("Este RUC no tiene credenciales GRE.");
    rerender(<GreModeBanner settings={settings("SUNAT_PRODUCTION")} sunatProfileId="p-1" />);
    expect(screen.queryByTestId("gre-mode-banner")).not.toBeInTheDocument();
  });
});
