import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { waButton } from "@/components/whatsapp/ui/wa-classes";

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
      className="flex flex-wrap items-center gap-3 rounded-xl bg-wa-teal-soft px-4 py-3.5 text-[13px] text-wa-fg"
    >
      <Check className="size-[18px] shrink-0 text-wa-teal" aria-hidden="true" />
      <p className="m-0 min-w-0 flex-1">
        Meta aprobó <b className="break-all font-semibold">{templateName}</b>. Ya puedes usarla en
        un aviso automático.
      </p>
      <div className="flex items-center gap-1.5">
        {canActivateRule && (
          <Button
            type="button"
            className={waButton({ variant: "primary", size: "sm" })}
            onClick={onActivateRule}
          >
            Activar en una regla
          </Button>
        )}
        <Button
          type="button"
          className={waButton({ variant: "ghost", size: "icon" })}
          aria-label="Cerrar aviso de aprobación"
          onClick={onDismiss}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
