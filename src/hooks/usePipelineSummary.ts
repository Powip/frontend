import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface PipelineSummary {
  leads_this_month: number;
  contact_count: number;
  contact_rate: number;
  demo_count: number;
  demo_rate: number;
  close_rate: number;
  avg_cycle_time_days: number;
  uncontacted_24h: number;
  at_risk_7d: number;
  mrr_generated: number;
  targets: {
    contact: { meta: number; alert: number };
    demo: { meta: number; alert: number };
    close: { meta: number; alert: number };
    cycle: { meta: number; alert: number };
    uncontacted: { meta: number; alert: number };
    risk: { meta: number; alert: number };
  };
}

export const usePipelineSummary = (token?: string) => {
  return useQuery<PipelineSummary>({
    queryKey: ["pipeline-summary"],
    queryFn: async () => {
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const response = await axios.get("/api/superadmin/pipeline/summary", config);
      return response.data;
    },
    enabled: !!token,
  });
};
