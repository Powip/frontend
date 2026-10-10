import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ReferralOriginBadge } from "@/components/partners/referral-origin-badge";
import { ReferralStatusBadge } from "@/components/partners/referral-status-badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { PartnerReferral } from "@/features/partners/models/partner-referral";
import { getReferralTimeline } from "@/features/partners/utils/referral-timeline";

interface ReferralDetailDrawerProps {
  referral: PartnerReferral | null;
  onClose: () => void;
}

const STEP_DOT_CLASS: Record<string, string> = {
  done: "bg-green-500 border-green-500",
  active: "bg-primary border-primary ring-4 ring-primary/15",
  pending: "bg-background border-border",
  bad: "bg-destructive border-destructive",
};

export function ReferralDetailDrawer({ referral, onClose }: ReferralDetailDrawerProps) {
  return (
    <Sheet open={referral !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {referral && (
          <>
            <SheetHeader>
              <SheetTitle>{referral.businessName}</SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <ReferralOriginBadge origin={referral.origin} />
                {format(new Date(referral.registeredAt), "dd MMM yyyy", { locale: es })}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-2">
              <ReferralStatusBadge status={referral.status} />
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Estado reportado
              </p>
              <ol className="mt-3 space-y-4 border-l border-border pl-4">
                {getReferralTimeline(referral.status).map((step) => (
                  <li key={step.label} className="relative">
                    <span
                      className={cn(
                        "absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2",
                        STEP_DOT_CLASS[step.state],
                      )}
                    />
                    <p
                      className={cn(
                        "text-sm font-medium",
                        step.state === "pending" ? "text-muted-foreground" : "text-foreground",
                        step.state === "bad" && "text-destructive",
                      )}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">
                El historial de eventos no está disponible. Sólo se muestra el estado actual
                reportado por el backend.
              </p>
            </div>

            <div className="mt-6 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Comisión
              </p>
              <p className="mt-2 text-sm text-muted-foreground" role="status">
                Las comisiones todavía no están implementadas. Crear una empresa no confirma un pago
                ni activa una comisión.
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
