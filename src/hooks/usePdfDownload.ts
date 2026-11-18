"use client";

import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { buildPdfContext } from "@/lib/pdf/context";
import type { PdfDocSpec } from "@/lib/pdf/document";

/**
 * FEAT-24 H10-D4 — descarga un PDF con el encabezado común (empresa o tienda, logo) y el pie (usuario, fecha
 * de impresión y página). Devuelve una promesa: la pantalla muestra el error si falla.
 */
export function usePdfDownload() {
  const { auth } = useAuth();
  const company = auth?.company;
  const user = auth?.user;
  return useCallback(
    async (spec: PdfDocSpec, options: { storeId?: string | null } = {}) => {
      // jsPDF se carga recién al imprimir (no pesa en la carga de la pantalla).
      const [{ downloadPdf }, context] = await Promise.all([import("@/lib/pdf/document"), buildPdfContext(company, user, { storeId: options.storeId })]);
      downloadPdf(spec, context);
    },
    [company, user],
  );
}

/** Usuario que genera un Excel (va en la hoja «Filtros»). */
export function useReportAuthor(): string {
  const { auth } = useAuth();
  const user = auth?.user;
  return [user?.name, user?.surname].filter(Boolean).join(" ").trim() || user?.email || "";
}
