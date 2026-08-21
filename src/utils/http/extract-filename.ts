export function extractFilename(contentDisposition?: string): string | null {
  if (!contentDisposition) {
    return null;
  }

  // Prefer RFC 5987 / RFC 6266 encoded filename.
  const encodedFilenameMatch = contentDisposition.match(
    /filename\*=UTF-8''([^;]+)/i,
  );

  if (encodedFilenameMatch?.[1]) {
    try {
      return decodeURIComponent(encodedFilenameMatch[1]);
    } catch {
      return encodedFilenameMatch[1];
    }
  }

  // Fallback to the traditional filename="..."
  const filenameMatch = contentDisposition.match(
    /filename="([^"]+)"/i,
  );

  if (filenameMatch?.[1]) {
    return filenameMatch[1];
  }

  // Also support filename=foo.pdf without quotes.
  const unquotedFilenameMatch = contentDisposition.match(
    /filename=([^;]+)/i,
  );

  return unquotedFilenameMatch?.[1]?.trim() ?? null;
}