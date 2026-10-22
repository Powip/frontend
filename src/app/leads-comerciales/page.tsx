import { Suspense } from "react";
import CommercialLeadsWorkspace from "@/components/commercial-leads/CommercialLeadsWorkspace";
export default function CommercialLeadsPage() {
  return (
    <Suspense
      fallback={
        <p className="p-6" role="status">
          Cargando Leads…
        </p>
      }
    >
      <CommercialLeadsWorkspace />
    </Suspense>
  );
}
