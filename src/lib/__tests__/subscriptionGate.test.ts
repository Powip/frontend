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
