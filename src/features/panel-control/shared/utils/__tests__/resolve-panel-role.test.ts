import { resolvePanelRole } from "../resolve-panel-role";

describe("resolvePanelRole", () => {
  it("resuelve Dueño para roles administradores", () => {
    expect(resolvePanelRole({ role: "ADMINISTRADOR", email: "a@b.com" })).toMatchObject({
      status: "resuelto",
      role: "dueno",
      source: "rol_jwt",
    });
  });

  it("resuelve Dueño para superadmin por email", () => {
    expect(resolvePanelRole({ role: "VENTAS", email: "cuentaprueba@gmail.com" })).toMatchObject({
      role: "dueno",
      source: "superadmin",
    });
  });

  it("mapea AGENTES a Confirmadora y VENTAS a Vendedora", () => {
    expect(resolvePanelRole({ role: "AGENTES" })).toMatchObject({ role: "confirmadora" });
    expect(resolvePanelRole({ role: "ventas" })).toMatchObject({ role: "vendedora" });
  });

  it("prioriza el permiso PANEL_ROL_* del JWT", () => {
    expect(
      resolvePanelRole({ role: "OPERACIONES", permissions: ["PANEL_ROL_SUPERVISORA"] }),
    ).toMatchObject({ role: "supervisora", source: "permiso_panel" });
  });

  it("no inventa roles sin evidencia", () => {
    expect(resolvePanelRole({ role: "OPERACIONES" })).toMatchObject({
      status: "sin_resolver",
      rolJwt: "OPERACIONES",
    });
    expect(resolvePanelRole({ role: "CALLER" }).status).toBe("sin_resolver");
    expect(resolvePanelRole({ role: null }).status).toBe("sin_resolver");
  });
});
