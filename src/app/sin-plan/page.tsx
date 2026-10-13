"use client";

import { Building2, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import EnterpriseContactModal from "@/components/modals/EnterpriseContactModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { adaptPlans, type PlanMarketing } from "@/lib/planCatalog";

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  durationInDays: number;
}

type FrontPlan = Plan & PlanMarketing;

export default function SinPlanPage() {
  const { auth, logout } = useAuth();
  const router = useRouter();

  const [plans, setPlans] = useState<FrontPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [isEnterpriseModalOpen, setIsEnterpriseModalOpen] = useState(false);

  const accessToken = auth?.accessToken;
  // biome-ignore lint/correctness/useExhaustiveDependencies: The revision retries the same catalog after a failed request.
  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    setLoadingPlans(true);
    setPlansError(null);
    axiosAuth
      .get(`${GATEWAY.subscription}/plans`, { signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted)
          setPlans(adaptPlans(Array.isArray(r.data) ? (r.data as Plan[]) : []));
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setPlansError("No se pudieron cargar los planes.");
        toast.error("No se pudieron cargar los planes. Intenta nuevamente.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPlans(false);
      });
    return () => controller.abort();
  }, [accessToken, catalogRevision]);

  if (!auth) return null;

  // — Vista de selección de planes —
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-foreground">Elige tu plan para continuar</h1>
          <p className="mt-2 text-muted-foreground">
            Tu cuenta no tiene un plan activo. Selecciona uno para acceder al panel de Powip.
          </p>
        </div>

        {loadingPlans && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            Cargando planes...
          </div>
        )}

        {plansError && (
          <div
            className="flex flex-col items-center justify-center gap-4 py-20 text-red-700"
            role="alert"
          >
            <p>{plansError}</p>
            <Button
              variant="outline"
              onClick={() => setCatalogRevision((revision) => revision + 1)}
            >
              Reintentar carga de planes
            </Button>
          </div>
        )}

        {!loadingPlans && !plansError && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative shadow-sm transition-all hover:shadow-lg flex flex-col ${
                  plan.popular ? "border-2 border-primary shadow-md lg:scale-105 z-10" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Más Popular
                    </span>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl font-bold uppercase tracking-tight">
                    PLAN {plan.name}
                  </CardTitle>
                  <CardDescription className="min-h-[40px]">{plan.description}</CardDescription>

                  {plan.name.toUpperCase().includes("ENTERPRISE") ? (
                    <div className="mt-4 flex items-center justify-center p-4 bg-muted rounded-lg">
                      <Building2 className="h-12 w-12 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-foreground">S/ {plan.price}</span>
                      <span className="text-sm text-muted-foreground">
                        / {plan.durationInDays >= 300 ? "año" : "mes"}
                      </span>
                    </div>
                  )}

                  {plan.target && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Público Objetivo:
                      </p>
                      <p className="text-sm text-foreground">{plan.target}</p>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Características:
                    </p>
                    <ul className="mb-6 space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span className="text-sm text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {plan.limits && plan.limits.length > 0 && (
                      <div className="mb-6">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                          Límites:
                        </p>
                        <ul className="space-y-3">
                          {plan.limits.map((limit) => (
                            <li key={limit} className="flex items-start gap-2">
                              <span className="text-sm text-muted-foreground">{limit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {plan.name.toUpperCase().includes("ENTERPRISE") ? (
                    <Button
                      className="w-full mt-auto"
                      variant="outline"
                      onClick={() => setIsEnterpriseModalOpen(true)}
                    >
                      Contactar con ventas
                    </Button>
                  ) : (
                    <Button
                      className="w-full mt-auto"
                      variant={plan.popular ? "default" : "outline"}
                      onClick={() =>
                        router.push(`/onboarding?planName=${encodeURIComponent(plan.name)}`)
                      }
                    >
                      Contratar
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={logout}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <EnterpriseContactModal
        open={isEnterpriseModalOpen}
        onClose={() => setIsEnterpriseModalOpen(false)}
      />
    </div>
  );
}
