import type { Metadata } from "next";
import { PagosPageContent } from "./_components/pagos-page-content";

export const metadata: Metadata = {
  title: "Pagos",
  description: "Historial de liquidaciones, próxima liquidación y datos de cobro del partner.",
};

export default function PartnersPagosPage() {
  return <PagosPageContent />;
}
