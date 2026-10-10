"use client";

import { usePathname } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";

const CONNECTED_PATHS = ["/partners/admin/solicitudes"];

export function AdminUnavailableFeaturesNotice() {
  const pathname = usePathname() ?? "";
  const isConnected = CONNECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (isConnected) return null;

  return (
    <div className="px-6 pt-6">
      <Alert role="note">
        <AlertDescription>
          Esta sección todavía tiene funciones pendientes de implementación. No se muestran datos de
          ejemplo ni se registran pagos o cambios locales. Las solicitudes reales se gestionan en
          Solicitudes.
        </AlertDescription>
      </Alert>
    </div>
  );
}
