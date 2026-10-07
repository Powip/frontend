"use client";

import { usePathname } from "next/navigation";
import { SimulatedDataNotice } from "@/components/partners/simulated-data-notice";

const CONNECTED_PATHS = ["/partners/admin/solicitudes"];

export function AdminSimulatedDataNotice() {
  const pathname = usePathname() ?? "";
  const isConnected = CONNECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (isConnected) return null;

  return (
    <div className="px-6 pt-6">
      <SimulatedDataNotice description="Esta sección de administración todavía no está conectada al servicio de Partners. Las solicitudes reales se gestionan en la pestaña Solicitudes." />
    </div>
  );
}
