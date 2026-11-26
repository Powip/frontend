import { useMemo } from "react";
import {
  renderTemplateSegments,
  type TemplateVariableValues,
} from "@/features/whatsapp/utils/template-render.util";
import { cn } from "@/lib/utils";

interface WhatsAppFormattedTextProps {
  text: string;
  values?: TemplateVariableValues;
  highlightVariables?: boolean;
}

export function WhatsAppFormattedText({
  text,
  values,
  highlightVariables = false,
}: WhatsAppFormattedTextProps) {
  const segments = useMemo(() => renderTemplateSegments(text, values ?? {}), [text, values]);

  return (
    <>
      {segments.map((segment, index) => {
        const styleClassName = cn(segment.bold && "font-bold", segment.italic && "italic");
        const key = `${segment.type}-${index}`;
        if (segment.type === "text") {
          return styleClassName ? (
            <span key={key} className={styleClassName}>
              {segment.text}
            </span>
          ) : (
            <span key={key}>{segment.text}</span>
          );
        }
        if (segment.value === null) {
          return (
            <span
              key={key}
              className={cn(
                styleClassName,
                "rounded border border-dashed border-wa-amber px-0.5 font-wa-mono text-[0.85em] text-wa-amber",
              )}
              title={`Sin valor para {{${segment.name}}}`}
            >
              {`{{${segment.name}}}`}
            </span>
          );
        }
        return (
          <span
            key={key}
            className={cn(
              styleClassName,
              highlightVariables &&
                "rounded-[4px] bg-[color-mix(in_srgb,var(--wa-whatsapp)_18%,transparent)] px-0.5",
            )}
          >
            {segment.value}
          </span>
        );
      })}
    </>
  );
}
