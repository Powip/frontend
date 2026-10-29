import { isBusinessQuestionOwner, isBusinessQuestionRespondent, resolveBusinessQuestionsRedirect } from "../businessQuestionsGate";
import type { StoredBusinessQuestionAnswers } from "../onboardingQuestions";

const owner = "owner-a";
const company: StoredBusinessQuestionAnswers & { id: string; userId: string; sales_channels?: string[] } = {
  id: "company-a",
  userId: owner,
  onboarding_sales_channels: null,
  monthly_order_volume: null,
};
const base = { pathname: "/ventas", company, userId: owner, isSuperadmin: false };

describe("company-level business questions gate", () => {
  it("sends the actual owner to complete an unanswered company profile", () => {
    expect(resolveBusinessQuestionsRedirect(base)).toBe("/completar-negocio");
    expect(isBusinessQuestionOwner(company, "OWNER-A")).toBe(true);
  });

  it.each([null, undefined])("does not gate when the company has not loaded (%s)", (value) => {
    expect(resolveBusinessQuestionsRedirect({ ...base, company: value })).toBeNull();
  });

  it("keeps normal operational staff working", () => {
    for (const userRole of ["VENTAS", "OPERACIONES", "AGENTES"]) {
      expect(resolveBusinessQuestionsRedirect({ ...base, userId: "staff", userRole, userCompanyId: company.id })).toBeNull();
      expect(isBusinessQuestionRespondent(company, { id: "staff", role: userRole, companyId: company.id })).toBe(false);
    }
  });

  it("requires an administrator of the same company to answer", () => {
    expect(resolveBusinessQuestionsRedirect({
      ...base, userId: "admin-a", userRole: "ADMINISTRADOR", userCompanyId: "COMPANY-A",
    })).toBe("/completar-negocio");
    expect(isBusinessQuestionRespondent(company, { id: "admin-a", role: "ADMINISTRADOR", companyId: company.id })).toBe(true);
  });

  it.each([
    ["ADMINISTRADOR", "another-company"],
    ["ADMINISTRADOR", null],
    ["ADMINISTRADOR", undefined],
    ["ADMIN", "company-a"],
    ["SUPERADMIN", "company-a"],
    ["OWNER", "company-a"],
  ] as const)("does not grant respondent access to role %s with membership %s", (role, companyId) => {
    expect(isBusinessQuestionRespondent(company, { id: "non-owner", role, companyId })).toBe(false);
    expect(resolveBusinessQuestionsRedirect({
      ...base, userId: "non-owner", userRole: role, userCompanyId: companyId,
    })).toBeNull();
  });

  it("accepts the actual owner without an administrator role or company claim", () => {
    expect(isBusinessQuestionRespondent(company, { id: owner, role: "USUARIO" })).toBe(true);
    expect(resolveBusinessQuestionsRedirect({ ...base, userRole: "USUARIO", userCompanyId: null })).toBe("/completar-negocio");
  });

  it("requires verified company ownership rather than a missing owner field", () => {
    expect(resolveBusinessQuestionsRedirect({ ...base, company: {} })).toBeNull();
    expect(resolveBusinessQuestionsRedirect({ ...base, company: { userId: "" } })).toBeNull();
  });

  it("does not accept operational sales channels as questionnaire answers", () => {
    expect(resolveBusinessQuestionsRedirect({
      ...base,
      company: { ...company, sales_channels: ["POS (Punto de venta)"], monthly_order_volume: "UP_TO_1000" },
    })).toBe("/completar-negocio");
  });

  it.each([
    { onboarding_sales_channels: [], monthly_order_volume: "UP_TO_1000" },
    { onboarding_sales_channels: ["POS (Punto de venta)"], monthly_order_volume: null },
    { onboarding_sales_channels: ["unknown-platform"], monthly_order_volume: "UP_TO_1000" },
    { onboarding_sales_channels: ["POS (Punto de venta)"], monthly_order_volume: "unknown-range" },
  ])("keeps incomplete or invalid profiles gated: %p", (fields) => {
    expect(resolveBusinessQuestionsRedirect({
      ...base,
      company: { ...company, ...fields } as typeof company,
    })).toBe("/completar-negocio");
  });

  it.each([owner, "admin-a"])("does not ask respondent %s again after the company has answered", (userId) => {
    expect(resolveBusinessQuestionsRedirect({
      ...base,
      userId,
      userRole: "ADMINISTRADOR",
      userCompanyId: company.id,
      company: {
        ...company,
        onboarding_sales_channels: ["POS (Punto de venta)", "WhatsApp conversacional"],
        monthly_order_volume: "UP_TO_1000",
      },
    })).toBeNull();
  });

  it("bypasses platform superadmins", () => {
    expect(resolveBusinessQuestionsRedirect({ ...base, isSuperadmin: true })).toBeNull();
  });

  it.each([
    "/completar-negocio", "/completar-negocio/",
    "/pasate-a-flow", "/pasate-a-flow/callback",
    "/subscriptions", "/subscriptions/payment",
    "/sin-plan", "/cuenta-suspendida",
  ])("preserves the collection or payment route %s", (pathname) => {
    expect(resolveBusinessQuestionsRedirect({ ...base, pathname })).toBeNull();
  });

  it.each(["/pasate-a-flow-extra", "/subscriptions-extra", "/completar-negocio-extra"])(
    "does not exempt a similar prefix %s", (pathname) => {
      expect(resolveBusinessQuestionsRedirect({ ...base, pathname })).toBe("/completar-negocio");
    },
  );
});
