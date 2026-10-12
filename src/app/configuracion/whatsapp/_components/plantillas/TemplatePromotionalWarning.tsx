import { TriangleAlert } from "lucide-react";
import { WaCallout } from "@/components/whatsapp/ui/WaCallout";

interface TemplatePromotionalWarningProps {
  terms: string[];
}

export function TemplatePromotionalWarning({ terms }: TemplatePromotionalWarningProps) {
  return (
    <div role="status">
      <WaCallout tone="amber" icon={TriangleAlert}>
        <p className="m-0">
          Meta suele rechazar plantillas de Utilidad con lenguaje promocional (descuentos, «compra
          ya»). Si quieres promocionar, usa la categoría Marketing.
        </p>
        <p className="m-0 mt-1 text-xs text-wa-muted">
          Detectado: {terms.map((term) => `«${term}»`).join(", ")}. Es solo una advertencia; puedes
          continuar.
        </p>
      </WaCallout>
    </div>
  );
}
