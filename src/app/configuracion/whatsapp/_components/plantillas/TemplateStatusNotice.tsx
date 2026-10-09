import { Info } from "lucide-react";
import { WhatsAppPhonePreview } from "@/components/whatsapp/WhatsAppPhonePreview";
import {
  getTemplateSampleValues,
  WHATSAPP_TEMPLATE_QUICK_REPLY_TEXT,
  WHATSAPP_TEMPLATE_SAMPLE_DOCUMENT_NAME,
} from "@/features/whatsapp/constants/whatsapp-template-catalog";
import {
  WHATSAPP_TEMPLATE_HEADER_TYPES,
  WHATSAPP_TEMPLATE_STATUSES,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type {
  WhatsAppApprovedTemplateVersion,
  WhatsAppTemplate,
} from "@/features/whatsapp/models/template.model";
import { formatLimaDateTime } from "@/features/whatsapp/utils/lima-time.util";
import { TemplateStatusBadge } from "./TemplateStatusBadge";

function getStatusMessage(template: WhatsAppTemplate): string {
  switch (template.status) {
    case WHATSAPP_TEMPLATE_STATUSES.DRAFT:
      return "Borrador: todavía no se envió a Meta.";
    case WHATSAPP_TEMPLATE_STATUSES.PENDING:
      return "Meta está revisando esta plantilla. Podrás editarla cuando Meta responda.";
    case WHATSAPP_TEMPLATE_STATUSES.APPROVED:
      return "Si guardas cambios, la plantilla vuelve a revisión de Meta. Mientras tanto se sigue enviando la versión aprobada.";
    case WHATSAPP_TEMPLATE_STATUSES.REJECTED:
      return "Meta rechazó esta plantilla. Corrígela y vuelve a enviarla a revisión.";
    case WHATSAPP_TEMPLATE_STATUSES.PAUSED:
      return "Meta pausó esta plantilla. No se envía mientras siga pausada.";
  }
}

function ApprovedVersionPreview({
  version,
  businessName,
}: {
  version: WhatsAppApprovedTemplateVersion;
  businessName: string;
}) {
  return (
    <details className="group rounded-md border bg-background/60 p-2">
      <summary className="cursor-pointer text-sm font-medium">
        Ver la versión aprobada que se sigue enviando
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        Aprobada el {formatLimaDateTime(version.approvedAt)} (hora de Lima). Vista previa con datos
        de muestra.
      </p>
      <WhatsAppPhonePreview
        className="mt-2"
        businessName={businessName}
        body={version.body}
        values={getTemplateSampleValues()}
        header={
          version.header.type === WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT && version.header.text
            ? { type: "text", text: version.header.text }
            : version.header.type === WHATSAPP_TEMPLATE_HEADER_TYPES.DOCUMENT
              ? { type: "document", fileName: WHATSAPP_TEMPLATE_SAMPLE_DOCUMENT_NAME }
              : null
        }
        footer={version.footer}
        buttonText={version.buttonText}
        quickReplyText={version.quickReply ? WHATSAPP_TEMPLATE_QUICK_REPLY_TEXT : null}
      />
    </details>
  );
}

interface TemplateStatusNoticeProps {
  template: WhatsAppTemplate;
  isDuplicate: boolean;
  businessName: string;
}

export function TemplateStatusNotice({
  template,
  isDuplicate,
  businessName,
}: TemplateStatusNoticeProps) {
  if (isDuplicate) {
    return (
      <div className="flex gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="min-w-0">
          Estás creando una copia de{" "}
          <span className="break-all font-mono font-semibold">{template.name}</span>. La copia es
          una plantilla nueva y Meta la revisa desde cero.
        </p>
      </div>
    );
  }

  const showsReason =
    template.metaReason &&
    (template.status === WHATSAPP_TEMPLATE_STATUSES.REJECTED ||
      template.status === WHATSAPP_TEMPLATE_STATUSES.PAUSED);
  const showsApprovedVersion =
    template.approvedVersion &&
    (template.status === WHATSAPP_TEMPLATE_STATUSES.PENDING ||
      template.status === WHATSAPP_TEMPLATE_STATUSES.REJECTED);

  return (
    <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Estado en Meta:</span>
        <TemplateStatusBadge status={template.status} />
      </div>
      <p>{getStatusMessage(template)}</p>
      {showsReason && (
        <p className="text-red-700 dark:text-red-300">
          <span className="font-medium">Motivo informado por Meta:</span> {template.metaReason}
        </p>
      )}
      {showsApprovedVersion && template.approvedVersion && (
        <>
          <p className="text-muted-foreground">
            Mientras tanto se sigue enviando la versión aprobada anterior.
          </p>
          <ApprovedVersionPreview version={template.approvedVersion} businessName={businessName} />
        </>
      )}
    </div>
  );
}
