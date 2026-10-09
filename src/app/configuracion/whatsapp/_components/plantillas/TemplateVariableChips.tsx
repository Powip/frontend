import type { WhatsAppTemplateVariableDefinition } from "@/features/whatsapp/constants/whatsapp-template-catalog";
import { toVariableToken } from "@/features/whatsapp/utils/template-variables.util";

interface TemplateVariableChipsProps {
  variables: WhatsAppTemplateVariableDefinition[];
  targetLabel: string;
  disabled?: boolean;
  onInsert: (key: string) => void;
}

export function TemplateVariableChips({
  variables,
  targetLabel,
  disabled = false,
  onInsert,
}: TemplateVariableChipsProps) {
  return (
    <fieldset className="min-w-0 space-y-1.5" aria-describedby="template-variable-target">
      <legend className="sr-only">Insertar variable</legend>
      <p id="template-variable-target" className="text-xs text-muted-foreground">
        Toca una variable para insertarla donde está el cursor. Se inserta en: {targetLabel}.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {variables.map((variable) => (
          <button
            key={variable.key}
            type="button"
            disabled={disabled}
            title={variable.label}
            aria-label={`Insertar variable ${variable.label} ${toVariableToken(variable.key)}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onInsert(variable.key)}
            className="rounded-md border bg-muted/50 px-2 py-1 font-mono text-xs font-semibold text-teal-700 transition-colors hover:border-teal-600 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:text-teal-300 dark:hover:bg-teal-500/10"
          >
            {toVariableToken(variable.key)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
