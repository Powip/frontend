import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getClients,
  getClientById,
  getClientByPhone,
  searchClients,
  getClientsByCompany,
  createClient,
  updateClient,
  deleteClient,
  disableClient,
  enableClient,
} from "../api/Clientes";
import { IClient } from "../api/Interfaces"; 

// =============================
// QUERIES
// =============================

// Todos los clientes
export const useClients = () => {
  return useQuery<IClient[], Error>({
    queryKey: ["clients"],
    queryFn: getClients,
  });
};

// Cliente por ID
export const useClientById = (id: string) => {
  return useQuery<IClient, Error>({
    queryKey: ["client", id],
    queryFn: () => getClientById(id),
    enabled: !!id,
  });
};

// Cliente por Teléfono
export const useClientByPhone = (phone: string) => {
  return useQuery<IClient, Error>({
    queryKey: ["client-phone", phone],
    queryFn: () => getClientByPhone(phone),
    enabled: !!phone,
  });
};

// Buscar clientes por documento o RUC
export const useSearchClients = (query: string) => {
  return useQuery<IClient[], Error>({
    queryKey: ["clients-search", query],
    queryFn: () => searchClients(query),
    enabled: !!query,
  });
};

// Clientes por empresa
export const useClientsByCompany = (companyId: string) => {
  return useQuery<IClient[], Error>({
    queryKey: ["clients-company", companyId],
    queryFn: () => getClientsByCompany(companyId),
    enabled: !!companyId,
  });
};

// =============================
// MUTATIONS
// =============================

// Crear cliente
export const useCreateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["createClient"],
    mutationFn: createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
};

// Actualizar cliente
export const useUpdateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, client }: { id: string; client: Partial<IClient> }) =>
      updateClient(id, client),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
};

// Eliminar cliente
export const useDeleteClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
};

// Desactivar cliente
export const useDisableClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disableClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
};

// Activar cliente
export const useEnableClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: enableClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
};
