import { redirect } from "next/navigation";

// "Centro de Envíos" se fusionó dentro del módulo Operaciones nuevo (ver
// auditoría del 2026-07-27 y las decisiones del 2026-07-28): su tablero y su
// bandeja de atención pasaron a /operaciones (Tablero), y su tabla de
// despacho pasó a /operaciones/pedidos. Este archivo queda solo como
// redirect para no romper enlaces existentes — la lógica real vive ahora en
// las páginas nuevas. Los componentes en ./components siguen en uso porque
// /ventas los importa directamente; no se tocaron.
export default function CentroEnviosRedirect() {
  redirect("/operaciones/pedidos?tab=despachar");
}
