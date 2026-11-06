import { Suspense } from "react";
import MerchantMercadoPagoSettings from "@/components/integrations/MerchantMercadoPagoSettings";

export default function MercadoPagoConfigPage() {
  return (
    <Suspense
      fallback={
        <p className="p-8" role="status">
          Cargando Mercado Pago…
        </p>
      }
    >
      <MerchantMercadoPagoSettings />
    </Suspense>
  );
}
