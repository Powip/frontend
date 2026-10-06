/**
 * Tests: HelpSection / HelpHeaderLink (app/configuracion/_components/HelpSection.tsx)
 *
 * Comportamiento verificado:
 * 1. Renderiza los tres bloques (Centro de ayuda, Reunión virtual, WhatsApp)
 *    como regiones con su título accesible y textos de la captura.
 * 2. "Ir al Centro de ayuda", "Agendar reunión" y "Abrir WhatsApp" enlazan a
 *    sus destinos en pestaña nueva con rel="noopener noreferrer".
 * 3. "¿Necesitas ayuda?" enlaza al Centro de ayuda en pestaña nueva.
 */
import { render, screen, within } from "@testing-library/react";
import { HelpHeaderLink, HelpSection } from "../HelpSection";

const HELP_URL = "https://www.powip.lat/centro-de-ayuda";

describe("HelpSection", () => {
  it("muestra los tres bloques con sus textos", () => {
    render(<HelpSection />);

    const help = screen.getByRole("region", { name: "Centro de ayuda" });
    expect(within(help).getByText("APRENDE A TU RITMO")).toBeInTheDocument();
    expect(within(help).getByText("Todo Powip en videos, paso a paso")).toBeInTheDocument();
    expect(
      within(help).getByText(
        "Encuentra guías, tutoriales y recursos para gestionar pedidos, productos, pagos, envíos, clientes e integraciones."
      )
    ).toBeInTheDocument();
    expect(within(help).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Videos paso a paso",
      "Guías rápidas",
      "Disponible 24/7",
    ]);

    const meeting = screen.getByRole("region", { name: "Reunión virtual con nuestro equipo" });
    expect(within(meeting).getByText("AGENDA UNA REUNIÓN")).toBeInTheDocument();
    expect(
      within(meeting).getByText(
        "¿Tienes dudas específicas o necesitas asesoría personalizada? Agenda una videollamada con nuestro equipo de soporte."
      )
    ).toBeInTheDocument();
    expect(within(meeting).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Reunión por Google Meet",
      "Elige el día y la hora que más te convenga",
      "Te ayudamos con tu configuración",
    ]);

    const whatsapp = screen.getByRole("region", { name: "Habla con nuestro equipo por WhatsApp" });
    expect(within(whatsapp).getByText("SOPORTE RÁPIDO")).toBeInTheDocument();
    expect(
      within(whatsapp).getByText(
        "Si necesitas ayuda, puedes escribir directamente a nuestro equipo de soporte por WhatsApp."
      )
    ).toBeInTheDocument();
    expect(
      within(whatsapp).getByText(
        "Cuéntanos tu consulta e indica el nombre de tu negocio para que podamos ayudarte."
      )
    ).toBeInTheDocument();
  });

  it.each([
    [/Ir al Centro de ayuda/, HELP_URL],
    [/Agendar reunión/, "https://calendar.app.google/hr6MCGP8di62n7kk7"],
    [/Abrir WhatsApp/, "https://wa.me/51923101193?text=Hola,%20tengo%20una%20duda%20sobre%20POWIP"],
  ])("%s abre su destino en una pestaña nueva", (name, href) => {
    render(<HelpSection />);

    const link = screen.getByRole("link", { name });
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("no muestra acciones deshabilitadas", () => {
    render(<HelpSection />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText("Disponible próximamente")).not.toBeInTheDocument();
  });
});

describe("HelpHeaderLink", () => {
  it("enlaza al Centro de ayuda en una pestaña nueva", () => {
    render(<HelpHeaderLink />);

    const link = screen.getByRole("link", { name: /¿Necesitas ayuda\?/ });
    expect(link).toHaveAttribute("href", HELP_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
