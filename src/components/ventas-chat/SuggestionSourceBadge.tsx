import { Badge } from "@/components/ui/badge";
import type { ObjectionDetection } from "@/types/crmSalesTools";

const SOURCE_LABEL: Record<ObjectionDetection["source"], string> = { llm: "IA", mock: "Reglas" };

/** De dónde sale una sugerencia: la IA configurada en Pau o reglas (palabras clave y guion). */
export default function SuggestionSourceBadge({ source }: { source: ObjectionDetection["source"] }) {
  return (
    <Badge variant="outline" data-testid="suggestion-source">
      {SOURCE_LABEL[source]}
    </Badge>
  );
}
