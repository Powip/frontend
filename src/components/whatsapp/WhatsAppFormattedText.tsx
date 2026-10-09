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
                "rounded border border-dashed border-amber-500 px-0.5 font-mono text-[0.85em] text-amber-700 dark:text-amber-300",
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
            className={cn(styleClassName, highlightVariables && "rounded bg-emerald-500/20 px-0.5")}
          >
            {segment.value}
          </span>
        );
      })}
    </>
  );
}
