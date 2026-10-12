import type { Metadata } from "next";
import { BillingEvidencePageContent } from "./_components/billing-evidence-page-content";

export const metadata: Metadata = {
  title: "Evidencia operativa de Billing",
  description: "Observaciones reales de Billing y su vinculación, sin aprobación financiera.",
};
export default function PartnersAdminBillingEvidencePage() {
  return <BillingEvidencePageContent />;
}
