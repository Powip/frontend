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

export function adaptPlans<T extends { name: string }>(plans: T[]): (T & PlanMarketing)[] {
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
