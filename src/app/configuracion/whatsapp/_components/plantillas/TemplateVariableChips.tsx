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
    <fieldset
      className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0"
      aria-describedby="template-variable-target"
    >
      <legend className="sr-only">Insertar variable</legend>
      <p id="template-variable-target" className="m-0 text-xs text-wa-muted">
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
            className="cursor-pointer rounded-[7px] border border-wa-border bg-wa-surface-2 px-[9px] py-1 font-wa-mono text-xs font-semibold text-wa-teal outline-none transition-colors hover:border-wa-teal hover:bg-wa-teal-soft focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-wa-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {toVariableToken(variable.key)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
