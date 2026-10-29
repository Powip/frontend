import { hasRouteAccess } from "../permissions.config";

const STAFF_WITH_VIEW = {
  email: "staff@example.com",
  role: "ADMIN",
  permissions: ["PARTNERS_VIEW"],
};
const SUPERADMIN = { email: "tognolimauricio@gmail.com", role: "ADMIN", permissions: [] };
const BUSINESS_USER = { email: "user@example.com", role: "ADMIN", permissions: [] };

describe("hasRouteAccess · Partners", () => {
  it("el personal con PARTNERS_VIEW accede a las solicitudes", () => {
    expect(hasRouteAccess("/partners/admin/solicitudes", STAFF_WITH_VIEW)).toBe(true);
  });

  it.each([
    "/partners/admin",
    "/partners/admin/partners",
    "/partners/admin/cola",
    "/partners/admin/liquidaciones",
    "/partners/admin/reglas",
  ])("PARTNERS_VIEW no abre la sección simulada %s", (pathname) => {
    expect(hasRouteAccess(pathname, STAFF_WITH_VIEW)).toBe(false);
  });

  it("un usuario sin PARTNERS_VIEW no accede a las solicitudes", () => {
    expect(hasRouteAccess("/partners/admin/solicitudes", BUSINESS_USER)).toBe(false);
  });

  it("superadmin conserva el acceso a todas las secciones de administración", () => {
    expect(hasRouteAccess("/partners/admin", SUPERADMIN)).toBe(true);
    expect(hasRouteAccess("/partners/admin/solicitudes", SUPERADMIN)).toBe(true);
  });

  it("el portal de partners sigue abierto a cualquier usuario autenticado", () => {
    expect(hasRouteAccess("/partners", BUSINESS_USER)).toBe(true);
    expect(hasRouteAccess("/partners/referidos", BUSINESS_USER)).toBe(true);
  });
});
