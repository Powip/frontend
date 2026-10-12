import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PendingIntegrationNotice } from "@/components/whatsapp/PendingIntegrationNotice";
import { WaDialogClose } from "@/components/whatsapp/ui/WaDialogClose";
import {
  waCaps,
  waDialogBody,
  waDialogContent,
  waDialogHeader,
  waDialogTitle,
} from "@/components/whatsapp/ui/wa-classes";
import type { WhatsAppCampaign } from "@/features/whatsapp/models/campaign.model";
import { cn } from "@/lib/utils";

interface CampaignResultsDialogProps {
  campaign: WhatsAppCampaign | null;
  onClose: () => void;
}

const formatCount = (value: number | null) =>
  value === null ? "—" : value.toLocaleString("es-PE");

export function CampaignResultsDialog({ campaign, onClose }: CampaignResultsDialogProps) {
  const results = campaign?.results ?? null;
  return (
    <Dialog open={!!campaign} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(waDialogContent, "flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-[500px]")}
      >
        <DialogHeader className={waDialogHeader}>
          <DialogTitle className={waDialogTitle}>Resultados del envío</DialogTitle>
          <WaDialogClose />
        </DialogHeader>
        <div className={cn(waDialogBody, "flex min-h-0 flex-col gap-3.5 overflow-y-auto")}>
          <DialogDescription className="m-0 text-sm font-medium text-wa-fg">
            {campaign?.name}
          </DialogDescription>
          {results ? (
            <dl className="m-0 grid grid-cols-2 gap-3">
              {(
                [
                  ["Enviados", results.sent],
                  ["Entregados", results.delivered],
                  ["Leídos", results.read],
                  ["Abrieron el rastreo", results.clicked],
                  ["No enviados", results.notSent],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-[14px] border border-wa-border bg-wa-surface px-4 py-3.5 shadow-wa"
                >
                  <dt className={waCaps}>{label}</dt>
                  <dd className="wa-num m-0 text-[22px] font-bold leading-tight">
                    {formatCount(value)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <PendingIntegrationNotice
              title="Resultados pendientes de integración"
              description="Los resultados de este envío se mostrarán cuando el historial esté disponible."
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
