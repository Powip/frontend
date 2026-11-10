"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import type { SunatDocument } from "../models/sunat-document.model";
import { fetchAllSunatDocuments } from "../utils/fetch-all-sunat-documents";
import { findActiveTaxDocument } from "../utils/find-active-tax-document";

/**
 * Comprobante vigente (factura/boleta aceptada o en proceso) del pedido, o `null`.
 * Usa la misma consulta (misma clave de caché) que la pantalla de Facturación.
 * Mientras carga o si falla devuelve `null`: la advertencia es un aviso, nunca bloquea la acción.
 */
export function useActiveTaxDocumentForOrder(
  orderId: string | null | undefined,
  enabled = true,
): SunatDocument | null {
  const { auth } = useAuth();
  const { canFetch } = useBusinessScope();

  const query = useQuery({
    queryKey: ["business-tax-documents", auth?.company?.id, auth?.user?.id],
    enabled: enabled && canFetch && Boolean(orderId),
    queryFn: ({ signal }) => fetchAllSunatDocuments(signal),
    retry: false,
  });

  return useMemo(() => {
    if (!orderId || !query.data) return null;
    return findActiveTaxDocument(query.data.filter((document) => document.orderId === orderId));
  }, [orderId, query.data]);
}
