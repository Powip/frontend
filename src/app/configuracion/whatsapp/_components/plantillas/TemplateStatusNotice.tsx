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
    <details className="group rounded-lg border border-wa-border bg-wa-surface p-2.5">
      <summary className="cursor-pointer text-[13px] font-medium">
        Ver la versión aprobada que se sigue enviando
      </summary>
      <p className="m-0 mt-2 text-xs text-wa-muted">
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
      <div className="flex gap-2.5 rounded-xl bg-wa-primary-soft px-4 py-3.5 text-[13px]">
        <Info className="mt-px size-[18px] shrink-0 text-wa-primary" aria-hidden="true" />
        <p className="m-0 min-w-0">
          Estás creando una copia de{" "}
          <span className="break-all font-wa-mono font-semibold">{template.name}</span>. La copia es
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
    <div className="flex flex-col gap-2 rounded-xl border border-wa-border bg-wa-surface-2 px-4 py-3.5 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Estado en Meta:</span>
        <TemplateStatusBadge status={template.status} />
      </div>
      <p className="m-0">{getStatusMessage(template)}</p>
      {showsReason && (
        <p className="m-0 text-wa-red">
          <span className="font-medium">Motivo informado por Meta:</span> {template.metaReason}
        </p>
      )}
      {showsApprovedVersion && template.approvedVersion && (
        <>
          <p className="m-0 text-wa-muted">
            Mientras tanto se sigue enviando la versión aprobada anterior.
          </p>
          <ApprovedVersionPreview version={template.approvedVersion} businessName={businessName} />
        </>
      )}
    </div>
  );
}
