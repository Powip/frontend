import { Copy, Eye, Pencil } from "lucide-react";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { WaMini, WaPill } from "@/components/whatsapp/ui/WaPill";
import {
  waButton,
  waTable,
  waTableWrap,
  waTd,
  waTemplateName,
  waTh,
  waTrClickable,
} from "@/components/whatsapp/ui/wa-classes";
import {
  getTemplateUsageDefinition,
  WHATSAPP_TEMPLATE_CATEGORY_OPTIONS,
} from "@/features/whatsapp/constants/whatsapp-template-catalog";
import {
  WHATSAPP_TEMPLATE_CATEGORIES,
  WHATSAPP_TEMPLATE_STATUSES,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import { cn } from "@/lib/utils";
import { TemplateStatusBadge } from "./TemplateStatusBadge";

interface TemplatesTableProps {
  templates: WhatsAppTemplate[];
  canManage: boolean;
  onEdit: (template: WhatsAppTemplate) => void;
  onDuplicate: (template: WhatsAppTemplate) => void;
}

const formatCount = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : value.toLocaleString("es-PE");

const formatPercent = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value}%`;

function AbSummary({ template }: { template: WhatsAppTemplate }) {
  const abTest = template.abTest;
  if (!abTest?.enabled) return null;
  if (!abTest.results) {
    return (
      <span className="mt-1 flex items-center justify-end gap-1.5 whitespace-nowrap text-[11.5px] text-wa-muted">
        <WaMini tone="teal">A/B</WaMini> en curso · sin resultados
      </span>
    );
  }
  const { a, b, winner } = abTest.results;
  return (
    <span className="mt-1 flex items-center justify-end gap-1.5 whitespace-nowrap text-[11.5px]">
      <WaMini tone="teal">A/B</WaMini>{" "}
      <span className={winner === "A" ? "font-semibold" : undefined}>
        A {formatPercent(a.readPct)}
      </span>
      {" · "}
      <span className={winner === "B" ? "font-semibold" : undefined}>
        B {formatPercent(b.readPct)}
      </span>
      {winner && <span className="sr-only">. Ganadora: versión {winner}</span>}
    </span>
  );
}

function StatusDetail({ template }: { template: WhatsAppTemplate }) {
  if (
    (template.status === WHATSAPP_TEMPLATE_STATUSES.REJECTED ||
      template.status === WHATSAPP_TEMPLATE_STATUSES.PAUSED) &&
    template.metaReason
  ) {
    return (
      <span className="mt-1 block max-w-[34ch] text-xs text-wa-red">{template.metaReason}</span>
    );
  }
  if (template.status === WHATSAPP_TEMPLATE_STATUSES.PENDING && template.approvedVersion) {
    return (
      <span className="mt-1 block max-w-[34ch] text-xs text-wa-muted">
        Mientras tanto se sigue enviando la versión aprobada anterior.
      </span>
    );
  }
  return null;
}

export function TemplatesTable({ templates, canManage, onEdit, onDuplicate }: TemplatesTableProps) {
  const stop = (event: MouseEvent) => event.stopPropagation();

  return (
    <div className={waTableWrap}>
      <table className={cn(waTable, "min-w-[860px] text-left")}>
        <caption className="sr-only">Plantillas de WhatsApp</caption>
        <thead>
          <tr>
            <th scope="col" className={waTh}>
              Plantilla
            </th>
            <th scope="col" className={waTh}>
              Se usa en
            </th>
            <th scope="col" className={waTh}>
              Categoría
            </th>
            <th scope="col" className={waTh}>
              Estado en Meta
            </th>
            <th scope="col" className={cn(waTh, "text-right")}>
              Enviados 30 d
            </th>
            <th scope="col" className={cn(waTh, "text-right")}>
              Leídos
            </th>
            <th scope="col" className={cn(waTh, "text-right")}>
              Abren rastreo
            </th>
            <th scope="col" className={waTh}>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => {
            const usageLabel = getTemplateUsageDefinition(template.usage)?.label ?? "Sin asignar";
            const categoryLabel =
              WHATSAPP_TEMPLATE_CATEGORY_OPTIONS.find(
                (option) => option.value === template.category,
              )?.label ?? template.category;
            const stats = template.stats30d;
            return (
              <tr
                key={template.id}
                className={cn(waTrClickable, "[&:last-child>td]:border-b-0")}
                onClick={() => onEdit(template)}
              >
                <td className={cn(waTd, "max-w-[340px]")}>
                  <span className={cn(waTemplateName, "block break-all")}>{template.name}</span>
                  <span className="block max-w-[42ch] truncate text-xs text-wa-muted">
                    {template.body.replace(/\s+/g, " ")}
                  </span>
                </td>
                <td className={waTd}>{usageLabel}</td>
                <td className={waTd}>
                  <WaPill
                    tone={
                      template.category === WHATSAPP_TEMPLATE_CATEGORIES.MARKETING
                        ? "purple"
                        : "neutral"
                    }
                  >
                    {categoryLabel}
                  </WaPill>
                </td>
                <td className={waTd}>
                  <TemplateStatusBadge status={template.status} />
                  <StatusDetail template={template} />
                </td>
                <td className={cn(waTd, "wa-num text-right")}>{formatCount(stats?.sent)}</td>
                <td className={cn(waTd, "wa-num text-right")}>
                  {formatPercent(stats?.readPct)}
                  <AbSummary template={template} />
                </td>
                <td className={cn(waTd, "wa-num text-right")}>{formatPercent(stats?.clickPct)}</td>
                <td className={cn(waTd, "whitespace-nowrap text-right")}>
                  <Button
                    type="button"
                    className={waButton({ variant: "ghost", size: "icon" })}
                    aria-label={`${canManage ? "Editar" : "Ver"} plantilla ${template.name}`}
                    onClick={(event) => {
                      stop(event);
                      onEdit(template);
                    }}
                  >
                    {canManage ? <Pencil aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </Button>
                  {canManage && (
                    <Button
                      type="button"
                      className={waButton({ variant: "ghost", size: "icon" })}
                      aria-label={`Duplicar plantilla ${template.name}`}
                      onClick={(event) => {
                        stop(event);
                        onDuplicate(template);
                      }}
                    >
                      <Copy aria-hidden="true" />
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
