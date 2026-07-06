"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Check, Building2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import OnboardingClient from "@/app/onboarding/OnboardingClient";
import EnterpriseContactModal from "@/components/modals/EnterpriseContactModal";

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  durationInDays: number;
}

interface FrontPlan extends Plan {
  features: string[];
  popular: boolean;
  target?: string;
  limits?: string[];
}

function adaptPlans(plans: Plan[]): FrontPlan[] {
  return plans.map((plan) => {
    let features: string[] = [];
    let target = "";
    let limits: string[] = [];
    let popular = false;

    if (plan.name.toUpperCase().includes("BASIC")) {
      target = "Emprendedores pequeños (IG + WA)";
      features = [
        "Hasta 300 pedidos / mes",
        "2 usuarios",
        "WhatsApp Básico",
        "Reportes Simples",
        "Soporte Estándar",
        "Gestión básica de pedidos",
      ];
      limits = ["No incluye automatización"];
    } else if (plan.name.toUpperCase().includes("MEDIUM")) {
      target = "Tiendas Shopify, marcas activas, COD";
      features = [
        "Hasta 700 pedidos / mes",
        "Multiusuario",
        "WhatsApp Automatizado",
        "Estados automáticos",
        "Reportes Completos",
        "Soporte Estándar",
      ];
      popular = true;
    } else if (plan.name.toUpperCase().includes("SCALE")) {
      target = "Empresas en crecimiento";
      features = [
        "Hasta 2,000 pedidos / mes",
        "Multiusuario",
        "WhatsApp Automatizado",
        "Reglas automáticas e IA básica",
        "Reportes Avanzados",
        "Soporte Prioritario",
      ];
    } else if (plan.name.toUpperCase().includes("ENTERPRISE")) {
      target = "Grandes corporaciones";
      features = [
        "Pedidos Ilimitados",
        "Usuarios Ilimitados",
        "WhatsApp Automatizado",
        "Integraciones custom y White label",
        "Gerente de cuenta dedicado",
        "Reportes avanzados y personalizados",
      ];
    }

    return { ...plan, features, target, limits, popular };
  });
}

export default function SinPlanPage() {
  const { auth, logout, updateSubscription } = useAuth();
  const router = useRouter();

  const [plans, setPlans] = useState<FrontPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<FrontPlan | null>(null);
  const [isEnterpriseModalOpen, setIsEnterpriseModalOpen] = useState(false);

  useEffect(() => {
    axiosAuth
      .get(`${GATEWAY.subscription}/api/v1/plans`)
      .then((r) => setPlans(adaptPlans(r.data as Plan[])))
      .catch(() => {
        setPlansError("No se pudieron cargar los planes.");
        toast.error("No se pudieron cargar los planes. Recargá la página para intentar nuevamente.");
      })
      .finally(() => setLoadingPlans(false));
  }, []);

  if (!auth) return null;

  const initialAuth = {
    accessToken: auth.accessToken,
    userId: auth.user.id,
  };

  const handleSubscriptionComplete = () => {
    updateSubscription(true);
    router.push("/dashboard");
  };

  // — Vista del flujo de suscripción (plan seleccionado) —
  if (selectedPlan) {
    return (
      <div className="min-h-screen" style={{ background: "#f7f5ff" }}>
        <div className="px-4 py-3 flex items-center gap-2" style={{ background: "#4F3A96" }}>
          <button
            onClick={() => setSelectedPlan(null)}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Ver otros planes
          </button>
        </div>
        <OnboardingClient
          planId={selectedPlan.id}
          planName={selectedPlan.name}
          price={selectedPlan.price}
          isAnnual={selectedPlan.durationInDays >= 360}
          initialAuth={initialAuth}
          onGoToDashboard={handleSubscriptionComplete}
        />
      </div>
    );
  }

  // — Vista de selección de planes —
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-foreground">
            Elegí tu plan para continuar
          </h1>
          <p className="mt-2 text-muted-foreground">
            Tu cuenta no tiene un plan activo. Seleccioná uno para acceder al panel de Powip.
          </p>
        </div>

        {loadingPlans && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            Cargando planes...
          </div>
        )}

        {plansError && (
          <div className="flex items-center justify-center py-20 text-red-500">
            {plansError}
          </div>
        )}

        {!loadingPlans && !plansError && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative shadow-sm transition-all hover:shadow-lg flex flex-col ${
                  plan.popular
                    ? "border-2 border-primary shadow-md lg:scale-105 z-10"
                    : ""
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
                  <CardDescription className="min-h-[40px]">
                    {plan.description}
                  </CardDescription>

                  {plan.name.toUpperCase().includes("ENTERPRISE") ? (
                    <div className="mt-4 flex items-center justify-center p-4 bg-muted rounded-lg">
                      <Building2 className="h-12 w-12 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-foreground">
                        S/ {plan.price}
                      </span>
                      <span className="text-sm text-muted-foreground">/ mes</span>
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
                          <span className="text-sm text-muted-foreground">
                            {feature}
                          </span>
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
                              <span className="text-sm text-muted-foreground">
                                {limit}
                              </span>
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
                      onClick={() => setSelectedPlan(plan)}
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
