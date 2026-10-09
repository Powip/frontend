import { CircleCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TemplateApprovedBannerProps {
  templateName: string;
  canActivateRule: boolean;
  onActivateRule: () => void;
  onDismiss: () => void;
}

export function TemplateApprovedBanner({
  templateName,
  canActivateRule,
  onActivateRule,
  onDismiss,
}: TemplateApprovedBannerProps) {
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950 sm:flex-row sm:items-center dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
    >
      <CircleCheck
        className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300"
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1">
        Meta aprobó <span className="break-all font-mono font-semibold">{templateName}</span>. Ya
        puedes usarla en un aviso automático.
      </p>
      <div className="flex items-center gap-2">
        {canActivateRule && (
          <Button type="button" size="sm" onClick={onActivateRule}>
            Activar en una regla
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label="Cerrar aviso de aprobación"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
