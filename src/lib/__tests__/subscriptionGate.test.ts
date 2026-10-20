import { postLoginRoute, resolveSubscriptionRedirect } from "../subscriptionGate";

const base = { isSuperadmin: false, hasCompany: false, subscriptionStatus: null as string | null };

describe("resolveSubscriptionRedirect", () => {
  it("no afecta a usuarios con empresa (dueños y personal operativo sin suscripción propia)", () => {
    for (const path of ["/", "/dashboard", "/ventas", "/sin-plan"]) {
      expect(resolveSubscriptionRedirect({ ...base, pathname: path, hasCompany: true })).toBeNull();
    }
  });

  it("no afecta a superadmins", () => {
    expect(resolveSubscriptionRedirect({ ...base, pathname: "/superadmin", isSuperadmin: true })).toBeNull();
  });

  it("sin empresa y sin plan: todo lleva a /sin-plan salvo /sin-plan y /onboarding", () => {
    expect(resolveSubscriptionRedirect({ ...base, pathname: "/dashboard" })).toBe("/sin-plan");
    expect(resolveSubscriptionRedirect({ ...base, pathname: "/new-company" })).toBe("/sin-plan");
    expect(resolveSubscriptionRedirect({ ...base, pathname: "/sin-plan" })).toBeNull();
    expect(resolveSubscriptionRedirect({ ...base, pathname: "/onboarding/callback" })).toBeNull();
  });

  it("un pago pendiente o una suscripción vencida no dan acceso", () => {
    for (const status of ["PENDING_PAYMENT", "EXPIRED", "CANCELED"]) {
      expect(resolveSubscriptionRedirect({ ...base, pathname: "/dashboard", subscriptionStatus: status })).toBe("/sin-plan");
    }
  });

  it("sin empresa y con plan vigente: solo puede crear la empresa", () => {
    for (const status of ["ACTIVE", "PENDING_RENEWAL"]) {
      expect(resolveSubscriptionRedirect({ ...base, pathname: "/dashboard", subscriptionStatus: status })).toBe("/new-company");
      expect(resolveSubscriptionRedirect({ ...base, pathname: "/new-company", subscriptionStatus: status })).toBeNull();
    }
  });

  it("no confunde prefijos: /sin-plan-x no es /sin-plan", () => {
    expect(resolveSubscriptionRedirect({ ...base, pathname: "/sin-planx" })).toBe("/sin-plan");
  });
});

describe("postLoginRoute", () => {
  it("con empresa va al inicio; sin empresa según el plan", () => {
    expect(postLoginRoute(true, null)).toBe("/");
    expect(postLoginRoute(false, "ACTIVE")).toBe("/new-company");
    expect(postLoginRoute(false, "PENDING_PAYMENT")).toBe("/sin-plan");
    expect(postLoginRoute(false, null)).toBe("/sin-plan");
  });
});

describe("bloqueo FEAT-25 (migración a Flow)", () => {
  const conEmpresa = { ...base, hasCompany: true };
  const bloqueadoDueno = { state: "BLOQUEADO" as const, owner: true };
  const bloqueadoEmpleado = { state: "BLOQUEADO" as const, owner: false };

  it("dueño bloqueado: todo lleva a /pasate-a-flow, salvo esa pantalla", () => {
    expect(resolveSubscriptionRedirect({ ...conEmpresa, pathname: "/dashboard", access: bloqueadoDueno })).toBe("/pasate-a-flow");
    expect(resolveSubscriptionRedirect({ ...conEmpresa, pathname: "/cuenta-suspendida", access: bloqueadoDueno })).toBe("/pasate-a-flow");
    expect(resolveSubscriptionRedirect({ ...conEmpresa, pathname: "/pasate-a-flow", access: bloqueadoDueno })).toBeNull();
  });

  it("empleado bloqueado: todo lleva a /cuenta-suspendida, incluso la pantalla de pago", () => {
    expect(resolveSubscriptionRedirect({ ...conEmpresa, pathname: "/ventas", access: bloqueadoEmpleado })).toBe("/cuenta-suspendida");
    expect(resolveSubscriptionRedirect({ ...conEmpresa, pathname: "/pasate-a-flow", access: bloqueadoEmpleado })).toBe("/cuenta-suspendida");
    expect(resolveSubscriptionRedirect({ ...conEmpresa, pathname: "/cuenta-suspendida", access: bloqueadoEmpleado })).toBeNull();
  });

  it("en aviso o al día no se bloquea nada", () => {
    for (const state of ["AVISO", "OK"] as const) {
      expect(resolveSubscriptionRedirect({ ...conEmpresa, pathname: "/dashboard", access: { state, owner: true } })).toBeNull();
      expect(resolveSubscriptionRedirect({ ...conEmpresa, pathname: "/ventas", access: { state, owner: false } })).toBeNull();
    }
  });

  it("sin dato de acceso (error o timeout) se deja entrar", () => {
    expect(resolveSubscriptionRedirect({ ...conEmpresa, pathname: "/dashboard", access: null })).toBeNull();
    expect(resolveSubscriptionRedirect({ ...conEmpresa, pathname: "/dashboard" })).toBeNull();
  });

  it("si ya no está bloqueada, /cuenta-suspendida vuelve al inicio", () => {
    expect(resolveSubscriptionRedirect({ ...conEmpresa, pathname: "/cuenta-suspendida", access: { state: "OK", owner: false } })).toBe("/");
    expect(resolveSubscriptionRedirect({ ...conEmpresa, pathname: "/cuenta-suspendida", access: null })).toBe("/");
  });

  it("al superadmin no se le aplica", () => {
    expect(resolveSubscriptionRedirect({ ...conEmpresa, pathname: "/dashboard", isSuperadmin: true, access: bloqueadoEmpleado })).toBeNull();
  });

  it("sin empresa sigue mandando la regla de FEAT-11 aunque el acceso diga bloqueado", () => {
    expect(resolveSubscriptionRedirect({ ...base, pathname: "/dashboard", access: bloqueadoDueno })).toBe("/sin-plan");
    expect(resolveSubscriptionRedirect({ ...base, pathname: "/dashboard", subscriptionStatus: "ACTIVE", access: bloqueadoDueno })).toBe("/new-company");
  });
});
