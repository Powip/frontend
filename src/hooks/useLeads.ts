import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leadService } from "@/services/leadService";

export const useLeads = () => {
  return useQuery({
    queryKey: ["leads"],
    queryFn: () => leadService.getAllLeads(),
    enabled: true,
  });
};

export const useUpdateLeadStage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newStage, oldStage }: { id: string; newStage: string; oldStage: string }) =>
      leadService.updateLeadStage(id, newStage, oldStage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-activations"] });
    },
  });
};

export const useActivateLead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leadService.activateLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
};

export const useUpdateBulkLeads = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, data }: { ids: string[]; data: any }) => leadService.updateBulkLeads(ids, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
};

// ─── Activations ───
export const useLeadActivations = () => {
  return useQuery({
    queryKey: ["lead-activations"],
    queryFn: () => leadService.getActivations(),
    enabled: true,
  });
};

export const useCreateActivation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => leadService.createActivation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-activations"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
};

export const useUpdateActivation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      leadService.updateActivation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-activations"] });
      queryClient.invalidateQueries({ queryKey: ["lead-postventa"] });
    },
  });
};

// ─── Postventa ───
export const useLeadPostventa = () => {
  return useQuery({
    queryKey: ["lead-postventa"],
    queryFn: () => leadService.getPostventa(),
    enabled: true,
  });
};

export const useUpdatePostventa = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      leadService.updatePostventa(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-postventa"] });
    },
  });
};

export const useDeletePostventaLead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leadService.deleteLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-activations"] });
      queryClient.invalidateQueries({ queryKey: ["lead-postventa"] });
    },
  });
};
