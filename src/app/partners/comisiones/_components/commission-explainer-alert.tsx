import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function CommissionExplainerAlert() {
  return (
    <Alert>
      <Info aria-hidden="true" />
      <AlertTitle>Cómo se calcula</AlertTitle>
      <AlertDescription>
        La comisión del 1er mes se paga sobre el neto realmente pagado (precio con el descuento
        de partner aplicado). Del mes 2 en adelante, la recurrente se calcula sobre el precio
        full.
      </AlertDescription>
    </Alert>
  );
}
