"use client";
import SubscriptionModal from "@/components/modals/subscriptionsModal";
import EnterpriseContactModal from "@/components/modals/EnterpriseContactModal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { Check, Building2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  durationInDays: number;
}
export interface FrontPlan extends Plan {
  priceFormatted: string;
  period: string;
  features: string[];
  popular: boolean;
  target?: string;
  limits?: string[];
}

const adaptPlans = (plans: Plan[]): FrontPlan[] =>
  plans.map((plan) => {
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

    return {
      ...plan,
      priceFormatted: `S/ ${plan.price}`,
      period: plan.name.toUpperCase().includes("ENTERPRISE") ? "" : "/ mes",
      features,
      target,
      limits,
      popular,
    };
  });

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<FrontPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<FrontPlan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isEnterpriseModalOpen, setIsEnterpriseModalOpen] =
    useState<boolean>(false);

  const { auth } = useAuth();

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_SUBS}/plans`,
        );
        if (response.status === 200) {
          const data: Plan[] = response.data;
          setPlans(adaptPlans(data));
        }
      } catch (error) {
        console.error(error);
        setError("No se pudieron cargar los planes.");
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  if (!auth) return null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Cargando planes...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Selecciona tu plan
            </h1>
            <p className="mt-2 text-muted-foreground">
              Elige el plan que mejor se adapte a tu negocio
            </p>
          </div>
          <Image
            src="/logo_icon.png"
            alt="Powip"
            width={48}
            height={48}
            className="rounded-lg"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <Card
              key={plan.name}
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
                    <span className="text-sm text-muted-foreground">
                      {plan.period}
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
                    onClick={() => {
                      setSelectedPlan(plan);
                      setIsModalOpen(true);
                    }}
                  >
                    Comprar
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <SubscriptionModal
        userId={auth.user?.id}
        userEmail={auth.user?.email}
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPlan(null);
        }}
        plan={selectedPlan}
      />
      <EnterpriseContactModal
        open={isEnterpriseModalOpen}
        onClose={() => setIsEnterpriseModalOpen(false)}
      />
    </div>
  );
}
