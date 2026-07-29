import { redirect } from "next/navigation";

// "Seguimiento" se fusionó dentro del módulo Operaciones nuevo: la tabla de
// "Pedidos en Envío" pasó a /operaciones/pedidos (pestaña En Camino) y
// "Guías de Envío" pasó a /operaciones/guias (pestaña Guías Activas). Ver
// auditoría del 2026-07-27 y las decisiones del 2026-07-28.
export default function SeguimientoRedirect() {
  redirect("/operaciones/pedidos?tab=camino");
}
