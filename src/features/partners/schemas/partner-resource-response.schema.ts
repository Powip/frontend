import z from "zod";

// The backend owns the host allowlist. This additional client boundary rejects
// executable, credential-bearing or local URLs instead of rendering them.
function isPublicHttpsResource(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const hasControl = Array.from(value).some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    );
    return (
      !hasControl &&
      value === value.trim() &&
      !value.includes("\\") &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (!url.port || url.port === "443") &&
      host.includes(".") &&
      !host.endsWith(".") &&
      !/^[\d.]+$/.test(host) &&
      !host.includes(":") &&
      !/(^|\.)(localhost|local|internal|lan|invalid|test)$/.test(host)
    );
  } catch {
    return false;
  }
}

export const partnerResourceResponseSchema = z
  .object({
    id: z.uuid(),
    title: z.string().min(1).max(200),
    description: z.string().max(1_000).nullable(),
    kind: z.enum(["VIDEO", "PDF", "LOGOS"]),
    category: z.string().min(1).max(80),
    downloadUrl: z.string().max(2_048).refine(isPublicHttpsResource).nullable(),
  })
  .strict();

export const partnerResourcePageResponseSchema = z
  .object({
    items: z.array(partnerResourceResponseSchema).max(200),
  })
  .strict();
