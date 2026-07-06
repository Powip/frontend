import { useQuery } from "@tanstack/react-query";
import axiosAuth from "@/lib/axiosAuth";

export interface PipelineSummary {
  leads_this_month: number;
  leads_previous_month: number;
  closed_count: number;
  closed_this_month: number;
  closed_previous_month: number;
  contact_count: number;
  contact_rate: number;
  demo_count: number;
  demo_rate: number;
  close_rate: number;
  effectiveness: number;
  avg_cycle_time_days: number;
  uncontacted_24h: number;
  at_risk_7d: number;
  mrr_generated: number;
  states_count: Record<string, number>;
  salesperson_breakdown: Array<{ salesperson: string; managed_leads: number; closed_leads: number }>;
  targets: {
    contact: { meta: number; alert: number };
    demo: { meta: number; alert: number };
    close: { meta: number; alert: number };
    cycle: { meta: number; alert: number };
    uncontacted: { meta: number; alert: number };
    risk: { meta: number; alert: number };
  };
}

export const usePipelineSummary = () => {
  return useQuery<PipelineSummary>({
    queryKey: ["pipeline-summary"],
    queryFn: async () => {
      const response = await axiosAuth.get("/api/superadmin/pipeline/summary");
      return response.data;
    },
    enabled: true,
  });
};
