export interface DownloadedFile {
  blob: Blob;
  /** Suggested filename, parsed from Content-Disposition when present. */
  filename: string | null;
}
