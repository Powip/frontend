const CLEANUP_DELAY_MS = 5 * 60_000;

/**
 * Prints a PDF through a hidden frame, so the user gets the print dialog without an extra tab. If
 * the browser does not let the frame print, the PDF opens in a tab instead (its viewer has Print).
 */
export function printPdfBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");

  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, "_blank");
    }
  };
  frame.src = url;
  document.body.appendChild(frame);

  setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(url);
  }, CLEANUP_DELAY_MS);
}
