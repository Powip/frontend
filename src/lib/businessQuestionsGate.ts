import { hasCompletedBusinessQuestions, type StoredBusinessQuestionAnswers } from "@/lib/onboardingQuestions";

export const BUSINESS_QUESTIONS_ROUTE = "/completar-negocio";

interface ProfileCompany extends StoredBusinessQuestionAnswers {
  id?: string;
  userId?: string;
}

export function isBusinessQuestionOwner(company: ProfileCompany | null | undefined, userId: string): boolean {
  return Boolean(company?.userId && company.userId.toLowerCase() === userId.toLowerCase());
}

export function isBusinessQuestionRespondent(
  company: ProfileCompany | null | undefined,
  user: { id: string; role?: string; companyId?: string | null },
): boolean {
  if (isBusinessQuestionOwner(company, user.id)) return true;
  return Boolean(
    company?.id && user.companyId &&
      company.id.toLowerCase() === user.companyId.toLowerCase() &&
      user.role?.toUpperCase() === "ADMINISTRADOR",
  );
}

/** Payment/auth routing must run before this company-level questionnaire gate. */
export function resolveBusinessQuestionsRedirect({
  pathname,
  company,
  userId,
  userRole,
  userCompanyId,
  isSuperadmin,
}: {
  pathname: string;
  company: ProfileCompany | null | undefined;
  userId: string;
  userRole?: string;
  userCompanyId?: string | null;
  isSuperadmin: boolean;
}): string | null {
  if (isSuperadmin || !company || !isBusinessQuestionRespondent(company, { id: userId, role: userRole, companyId: userCompanyId }) || hasCompletedBusinessQuestions(company)) {
    return null;
  }
  const paymentRoutes = ["/pasate-a-flow", "/subscriptions", "/sin-plan", "/cuenta-suspendida"];
  if ([BUSINESS_QUESTIONS_ROUTE, ...paymentRoutes].some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return null;
  }
  return BUSINESS_QUESTIONS_ROUTE;
}
