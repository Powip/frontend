import { render, screen } from "@testing-library/react";
import { MapsLink, toSafeHttpUrl } from "../MapsLink";

describe("MapsLink", () => {
  it("muestra Ver ubicación y abre un link HTTP(S) de forma segura", () => {
    render(<MapsLink url="https://maps.google.com/?q=-12.1,-77.0" />);

    const link = screen.getByRole("link", { name: "Ver ubicación" });
    expect(link).toHaveAttribute("href", "https://maps.google.com/?q=-12.1,-77.0");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("muestra guion cuando no existe ubicación", () => {
    render(<MapsLink url={null} />);
    expect(screen.getByText("-")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("no convierte protocolos inseguros en enlaces", () => {
    render(<MapsLink url="javascript:alert(1)" />);
    expect(screen.getByText("-")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(toSafeHttpUrl("javascript:alert(1)")).toBeNull();
  });

  it("no permite sobrescribir las protecciones de una pestaña nueva", () => {
    render(<MapsLink url="https://maps.google.com/?q=-12.1,-77.0" target="_self" rel="opener" />);

    const link = screen.getByRole("link", { name: "Ver ubicación" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
