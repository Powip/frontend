import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { isTaxDocumentEligibleStatus } from "@/features/sunat/shared/constants/sunat.constants";
import axiosAuth from "@/lib/axiosAuth";
import { useTaxDocuments } from "../useTaxDocuments";

const order = (id: string, status: string) => ({
  id,
  storeId: "KUNCA",
  status,
  createdAt: new Date("2026-10-01T15:00:00Z"),
  grandTotal: 100,
});
const sales = [
  order("delivered", "ENTREGADO"),
  order("shipping", "EN_ENVIO"),
  order("dispatched", "DESPACHADO"),
  order("pending", "PENDIENTE"),
  order("cancelled", "ANULADO"),
];
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: "company" }, user: { id: "user" } } }),
}));
jest.mock("@/contexts/BusinessScopeContext", () => ({
  useBusinessScope: () => ({ scopeKey: "company:user:store:KUNCA", canFetch: true }),
}));
jest.mock("@/features/sales/hooks/use-business-sales", () => ({
  useBusinessSales: () => ({ data: sales, isLoading: false, isError: false, refetch: jest.fn() }),
}));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("@/features/sunat/sunat-document/mappers/to-list-sunat-documents.mapper", () => ({
  toListSunatDocumentsResult: (dto: { items: unknown[]; total: number }) => ({
    documents: dto.items,
    total: dto.total,
  }),
}));
const get = jest.mocked(axiosAuth.get);
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  );
}

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: { items: [], total: 0 } });
});

it("solo EN_ENVIO y ENTREGADO son elegibles para emitir comprobantes", () => {
  expect(isTaxDocumentEligibleStatus("EN_ENVIO" as never)).toBe(true);
  expect(isTaxDocumentEligibleStatus("ENTREGADO" as never)).toBe(true);
  for (const status of [
    "DESPACHADO",
    "PENDIENTE",
    "PREPARADO",
    "ASIGNADO_A_GUIA",
    "ANULADO",
    "PAGADO",
  ]) {
    expect(isTaxDocumentEligibleStatus(status as never)).toBe(false);
  }
});

it("lista las ventas EN_ENVIO y ENTREGADO y deja fuera el resto", async () => {
  const { result } = renderHook(() => useTaxDocuments(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.rows.map((row) => row.sale.id).sort()).toEqual(["delivered", "shipping"]);
  expect(result.current.kpis.pendientes).toBe(2);
});
