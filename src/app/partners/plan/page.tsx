import type { Metadata } from "next";
import { PlanPageContent } from "./_components/plan-page-content";

export const metadata: Metadata = {
  title: "Mi Plan",
  description: "Estado de disponibilidad de las condiciones del programa de Partners.",
};

export default function PartnersPlanPage() {
  return <PlanPageContent />;
}
