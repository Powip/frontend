import type { Metadata } from "next";
import { PartnerApplicationForm } from "./_components/partner-application-form";

export const metadata: Metadata = {
  title: "Solicitar ser partner",
  description: "Enviá tu solicitud para unirte al programa de partners de Powip.",
};

export default function PartnerApplicationPage() {
  return (
    <div className="p-6">
      <PartnerApplicationForm />
    </div>
  );
}
