import { canEditInventory, canSeeProductCosts, getRoutePermissions, hasRouteAccess } from "../permissions.config";

/**
 * C1 · decisiones de Octa (2026-11-10), respaldadas con datos de prod de los últimos 90 días:
 *  - El costo de los productos lo ven Administrador y Operaciones (los únicos roles que registraron
 *    compras: 32 y 7). CALLER, Ventas, Agentes, Usuario y los roles personalizados no.
 *  - El inventario lo editan Administrador y Operaciones (los únicos con ajustes manuales IN/OUT).
 *  - /administracion (gastos, utilidad, capital…) es solo del Administrador.
 * Todo es por ROL, no por permiso: CALLER tiene MANAGE_INVENTORY y VIEW_FINANCES en prod y no debe
 * heredar ninguna de las dos cosas.
 */
const user = (role: string | undefined, email = `${(role ?? "sin-rol").toLowerCase()}@negocio.invalid`, permissions: string[] = []) => ({
  email,
  role,
  permissions,
});

const ADMINISTRADOR = user("ADMINISTRADOR");
const OPERACIONES = user("OPERACIONES");
const CALLER = user("CALLER", undefined, ["MANAGE_INVENTORY", "VIEW_FINANCES", "MANAGE_PRODUCTS", "MANAGE_OPERATIONS"]);
const VENTAS = user("VENTAS");
const AGENTES = user("AGENTES");
const USUARIO = user("USUARIO");
const COURIER = user("COURIER");
// Rol personalizado "Ventas + Operaciones": el caso del cliente, con productos y operaciones pero sin Finanzas.
const PERSONALIZADO = user("CUSTOM_ventas-operaciones", undefined, ["MANAGE_PRODUCTS", "MANAGE_OPERATIONS", "VIEW_SALES", "CREATE_SALE"]);
const SUPERADMIN = user("USUARIO", "octatoledo7@gmail.com");

describe("canSeeProductCosts", () => {
  it.each([
    ["Administrador", ADMINISTRADOR],
    ["Operaciones", OPERACIONES],
    ["superadmin", SUPERADMIN],
    ["alias ADMIN", user("ADMIN")],
    ["alias OWNER", user("OWNER")],
    ["operaciones en minúsculas", user("operaciones")],
  ])("%s ve el costo", (_nombre, u) => {
    expect(canSeeProductCosts(u)).toBe(true);
  });

  it.each([
    ["CALLER (aunque tenga VIEW_FINANCES y MANAGE_INVENTORY)", CALLER],
    ["Ventas", VENTAS],
    ["Agentes", AGENTES],
    ["Usuario", USUARIO],
    ["Courier", COURIER],
    ["rol personalizado Ventas + Operaciones", PERSONALIZADO],
    ["sin rol", user(undefined)],
  ])("%s NO ve el costo", (_nombre, u) => {
    expect(canSeeProductCosts(u)).toBe(false);
  });

  it("sin sesión no ve el costo", () => {
    expect(canSeeProductCosts(undefined)).toBe(false);
  });
});

describe("canEditInventory", () => {
  it.each([
    ["Administrador", ADMINISTRADOR],
    ["Operaciones", OPERACIONES],
    ["superadmin", SUPERADMIN],
  ])("%s edita el inventario", (_nombre, u) => {
    expect(canEditInventory(u)).toBe(true);
  });

  it.each([
    ["CALLER (aunque tenga MANAGE_INVENTORY)", CALLER],
    ["Ventas", VENTAS],
    ["Agentes", AGENTES],
    ["rol personalizado Ventas + Operaciones", PERSONALIZADO],
  ])("%s NO edita el inventario", (_nombre, u) => {
    expect(canEditInventory(u)).toBe(false);
  });

  it("sin sesión no edita", () => {
    expect(canEditInventory(undefined)).toBe(false);
  });
});

describe("hasRouteAccess · compras (alta de stock con costo)", () => {
  const COMPRAS = ["/compras", "/compras/", "/registrar-compra", "/registrar-compra/nueva"];

  it.each(COMPRAS)("%s exige un rol de inventario", (pathname) => {
    expect(getRoutePermissions(pathname)).toEqual(["__INVENTORY_ROLE__"]);
  });

  it.each(COMPRAS)("Administrador y Operaciones entran a %s", (pathname) => {
    expect(hasRouteAccess(pathname, ADMINISTRADOR)).toBe(true);
    expect(hasRouteAccess(pathname, OPERACIONES)).toBe(true);
    expect(hasRouteAccess(pathname, SUPERADMIN)).toBe(true);
  });

  it.each(COMPRAS)("CALLER, Ventas y el rol personalizado no entran a %s", (pathname) => {
    for (const u of [CALLER, VENTAS, AGENTES, PERSONALIZADO]) expect(hasRouteAccess(pathname, u)).toBe(false);
  });
});

describe("hasRouteAccess · /administracion (solo Administrador)", () => {
  const RUTAS = ["/administracion", "/administracion/resumen", "/administracion/gastos", "/administracion/capital", "/administracion/flujo"];

  it.each(RUTAS)("%s exige el rol Administrador", (pathname) => {
    expect(getRoutePermissions(pathname)).toEqual(["__ADMIN_ROLE__"]);
  });

  it.each(RUTAS)("solo el Administrador entra a %s", (pathname) => {
    expect(hasRouteAccess(pathname, ADMINISTRADOR)).toBe(true);
    expect(hasRouteAccess(pathname, SUPERADMIN)).toBe(true);
    for (const u of [OPERACIONES, CALLER, VENTAS, PERSONALIZADO]) expect(hasRouteAccess(pathname, u)).toBe(false);
  });
});

describe("hasRouteAccess · rutas vecinas siguen abiertas", () => {
  it.each(["/inventario", "/productos", "/ventas", "/registrar-venta", "/operaciones/pedidos", "/clientes", "/facturacion"])(
    "%s sigue abierta para Ventas y Operaciones",
    (pathname) => {
      expect(hasRouteAccess(pathname, VENTAS)).toBe(true);
      expect(hasRouteAccess(pathname, OPERACIONES)).toBe(true);
    },
  );

  it("el inventario sigue siendo visible (solo lectura) para CALLER y el rol personalizado", () => {
    expect(hasRouteAccess("/inventario", CALLER)).toBe(true);
    expect(hasRouteAccess("/inventario", PERSONALIZADO)).toBe(true);
  });
});
