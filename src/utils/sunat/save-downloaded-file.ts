import { DownloadedFile } from "@/models/sunat/downloaded-file";

/**
 * Triggers a browser "Save As" for an in-memory Blob, the same
 * object-URL + temporary-anchor trick already used inline in
 * ReportesTab's downloadCSV — pulled out here so it's shared instead
 * of duplicated per caller.
 */
export function saveBlobAs(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function saveDownloadedFile(file: DownloadedFile, filename: string): void {
  saveBlobAs(file.blob, filename);
}
