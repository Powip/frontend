import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PendingIntegrationNotice } from "@/components/whatsapp/PendingIntegrationNotice";
import type { WhatsAppCampaign } from "@/features/whatsapp/models/campaign.model";

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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resultados del envío</DialogTitle>
          <DialogDescription>{campaign?.name}</DialogDescription>
        </DialogHeader>
        {results ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {(
              [
                ["Enviados", results.sent],
                ["Entregados", results.delivered],
                ["Leídos", results.read],
                ["Abrieron el rastreo", results.clicked],
                ["No enviados", results.notSent],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{formatCount(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <PendingIntegrationNotice
            title="Resultados pendientes de integración"
            description="Los resultados de este envío se mostrarán cuando el historial esté disponible."
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
