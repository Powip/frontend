import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leadService } from "@/services/leadService";

export const useLeads = (token?: string) => {
  return useQuery({
    queryKey: ["leads"],
    queryFn: () => leadService.getAllLeads(token),
    enabled: !!token, // Only fetch if we have a token
  });
};

export const useUpdateLeadStage = (token?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newStage, oldStage }: { id: string; newStage: string; oldStage: string }) =>
      leadService.updateLeadStage(id, newStage, oldStage, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
};

export const useActivateLead = (token?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leadService.activateLead(id, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
};
