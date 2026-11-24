"use client";

import { useEffect, useRef, type ClipboardEvent } from "react";
import { cn } from "@/lib/utils";
import { sanitizeDescriptionHtml } from "@/lib/catalog/productContent";

/** Estilos del HTML de la descripción (sin plugin de tipografía). */
export const DESCRIPTION_HTML_CLASS =
  "text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground " +
  "[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_h4]:mt-2 [&_h4]:font-semibold " +
  "[&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 " +
  "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left";

const TOOLS: Array<{ label: string; title: string; run: () => void }> = [
  { label: "B", title: "Negrita", run: () => document.execCommand("bold") },
  { label: "I", title: "Cursiva", run: () => document.execCommand("italic") },
  { label: "Título", title: "Título", run: () => document.execCommand("formatBlock", false, "<h2>") },
  { label: "Subtítulo", title: "Subtítulo", run: () => document.execCommand("formatBlock", false, "<h3>") },
  { label: "Párrafo", title: "Párrafo", run: () => document.execCommand("formatBlock", false, "<p>") },
  { label: "• Lista", title: "Lista", run: () => document.execCommand("insertUnorderedList") },
];

const escapeText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * FEAT-32 M1 (spec §5.2 y §6.5) — descripción con «Vista» (editor visual) y «Ver HTML». Lo que se muestra y lo
 * que se pega pasa por la misma lista blanca que el backend; el HTML importado de Shopify se ve igual.
 */
export default function DescriptionEditor({
  value,
  onChange,
  editable,
  mode,
  onMode,
  label,
}: {
  value: string;
  onChange: (html: string) => void;
  editable: boolean;
  mode: "vis" | "html";
  onMode: (mode: "vis" | "html") => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Sincroniza el editor cuando el valor cambia desde afuera (otro canal, «Descartar», «Ver HTML»), nunca
  // mientras se escribe (movería el cursor).
  useEffect(() => {
    const element = ref.current;
    if (!element || document.activeElement === element) return;
    const clean = sanitizeDescriptionHtml(value);
    if (element.innerHTML !== clean) element.innerHTML = clean;
  }, [value, mode, editable]);

  const emit = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    const insert = html ? sanitizeDescriptionHtml(html) : escapeText(text).replace(/\r?\n/g, "<br>");
    document.execCommand("insertHTML", false, insert);
    emit();
  };

  return (
    <div className="space-y-2">
      <div className="inline-flex rounded-lg border bg-muted/40 p-0.5" role="group" aria-label="Modo de la descripción">
        {(["vis", "html"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            onClick={() => onMode(option)}
            className={cn("rounded-md px-3 py-1 text-xs font-medium", mode === option ? "bg-background shadow-sm" : "text-muted-foreground")}
          >
            {option === "vis" ? "Vista" : "Ver HTML"}
          </button>
        ))}
      </div>
      {mode === "vis" ? (
        <>
          {editable ? (
            <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Formato">
              {TOOLS.map((tool) => (
                <button
                  key={tool.title}
                  type="button"
                  title={tool.title}
                  aria-label={tool.title}
                  className={cn("rounded-md border bg-background px-2.5 py-1 text-xs hover:bg-muted", tool.label === "B" && "font-bold", tool.label === "I" && "italic")}
                  // mousedown para no perder la selección del editor.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    tool.run();
                    emit();
                  }}
                >
                  {tool.label}
                </button>
              ))}
            </div>
          ) : null}
          {editable ? (
            <div
              ref={ref}
              role="textbox"
              aria-multiline="true"
              aria-label={label}
              contentEditable
              suppressContentEditableWarning
              onInput={emit}
              onBlur={emit}
              onPaste={onPaste}
              className={cn("min-h-[180px] rounded-md border bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring", DESCRIPTION_HTML_CLASS)}
            />
          ) : (
            <div
              aria-label={label}
              className={cn("min-h-[80px] rounded-md border bg-muted/30 px-3 py-2", DESCRIPTION_HTML_CLASS)}
              // Saneado con la lista blanca (también lo sanea el backend).
              dangerouslySetInnerHTML={{ __html: sanitizeDescriptionHtml(value) || "<p>Sin descripción.</p>" }}
            />
          )}
        </>
      ) : (
        <textarea
          aria-label={`${label} en HTML`}
          value={value}
          readOnly={!editable}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-[220px] w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
        />
      )}
      <p className="text-xs text-muted-foreground">
        Se guarda en HTML: la descripción importada de Shopify se conserva igual, con sus imágenes y tablas. Los scripts y los estilos raros se quitan al guardar.
      </p>
    </div>
  );
}
