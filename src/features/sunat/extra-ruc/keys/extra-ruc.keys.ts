export const extraRucKeys = {
  all: ["extra-ruc"] as const,
  summary: () => [...extraRucKeys.all, "summary"] as const,
  purchase: (id: string) => [...extraRucKeys.all, "purchase", id] as const,
};
