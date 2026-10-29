import { Card, CardContent } from "@/components/ui/card";
export function MinimumThresholdCard() {
  return (
    <Card className="rounded-2xl">
      <CardContent>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Umbral mínimo
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          El umbral aplicable todavía no está disponible en la API de políticas financieras. Los
          datos de cobro no lo configuran.
        </p>
      </CardContent>
    </Card>
  );
}
