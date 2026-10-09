import { useQuery } from "@tanstack/react-query";
import axios from "axios";

/** Respuesta de GET /shopify/health de ms-integrations (FEAT-22 M3). */
export type ShopifyHealthReport = {
  generatedAt: string;
  lastAuditAt: string | null;
  summary: {
    ok: number;
    error: number;
    token_revocado: number;
    plan_impago: number;
    desinstalada: number;
    dlq: number | null;
    retrying: number | null;
    openIssues: number;
  };
  shops: Array<{
    shopUrl: string;
    companyId: string;
    healthStatus: string;
    lastSuccessAt: string | null;
    lastError: string | null;
    lastErrorAt: string | null;
    needsReauthorization: boolean;
  }>;
  issues: Array<{
    shopUrl: string;
    orderName: string | null;
    orderNumber: string | null;
    type: string;
    detail: string;
    detectedAt: string;
  }>;
};

export const useShopifyHealth = (token?: string) =>
  useQuery({
    queryKey: ["shopify-health"],
    queryFn: async () => {
      const res = await axios.get<ShopifyHealthReport>("/api/superadmin/shopify-health", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    },
    enabled: !!token,
  });
