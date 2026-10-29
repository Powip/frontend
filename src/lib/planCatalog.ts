import { basePlanName } from "@/lib/onboardingPlan";

/**
 * Textos comerciales de cada plan (público objetivo, features y límites),
 * según el nombre. Los usan /sin-plan y el paso de plan del onboarding.
 */
export interface PlanMarketing {
  features: string[];
  popular: boolean;
  target?: string;
  limits?: string[];
}

/** Basic, Medium y Scale incluyen lo mismo: solo cambia el volumen de pedidos. */
const SHARED_FEATURES = [
  "Todos los módulos incluidos",
  "Usuarios ilimitados",
  "Todos tus canales de venta",
  "Inventario y almacenes",
  "Automatización de envíos",
  "Reportes y métricas",
  "Soporte por chat",
];

/**
 * Nombre comercial de los planes cuyo nombre en el backend es otro (Medium → Standard,
 * Scale → Full). Solo cambia lo que se muestra: el plan que se contrata sigue siendo el del backend.
 */
const DISPLAY_NAMES: Record<string, string> = {
  medium: "Standard",
  scale: "Full",
};

export function planDisplayName(name: string): string {
  const base = basePlanName(name);
  return DISPLAY_NAMES[base.toLowerCase()] ?? base;
}

export function adaptPlans<T extends { name: string }>(plans: T[]): (T & PlanMarketing)[] {
  return plans.map((plan) => {
    let features: string[] = [];
    let target = "";
    const limits: string[] = [];
    let popular = false;

    if (plan.name.toUpperCase().includes("BASIC")) {
      target = "Ideal para empezar";
      features = ["Hasta 1,000 pedidos/mes", ...SHARED_FEATURES];
    } else if (plan.name.toUpperCase().includes("MEDIUM")) {
      target = "Para negocios en crecimiento";
      features = ["Hasta 2,000 pedidos/mes", ...SHARED_FEATURES];
      popular = true;
    } else if (plan.name.toUpperCase().includes("SCALE")) {
      target = "Para altos volúmenes";
      features = ["Hasta 6,000 pedidos/mes", ...SHARED_FEATURES];
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
