import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PayoutSettings } from "@/features/partners/models/payout-settings";
import { PAYOUT_METHOD_OPTIONS } from "@/features/partners/schemas/update-payout-settings.schema";

interface PayoutSettingsCardProps {
  settings: PayoutSettings | null | undefined;
  isLoading: boolean;
  onEdit: () => void;
}

export function PayoutSettingsCard({ settings, isLoading, onEdit }: PayoutSettingsCardProps) {
  return (
    <Card className="rounded-2xl">
      <CardContent>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Datos de cobro
        </p>
        {isLoading || settings === undefined ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : settings === null ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Todavía no registraste datos de cobro.
          </p>
        ) : (
          <div className="mt-2 space-y-1 text-sm text-foreground">
            <p>
              <span className="font-semibold">
                {PAYOUT_METHOD_OPTIONS.find((option) => option.value === settings.method)?.label}:
              </span>{" "}
              {settings.accountNumber}
            </p>
            <p>
              <span className="font-semibold">Titular:</span> {settings.accountHolder}
            </p>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          onClick={onEdit}
          disabled={isLoading || settings === undefined}
        >
          {settings === null ? "Registrar datos de cobro" : "Editar datos de cobro"}
        </Button>
      </CardContent>
    </Card>
  );
}
