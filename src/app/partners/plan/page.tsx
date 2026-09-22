import type { Metadata } from "next";
import { PlanPageContent } from "./_components/plan-page-content";

export const metadata: Metadata = {
  title: "Mi Plan",
  description: "Opciones de comisión, simulador de ingresos y comparativa por plan.",
};

export default function PartnersPlanPage() {
  return <PlanPageContent />;
}
