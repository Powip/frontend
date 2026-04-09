import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leadService } from "@/services/leadService";

export const useLeads = (token?: string) => {
  return useQuery({
    queryKey: ["leads"],
    queryFn: () => leadService.getAllLeads(token),
    enabled: !!token,
  });
};

export const useUpdateLeadStage = (token?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newStage, oldStage }: { id: string; newStage: string; oldStage: string }) =>
      leadService.updateLeadStage(id, newStage, oldStage, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-activations"] });
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

export const useUpdateBulkLeads = (token?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, data }: { ids: string[]; data: any }) => leadService.updateBulkLeads(ids, data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
};

// ─── Activations ───
export const useLeadActivations = (token?: string) => {
  return useQuery({
    queryKey: ["lead-activations"],
    queryFn: () => leadService.getActivations(token),
    enabled: !!token,
  });
};

export const useCreateActivation = (token?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => leadService.createActivation(data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-activations"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
};

export const useUpdateActivation = (token?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      leadService.updateActivation(id, data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-activations"] });
      queryClient.invalidateQueries({ queryKey: ["lead-postventa"] });
    },
  });
};

// ─── Postventa ───
export const useLeadPostventa = (token?: string) => {
  return useQuery({
    queryKey: ["lead-postventa"],
    queryFn: () => leadService.getPostventa(token),
    enabled: !!token,
  });
};

export const useUpdatePostventa = (token?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      leadService.updatePostventa(id, data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-postventa"] });
    },
  });
};

export const useDeletePostventaLead = (token?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leadService.deleteLead(id, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-activations"] });
      queryClient.invalidateQueries({ queryKey: ["lead-postventa"] });
    },
  });
};
