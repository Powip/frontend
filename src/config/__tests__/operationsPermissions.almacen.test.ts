import { mapRoleNameToViewRole } from "../operationsPermissions";

// FEAT-24 H6 — el rol Almacén usa la vista «Despacho / Almacén» de Operaciones.

describe("rol Almacén en Operaciones (FEAT-24 H6)", () => {
  it("ALMACEN cae en Despacho, sin importar mayúsculas", () => {
    expect(mapRoleNameToViewRole("ALMACEN")).toBe("DESPACHO");
    expect(mapRoleNameToViewRole("almacen")).toBe("DESPACHO");
    expect(mapRoleNameToViewRole("OPERACIONES")).toBe("DESPACHO");
    expect(mapRoleNameToViewRole("VENTAS")).toBeNull();
  });
});
