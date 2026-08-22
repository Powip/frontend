import { FlaskConical } from "lucide-react";

/** className para aplicar al <Card> que envuelve contenido 100% simulado (sin fuente real). */
export const SIMULADO_CARD_CLASS = "border-destructive/25 bg-destructive/[0.03]";

/** Marca visual consistente para secciones que todavía no tienen fuente de dato real. */
export function SimuladoBadge() {
  return (
    <span
      title="Todavía no existe una fuente de dato real para esto en el backend — se muestra un valor de ejemplo."
      className="ml-2 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 align-middle text-[9.5px] font-bold text-destructive"
    >
      <FlaskConical className="h-2.5 w-2.5" />
      Simulado
    </span>
  );
}
