"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { BusinessQuestions } from "@/components/onboarding/BusinessQuestions";
import { Button } from "@/components/ui/button";
import { isBusinessQuestionRespondent } from "@/lib/businessQuestionsGate";
import {
  businessQuestionErrors,
  hasCompletedBusinessQuestions,
  SALES_CHANNEL_OPTIONS,
  MONTHLY_ORDER_VOLUME_OPTIONS,
  type BusinessQuestionAnswers,
} from "@/lib/onboardingQuestions";
import { submitCompanyOnboardingQuestions } from "@/services/companyService";

export default function CompleteBusinessPage() {
  const { auth, loading, updateCompany, logout } = useAuth();
  const router = useRouter();
  const company = auth?.company;
  const [answers, setAnswers] = useState<BusinessQuestionAnswers>(() => ({
    salesChannels: (company?.onboarding_sales_channels ?? []).filter((channel) =>
      SALES_CHANNEL_OPTIONS.some((option) => option === channel),
    ),
    monthlyOrderVolume: MONTHLY_ORDER_VOLUME_OPTIONS.find((option) => option.value === company?.monthly_order_volume)?.value ?? "",
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof BusinessQuestionAnswers, string>>>({});
  const [saving, setSaving] = useState(false);
  const canAnswer = Boolean(auth && isBusinessQuestionRespondent(company, auth.user));
  const complete = Boolean(company && hasCompletedBusinessQuestions(company));
  const companyRef = useRef(company);
  companyRef.current = company;
  const scopeRef = useRef<string | null>(null);
  const scope = auth && company ? JSON.stringify([auth.user.id, company.id]) : null;
  scopeRef.current = scope;

  useEffect(() => {
    scopeRef.current = scope;
    return () => { scopeRef.current = null; };
  }, [scope]);

  useEffect(() => {
    if (!loading && (!canAnswer || complete)) router.replace("/");
  }, [loading, canAnswer, complete, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = businessQuestionErrors(answers);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length || !auth || !company || !canAnswer || saving || !answers.monthlyOrderVolume) return;

    setSaving(true);
    const requestScope = scopeRef.current;
    try {
      const profile = await submitCompanyOnboardingQuestions(company.id, auth.accessToken, {
        onboarding_sales_channels: answers.salesChannels,
        monthly_order_volume: answers.monthlyOrderVolume,
      });
      if (scopeRef.current !== requestScope || !companyRef.current) return;
      if (profile.id !== company.id || !hasCompletedBusinessQuestions(profile)) {
        throw new Error("No se pudo confirmar el guardado de las respuestas.");
      }
      updateCompany({
        ...companyRef.current,
        onboarding_sales_channels: profile.onboarding_sales_channels,
        monthly_order_volume: profile.monthly_order_volume,
      });
      toast.success("Respuestas guardadas");
      router.replace("/");
    } catch {
      if (scopeRef.current !== requestScope) return;
      toast.error("No se pudieron guardar las respuestas. Inténtalo nuevamente.");
    } finally {
      if (scopeRef.current === requestScope) setSaving(false);
    }
  }

  if (loading || !canAnswer || complete) return null;

  return (
    <div className="min-h-screen bg-[#f7f5ff] px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#4F3A96]">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">Cuéntanos sobre tu negocio</h1>
          <p className="mt-2 text-sm text-gray-500">
            Completa estas dos preguntas para continuar en {company?.name}. Solo necesitas responder una vez por empresa.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-[#4F3A96]/10 bg-white p-6 shadow-sm sm:p-8">
          <BusinessQuestions
            {...answers}
            onSalesChannelsChange={(salesChannels) => {
              setAnswers((previous) => ({ ...previous, salesChannels }));
              if (salesChannels.length) setErrors((previous) => ({ ...previous, salesChannels: "" }));
            }}
            onMonthlyOrderVolumeChange={(monthlyOrderVolume) => {
              setAnswers((previous) => ({ ...previous, monthlyOrderVolume }));
              setErrors((previous) => ({ ...previous, monthlyOrderVolume: "" }));
            }}
            errors={errors}
            disabled={saving}
          />
          <Button type="submit" disabled={saving} className="h-12 w-full rounded-xl bg-[#4F3A96] text-base font-semibold">
            {saving ? "Guardando respuestas..." : "Guardar y continuar"}
          </Button>
        </form>
        <button type="button" disabled={saving} onClick={logout} className="mx-auto mt-5 block px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
