"use client";

import { useMemo } from "react";
import { barRuns, cachedBarcodeModules, cachedQrMatrix } from "@/lib/labels/codes";
import { barcodeRects, planLabel, PT_MM, qrRects } from "@/lib/labels/layout";
import { SAMPLE_LABEL_LINE, type LabelFormatShape, type LabelLine } from "@/lib/labels/types";

interface LabelPreviewProps {
  format: Pick<LabelFormatShape, "widthMm" | "heightMm" | "fields">;
  line?: LabelLine;
  storeName?: string | null;
  companyName?: string | null;
  /** Píxeles por mm en pantalla. */
  pxPerMm?: number;
}

/**
 * FEAT-24 H7 — vista previa en vivo de una etiqueta (SVG en mm). Usa la misma composición que el PDF
 * (`planLabel`), así lo que se ve es lo que se imprime.
 */
export function LabelPreview({
  format,
  line = SAMPLE_LABEL_LINE,
  storeName,
  companyName,
  pxPerMm = 3.4,
}: LabelPreviewProps) {
  const { widthMm: W, heightMm: H } = format;
  const elements = useMemo(
    () => planLabel(format, line, { storeName, companyName, hasLogo: false }),
    [format, line, storeName, companyName],
  );
  return (
    <svg
      role="img"
      aria-label={`Vista previa de la etiqueta de ${W}×${H} mm`}
      data-testid="label-preview"
      viewBox={`0 0 ${W} ${H}`}
      width={W * pxPerMm}
      height={H * pxPerMm}
      className="max-w-full h-auto"
    >
      <rect x={0} y={0} width={W} height={H} fill="#fff" stroke="#9ca3af" strokeWidth={0.25} strokeDasharray="1 0.8" />
      {elements.map((element, index) => {
        if (element.kind === "text") {
          return (
            <text
              key={index}
              x={element.x}
              y={element.y}
              fontSize={element.sizePt * PT_MM}
              fontWeight={element.bold ? 700 : 400}
              fontFamily="Helvetica, Arial, sans-serif"
              dominantBaseline="hanging"
              textAnchor={element.align === "center" ? "middle" : "start"}
              fill="#111"
            >
              {element.text}
            </text>
          );
        }
        if (element.kind === "logo") {
          return (
            <rect key={index} x={element.x} y={element.y} width={element.w} height={element.h} fill="none" stroke="#111" strokeWidth={0.2} />
          );
        }
        if (element.kind === "barcode") {
          const modules = cachedBarcodeModules(element.code, element.codeType);
          if (!modules) return null;
          return (
            <g key={index} data-testid="label-preview-barcode" data-code-type={element.codeType}>
              {barcodeRects(element, barRuns(modules), modules.length).map((r, i) => (
                <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="#000" />
              ))}
            </g>
          );
        }
        const matrix = cachedQrMatrix(element.text);
        if (!matrix) return null;
        return (
          <g key={index} data-testid="label-preview-qr">
            {qrRects(element, matrix.size, matrix.runs).map((r, i) => (
              <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="#000" />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
