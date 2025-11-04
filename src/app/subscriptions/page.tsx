"use client";
import SubscriptionModal from "@/components/modals/subscriptionsModal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

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
}
const rawPlans: Plan[] = [
  {
    id: "99999999-8888-7777-6666-555555555555",
    name: "Basic",
    description: "Perfecto para emprendedores que están comenzando",
    price: 9.99,
    durationInDays: 30,
  },
  {
    id: "88888888-7777-6666-5555-444444444444",
    name: "Medium",
    description: "Ideal para negocios en crecimiento",
    price: 24.99,
    durationInDays: 90,
  },
  {
    id: "77777777-6666-5555-4444-333333333333",
    name: "Premium",
    description: "Para negocios establecidos que necesitan todo",
    price: 49.99,
    durationInDays: 365,
  },
];

const adaptPlans = (plans: Plan[]): FrontPlan[] =>
  plans.map((plan) => ({
    ...plan,
    priceFormatted: `$${plan.price.toFixed(2)}`,
    period:
      plan.durationInDays === 30
        ? "/mes"
        : plan.durationInDays === 90
        ? "/3 meses"
        : "/año",
    features:
      plan.name === "Basic"
        ? [
            "Hasta 100 productos",
            "1 usuario",
            "Gestión de inventario básica",
            "Registro de ventas",
            "Soporte por email",
          ]
        : plan.name === "Medium"
        ? [
            "Hasta 500 productos",
            "5 usuarios",
            "Gestión completa de inventario",
            "CRM y facturación",
            "Reportes avanzados",
            "Soporte prioritario",
          ]
        : [
            "Productos ilimitados",
            "Usuarios ilimitados",
            "Todas las funcionalidades",
            "Integraciones avanzadas",
            "API personalizada",
            "Soporte 24/7",
            "Capacitación personalizada",
          ],
    popular: plan.name === "Medium",
  }));

export default function SubscriptionsPage() {
  const plans: FrontPlan[] = adaptPlans(rawPlans);
  const [selectedPlan, setSelectedPlan] = useState<FrontPlan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

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
            src="/powip-logo.jpeg"
            alt="Powip"
            width={48}
            height={48}
            className="rounded-lg"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative shadow-sm transition-all hover:shadow-lg ${
                plan.popular
                  ? "border-2 border-primary shadow-md md:scale-105"
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
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">
                    ${plan.price}
                  </span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="mb-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <span className="text-sm text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => {
                    setSelectedPlan(plan);
                    setIsModalOpen(true);
                  }}
                >
                  Comprar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <SubscriptionModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPlan(null);
        }}
        plan={selectedPlan}
      />
    </div>
  );
}
