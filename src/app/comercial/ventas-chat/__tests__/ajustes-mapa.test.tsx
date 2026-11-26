import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { AjustesMapa, PorQuePowip } from "@/components/ventas-chat/AjustesMapa";

describe("Ajustes · mapa de configuración (J1, J12)", () => {
  it("muestra 3 secciones, «Ver todo» abre el resto e «Ir» baja a la sección", () => {
    const target = document.createElement("div");
    target.id = "aj-canales";
    target.scrollIntoView = jest.fn();
    document.body.appendChild(target);
    render(<AjustesMapa />);
    expect(screen.getAllByRole("button", { name: /^Ir a / })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Ver todo" }));
    expect(screen.getAllByRole("button", { name: /^Ir a / })).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "Ir a Canales y cuentas" }));
    expect(target.scrollIntoView).toHaveBeenCalled();
    target.remove();
  });

  it("explica por qué POWIP y no un bot", () => {
    render(<PorQuePowip />);
    expect(screen.getByRole("heading", { name: "Por qué POWIP y no un bot" })).toBeInTheDocument();
  });
});
