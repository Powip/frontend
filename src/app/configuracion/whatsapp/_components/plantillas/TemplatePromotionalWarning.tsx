import { TriangleAlert } from "lucide-react";

interface TemplatePromotionalWarningProps {
  terms: string[];
}

export function TemplatePromotionalWarning({ terms }: TemplatePromotionalWarningProps) {
  return (
    <div
      role="status"
      className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <TriangleAlert
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300"
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-1">
        <p>
          Meta suele rechazar plantillas de Utilidad con lenguaje promocional (descuentos, «compra
          ya»). Si quieres promocionar, usa la categoría Marketing.
        </p>
        <p className="text-xs">
          Detectado: {terms.map((term) => `«${term}»`).join(", ")}. Es solo una advertencia; puedes
          continuar.
        </p>
      </div>
    </div>
  );
}
