"use client";

import { Download, Loader2, Printer } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DownloadFileResult } from "@/types/download-file.types";
import { downloadFile } from "@/utils/http/download-file";

import { PdfViewer } from "./PdfViewer";

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: DownloadFileResult | null;
  title?: string;
}

export function PdfPreviewDialog({
  open,
  onOpenChange,
  file,
  title,
}: PdfPreviewDialogProps) {
  const [printing, setPrinting] = useState(false);

  const handleDownload = () => {
    if (!file) return;
    downloadFile(file);
  };

  const handlePrint = () => {
    if (!file || printing) return;

    setPrinting(true);
    const url = URL.createObjectURL(file.blob);
    const iframe = document.createElement("iframe");

    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.border = "0";

    iframe.src = url;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        window.setTimeout(() => {
          iframe.remove();
          URL.revokeObjectURL(url);
          setPrinting(false);
        }, 1000);
      }
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Added sm:max-w-7xl to override the internal sm:max-w-lg rule from shadcn */}
      <DialogContent className="flex h-[95vh] w-[95vw] max-w-7xl sm:max-w-7xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="truncate">
            {title ?? file?.filename ?? "PDF"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto rounded-md border bg-muted/30 p-4">
          {file && <PdfViewer blob={file.blob} />}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleDownload}
            disabled={!file}
          >
            <Download className="mr-2 h-4 w-4" />
            Descargar
          </Button>

          <Button
            type="button"
            onClick={handlePrint}
            disabled={!file || printing}
          >
            {printing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            {printing ? "Preparando..." : "Imprimir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}