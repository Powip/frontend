import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSoles } from "@/features/partners/utils/format-currency";
import type { PartnerNextPayout } from "@/features/partners/models/partner-summary";

interface NextPayoutCardProps {
  nextPayout: PartnerNextPayout | undefined;
  isLoading: boolean;
}

export function NextPayoutCard({ nextPayout, isLoading }: NextPayoutCardProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Próxima liquidación</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !nextPayout ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <div className="rounded-xl bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground">
            <p className="text-xs font-medium uppercase tracking-wide opacity-85">
              Se deposita el {format(new Date(nextPayout.payoutDate), "dd MMM yyyy", { locale: es })}
            </p>
            <p className="mt-1.5 text-3xl font-extrabold">{formatSoles(nextPayout.amount)}</p>
            <div className="mt-3 divide-y divide-white/15 border-t border-white/15">
              {nextPayout.breakdown.map((item) => (
                <div key={item.label} className="flex justify-between py-2 text-sm">
                  <span className="opacity-90">{item.label}</span>
                  <span className="font-semibold">{formatSoles(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
