export const salesKeys = {
  all: ["sales"] as const,

  lists: () => [...salesKeys.all, "list"] as const,

  byStore: (storeId: string) => [...salesKeys.lists(), "store", storeId] as const,

  details: () => [...salesKeys.all, "detail"] as const,

  detail: (id: string) => [...salesKeys.details(), id] as const,
};
