import type { DownloadFileResult } from "@/types/download-file.types";

export function downloadFile({
  blob,
  filename,
}: DownloadFileResult): void {
  if (!filename) {
    console.warn("downloadFile: no filename received from Content-Disposition header");
  }

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename ?? ""; 

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.URL.revokeObjectURL(url);
}