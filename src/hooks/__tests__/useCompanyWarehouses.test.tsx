import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCompanyWarehouses, warehouseNameOf } from "@/hooks/useCompanyWarehouses";
import { listWarehouses } from "@/services/warehousesService";
import * as OpsBits from "@/components/warehouse-ops/OpsBits";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", role: "ADMINISTRADOR" }, company: { id: "c1" } } }),
}));
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn() }));

const WAREHOUSES = [
  { id: "w1", name: "Central" },
  { id: "w2", name: "" },
];

describe("useCompanyWarehouses único (FEAT-24 H5/H10)", () => {
  it("nombre por id: «—» sin id y «Almacén» si no está o no tiene nombre", () => {
    expect(warehouseNameOf(WAREHOUSES, "w1")).toBe("Central");
    expect(warehouseNameOf(WAREHOUSES, "w2")).toBe("Almacén");
    expect(warehouseNameOf(WAREHOUSES, "w9")).toBe("Almacén");
    expect(warehouseNameOf(WAREHOUSES, null)).toBe("—");
    expect(warehouseNameOf(WAREHOUSES, undefined)).toBe("—");
  });

  it("lee la caché `company-warehouses` de la empresa y expone la query, la lista y el nombre", async () => {
    jest.mocked(listWarehouses).mockResolvedValue({ warehouses: WAREHOUSES, links: [] } as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useCompanyWarehouses(), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });
    await waitFor(() => expect(result.current.warehouses).toHaveLength(2));
    expect(result.current.nameOf("w1")).toBe("Central");
    expect(result.current.nameOf("otro")).toBe("Almacén");
    expect(result.current.query.isSuccess).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(client.getQueryData(["company-warehouses", "c1"])).toEqual({ warehouses: WAREHOUSES, links: [] });
  });

  it("las operaciones de almacén ya no tienen su propia copia", () => {
    expect(OpsBits).not.toHaveProperty("useCompanyWarehouses");
  });
});
