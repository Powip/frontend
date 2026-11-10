import { getRoutePermissions, hasRouteAccess } from "../permissions.config";

/**
 * B1 · /finanzas es solo para el rol Administrador (decisión de Octa, 2026-11-10: ni Ventas, ni
 * Operaciones, ni CALLER lo ven).
 *
 * Los conjuntos de permisos replican la matriz real de prod (schema auth_ms, verificada en solo
 * lectura): VIEW_FINANCES lo tienen ADMINISTRADOR y CALLER, así que el permiso no alcanza para
 * dejar fuera a CALLER: la regla es por rol.
 */
const VENTAS = ["VIEW_DASHBOARD", "VIEW_SALES", "CREATE_SALE", "VIEW_TRACKING", "MANAGE_CLIENTS", "VIEW_CUSTOMER_SERVICE"];
const OPERACIONES = [
  "VIEW_DASHBOARD", "MANAGE_PRODUCTS", "MANAGE_ALMACEN", "VIEW_SALES", "MANAGE_OPERATIONS", "VIEW_TRACKING",
  "MANAGE_CLIENTS", "MANAGE_PROVIDERS", "VIEW_CUSTOMER_SERVICE", "VIEW_ABANDONED_CHECKOUTS",
];
const ADMINISTRADOR = [
  ...new Set([...VENTAS, ...OPERACIONES, "VIEW_FINANCES", "APPROVE_PAYMENTS", "MANAGE_USERS", "MANAGE_ROLES", "ACCESS_SETTINGS"]),
];

const user = (role: string, permissions: string[], email = `${role.toLowerCase()}@negocio.invalid`) => ({ email, role, permissions });

const ADMIN = user("ADMINISTRADOR", ADMINISTRADOR);
const ROL_VENTAS = user("VENTAS", VENTAS);
const ROL_OPERACIONES = user("OPERACIONES", OPERACIONES);
// Rol personalizado que combina Ventas + Operaciones (el caso del cliente).
const VENTAS_OPERACIONES = user("CUSTOM_ventas-operaciones", [...new Set([...VENTAS, ...OPERACIONES])]);
const CALLER = user("CALLER", [...OPERACIONES, "VIEW_FINANCES"]);
const SUPERADMIN = user("USUARIO", [], "octatoledo7@gmail.com");

const RUTAS_FINANZAS = ["/finanzas", "/finanzas/", "/finanzas/liquidaciones", "/finanzas/cualquier/subruta"];

describe("hasRouteAccess · /finanzas", () => {
  it("la ruta exige el rol Administrador", () => {
    expect(getRoutePermissions("/finanzas")).toEqual(["__ADMIN_ROLE__"]);
    expect(getRoutePermissions("/finanzas/liquidaciones")).toEqual(["__ADMIN_ROLE__"]);
  });

  it.each(RUTAS_FINANZAS)("Administrador entra a %s", (pathname) => {
    expect(hasRouteAccess(pathname, ADMIN)).toBe(true);
  });

  it.each(RUTAS_FINANZAS)("Ventas no entra a %s", (pathname) => {
    expect(hasRouteAccess(pathname, ROL_VENTAS)).toBe(false);
  });

  it.each(RUTAS_FINANZAS)("Operaciones no entra a %s", (pathname) => {
    expect(hasRouteAccess(pathname, ROL_OPERACIONES)).toBe(false);
  });

  it.each(RUTAS_FINANZAS)("un rol personalizado Ventas + Operaciones no entra a %s", (pathname) => {
    expect(hasRouteAccess(pathname, VENTAS_OPERACIONES)).toBe(false);
  });

  it("un usuario sin permisos tampoco entra", () => {
    expect(hasRouteAccess("/finanzas", user("USUARIO", []))).toBe(false);
    expect(hasRouteAccess("/finanzas", { email: undefined, role: undefined, permissions: undefined })).toBe(false);
  });

  it.each(RUTAS_FINANZAS)("CALLER no entra a %s aunque tenga VIEW_FINANCES", (pathname) => {
    expect(CALLER.permissions).toContain("VIEW_FINANCES");
    expect(hasRouteAccess(pathname, CALLER)).toBe(false);
  });

  it("tener VIEW_FINANCES sin el rol Administrador no abre Finanzas", () => {
    expect(hasRouteAccess("/finanzas", user("FINANZAS", ["VIEW_FINANCES", "APPROVE_PAYMENTS"]))).toBe(false);
  });

  it("superadmin conserva el acceso", () => {
    expect(hasRouteAccess("/finanzas", SUPERADMIN)).toBe(true);
  });

  it("no cierra las rutas vecinas que Ventas y Operaciones usan", () => {
    for (const pathname of ["/ventas", "/registrar-venta", "/operaciones/pedidos", "/facturacion", "/inventario", "/clientes"]) {
      expect(hasRouteAccess(pathname, ROL_VENTAS)).toBe(true);
      expect(hasRouteAccess(pathname, ROL_OPERACIONES)).toBe(true);
    }
  });
});
