import { Handshake } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PartnerCommissionOption } from "@/features/partners/models/partner-summary";

interface PartnerHeroCardProps {
  commissionOption: PartnerCommissionOption | undefined;
  isLoading: boolean;
}

export function PartnerHeroCard({ commissionOption, isLoading }: PartnerHeroCardProps) {
  return (
    <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="flex gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Handshake aria-hidden="true" className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">
            Ganas dos veces por cada negocio
          </h2>
          {isLoading || !commissionOption ? (
            <Skeleton className="mt-2 h-10 w-full max-w-sm" />
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">
              Opción {commissionOption.code}: <b className="text-foreground">{commissionOption.firstMonthPct}% el primer mes</b>{" "}
              + <b className="text-foreground">{commissionOption.recurringPct}% recurrente</b>. Se activa cuando el
              negocio paga.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
