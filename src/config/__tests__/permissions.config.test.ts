import { hasRouteAccess } from "../permissions.config";

/**
 * hasRouteAccess — regla única de AuthGuard (URL) y Sidebar (enlace).
 *
 * 1. /usuarios solo para admins de empresa (roles reales de la sesión) y superadmins.
 * 2. El resto de las rutas no cambia: Ventas, Finanzas, etc. siguen abiertas a
 *    cualquier autenticado y /superadmin sigue siendo solo para superadmins.
 */

const user = (role?: string, email = "colaborador@empresa.com") => ({
  email,
  role,
  permissions: [] as string[],
});

describe("hasRouteAccess — /usuarios", () => {
  it.each(["ADMIN", "ADMINISTRADOR", "OWNER", "admin", "administrador"])(
    "admin de empresa (%s) entra",
    (role) => {
      expect(hasRouteAccess("/usuarios", user(role))).toBe(true);
    },
  );

  it.each(["VENTAS", "AGENTES", "OPERACIONES", "COURIER", "CALLER", "USUARIO", "user", undefined])(
    "rol sin permiso (%s) no entra",
    (role) => {
      expect(hasRouteAccess("/usuarios", user(role))).toBe(false);
    },
  );

  it("también cubre subrutas de /usuarios", () => {
    expect(hasRouteAccess("/usuarios/algo", user("VENTAS"))).toBe(false);
    expect(hasRouteAccess("/usuarios/algo", user("ADMINISTRADOR"))).toBe(true);
  });

  it("un superadmin entra aunque su rol no sea de admin", () => {
    expect(hasRouteAccess("/usuarios", user("VENTAS", "tognolimauricio@gmail.com"))).toBe(true);
  });

  it("sin sesión no entra", () => {
    expect(hasRouteAccess("/usuarios", null)).toBe(false);
  });
});

describe("hasRouteAccess — otras rutas sin cambios", () => {
  it.each(["/ventas", "/finanzas", "/operaciones/pedidos", "/configuracion", "/usuarios-x"])(
    "%s sigue abierta a cualquier autenticado",
    (path) => {
      expect(hasRouteAccess(path, user("VENTAS"))).toBe(true);
    },
  );

  it("/superadmin sigue siendo solo para superadmins (un admin de empresa no entra)", () => {
    expect(hasRouteAccess("/superadmin", user("ADMINISTRADOR"))).toBe(false);
    expect(hasRouteAccess("/superadmin", user("VENTAS", "tognolimauricio@gmail.com"))).toBe(true);
  });
});
