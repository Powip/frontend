import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { PartnerTierBadge } from "@/components/partners/partner-tier-badge";
import type { AdminPartner } from "@/features/partners/models/admin-partner";
import type { AdminPartnerReferral } from "@/features/partners/models/admin-partner-referral";

interface PartnerActivityTabProps {
  partner: AdminPartner | null | undefined;
  referrals: AdminPartnerReferral[] | undefined;
  isLoading: boolean;
}

interface ActivityItem {
  title: React.ReactNode;
  date: string | null;
}

export function PartnerActivityTab({ partner, referrals, isLoading }: PartnerActivityTabProps) {
  if (isLoading || !partner || !referrals) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const mostRecentReferral = [...referrals].sort(
    (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime(),
  )[0];

  const items: ActivityItem[] = [];

  if (mostRecentReferral) {
    items.push({
      title: (
        <>
          Registró a <b>{mostRecentReferral.businessName}</b> como referido
        </>
      ),
      date: mostRecentReferral.registeredAt,
    });
  }

  items.push({
    title: (
      <>
        Nivel actual: <PartnerTierBadge level={partner.tierLevel} />
      </>
    ),
    date: null,
  });

  if (partner.joinedAt) {
    items.push({ title: "Se unió al programa de partners", date: partner.joinedAt });
  }

  return (
    <ol className="space-y-4 border-l border-border pl-4">
      {items.map((item, index) => (
        <li key={index} className="relative">
          <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-primary bg-primary" />
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
            {item.title}
          </p>
          {item.date && (
            <p className="text-xs text-muted-foreground">
              {format(new Date(item.date), "dd MMM yyyy", { locale: es })}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
