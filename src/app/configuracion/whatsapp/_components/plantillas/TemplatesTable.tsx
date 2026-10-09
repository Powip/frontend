import { Copy, Eye, Pencil } from "lucide-react";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  getTemplateUsageDefinition,
  WHATSAPP_TEMPLATE_CATEGORY_OPTIONS,
} from "@/features/whatsapp/constants/whatsapp-template-catalog";
import { WHATSAPP_TEMPLATE_STATUSES } from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
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
      <span className="block text-xs text-muted-foreground">A/B en curso · sin resultados</span>
    );
  }
  const { a, b, winner } = abTest.results;
  return (
    <span className="block text-xs text-muted-foreground">
      A/B ·{" "}
      <span className={winner === "A" ? "font-semibold text-foreground" : undefined}>
        A {formatPercent(a.readPct)}
      </span>
      {" · "}
      <span className={winner === "B" ? "font-semibold text-foreground" : undefined}>
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
      <span className="mt-1 block max-w-[34ch] text-xs text-red-700 dark:text-red-300">
        {template.metaReason}
      </span>
    );
  }
  if (template.status === WHATSAPP_TEMPLATE_STATUSES.PENDING && template.approvedVersion) {
    return (
      <span className="mt-1 block max-w-[34ch] text-xs text-muted-foreground">
        Mientras tanto se sigue enviando la versión aprobada anterior.
      </span>
    );
  }
  return null;
}

export function TemplatesTable({ templates, canManage, onEdit, onDuplicate }: TemplatesTableProps) {
  const stop = (event: MouseEvent) => event.stopPropagation();

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[860px] border-collapse text-left text-sm">
        <caption className="sr-only">Plantillas de WhatsApp</caption>
        <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Plantilla
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Se usa en
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Categoría
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Estado en Meta
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              Enviados 30 d
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              Leídos
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
              Abren rastreo
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">
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
                className="cursor-pointer border-t align-top hover:bg-muted/40"
                onClick={() => onEdit(template)}
              >
                <td className="max-w-[300px] px-3 py-3">
                  <span className="block break-all font-mono text-[13px] font-semibold">
                    {template.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {template.body.replace(/\s+/g, " ")}
                  </span>
                </td>
                <td className="px-3 py-3">{usageLabel}</td>
                <td className="px-3 py-3">
                  <span className="rounded-full border px-2 py-0.5 text-xs font-medium">
                    {categoryLabel}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <TemplateStatusBadge status={template.status} />
                  <StatusDetail template={template} />
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{formatCount(stats?.sent)}</td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatPercent(stats?.readPct)}
                  <AbSummary template={template} />
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatPercent(stats?.clickPct)}
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={`${canManage ? "Editar" : "Ver"} plantilla ${template.name}`}
                      onClick={(event) => {
                        stop(event);
                        onEdit(template);
                      }}
                    >
                      {canManage ? (
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                    {canManage && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label={`Duplicar plantilla ${template.name}`}
                        onClick={(event) => {
                          stop(event);
                          onDuplicate(template);
                        }}
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
