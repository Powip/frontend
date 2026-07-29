import { redirect } from "next/navigation";

// "Seguimiento Courier" se fusionó dentro del módulo Operaciones nuevo,
// pestaña "Rastreo Courier" de Guías & Courier. Ver auditoría del
// 2026-07-27 y las decisiones del 2026-07-28.
export default function CouriersRedirect() {
  redirect("/operaciones/guias?tab=rastreo");
}
