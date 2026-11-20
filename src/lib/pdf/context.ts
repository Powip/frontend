import { loadImageAsDataUrl } from "@/lib/labels/logo";
import type { PdfCompany, PdfContext } from "./document";

// FEAT-24 H10-D4 — de dónde salen los datos del encabezado y del pie: la empresa
// de la sesión (nombre, RUC, dirección, teléfono y logo), la tienda si el
// documento es de una, y el usuario que imprime.

export interface PdfAuthCompany {
  name?: string | null;
  cuit?: string | null;
  billingAddress?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  stores?: Array<{ id: string; name: string }>;
}

export interface PdfAuthUser {
  email?: string | null;
  name?: string | null;
  surname?: string | null;
}

/** «Ana Pérez» o, sin nombre, el correo. */
export function pdfUserName(user: PdfAuthUser | null | undefined): string {
  const full = [user?.name, user?.surname].filter((part) => part && part.trim()).join(" ").trim();
  return full || user?.email || "Usuario";
}

export function pdfCompany(company: PdfAuthCompany | null | undefined, options: { storeId?: string | null; logoDataUrl?: string | null } = {}): PdfCompany {
  const store = options.storeId ? company?.stores?.find((item) => item.id === options.storeId) : undefined;
  return {
    name: company?.name || "Mi empresa",
    ruc: company?.cuit || null,
    address: company?.billingAddress || null,
    phone: company?.phone || null,
    storeName: store?.name ?? null,
    logoDataUrl: options.logoDataUrl ?? null,
  };
}

/** Contexto completo; el logo se baja como data URL (si no se puede, va sin logo). */
export async function buildPdfContext(
  company: PdfAuthCompany | null | undefined,
  user: PdfAuthUser | null | undefined,
  options: { storeId?: string | null; now?: Date; loadLogo?: (url: string | null | undefined) => Promise<string | null> } = {},
): Promise<PdfContext> {
  const logoDataUrl = await (options.loadLogo ?? loadImageAsDataUrl)(company?.logoUrl);
  return {
    company: pdfCompany(company, { storeId: options.storeId, logoDataUrl }),
    userName: pdfUserName(user),
    printedAt: options.now ?? new Date(),
  };
}
