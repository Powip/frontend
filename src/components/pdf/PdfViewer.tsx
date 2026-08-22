"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface PdfViewerProps {
  blob: Blob;
  className?: string;
}

export function PdfViewer({ blob, className }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [url, setUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [blob]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const style = window.getComputedStyle(container);
      const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      setContainerWidth(container.clientWidth - paddingX);
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  if (!url) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="text-sm text-muted-foreground">
          Cargando PDF...
        </span>
      </div>
    );
  }

  // Ensure page width doesn't collapse below 600px so content stays legible and triggers horizontal scroll
  const effectiveWidth = containerWidth > 0 ? Math.max(containerWidth, 600) : undefined;

  return (
    <div
      ref={containerRef}
      className={`w-full min-w-max flex flex-col items-center ${className ?? ""}`}
    >
      <Document
        file={url}
        onLoadSuccess={({ numPages: loadedNumPages }) => {
          setNumPages(loadedNumPages);
        }}
        loading={
          <div className="flex min-h-[60vh] items-center justify-center">
            <span className="text-sm text-muted-foreground">
              Cargando PDF...
            </span>
          </div>
        }
        error={
          <div className="flex min-h-[60vh] items-center justify-center">
            <span className="text-sm text-destructive">
              No se pudo cargar el PDF.
            </span>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-4">
          {Array.from({ length: numPages }, (_, index) => {
            const pageNumber = index + 1;

            return (
              <Page
                key={`page-${pageNumber}`}
                pageNumber={pageNumber}
                width={effectiveWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="shadow-md rounded-sm overflow-hidden"
              />
            );
          })}
        </div>
      </Document>
    </div>
  );
}