import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import axiosAuth from "@/lib/axiosAuth";
import { useTaxDocuments } from "../useTaxDocuments";

const sales = [
  {
    id: "order",
    storeId: "KUNCA",
    status: "ENTREGADO",
    createdAt: new Date("2026-11-27T15:00:00Z"),
    grandTotal: 250.32,
  },
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

const invoice = (id: string, grandTotal: number, cdrStatus = "ACCEPTED") => ({
  id,
  orderId: "order",
  taxDocumentType: "01",
  series: "F002",
  correlative: id === "f48" ? "00000048" : "00000049",
  cdrStatus,
  taxDocumentPayload: { totals: { grandTotal } },
});
const creditNote = (id: string, grandTotal: number, cdrStatus = "ACCEPTED") => ({
  id,
  orderId: "order",
  taxDocumentType: "07",
  series: "FC01",
  correlative: id,
  cdrStatus,
  referenceDocumentId: "f48",
  taxDocumentPayload: { totals: { grandTotal } },
});

async function rowFor(documents: unknown[]) {
  // The backend lists documents newest first: notes come before the invoice they credit.
  get.mockResolvedValue({ data: { items: documents, total: documents.length } });
  const { result } = renderHook(() => useTaxDocuments(), { wrapper });
  await waitFor(() => expect(result.current.documents).toHaveLength(documents.length));
  return { row: result.current.rows[0], result };
}

beforeEach(() => {
  get.mockReset();
});

it("una NC por el total deja la venta «Sin emitir» y conserva la factura anulada en el historial", async () => {
  const { row, result } = await rowFor([creditNote("nc1", 250.32), invoice("f48", 250.32)]);

  expect(row.taxDocument).toBeUndefined();
  expect(row.cancelledDocuments?.map((document) => document.id)).toEqual(["f48"]);
  expect(result.current.kpis.pendientes).toBe(1);
  expect(result.current.creditNotes.map((note) => note.id)).toEqual(["nc1"]);
});

it("una NC parcial no cambia nada: la factura sigue aceptada en la fila", async () => {
  const { row } = await rowFor([creditNote("nc1", 100), invoice("f48", 250.32)]);

  expect(row.taxDocument?.id).toBe("f48");
  expect(row.taxDocument?.cdrStatus).toBe("ACCEPTED");
  expect(row.cancelledDocuments).toBeUndefined();
});

it("varias NC que suman el total dejan la venta «Sin emitir»", async () => {
  const { row } = await rowFor([
    creditNote("nc2", 150.32),
    creditNote("nc1", 100),
    invoice("f48", 250.32),
  ]);

  expect(row.taxDocument).toBeUndefined();
  expect(row.cancelledDocuments?.map((document) => document.id)).toEqual(["f48"]);
});

it("una NC rechazada por SUNAT no anula la factura", async () => {
  const { row } = await rowFor([creditNote("nc1", 250.32, "REJECTED"), invoice("f48", 250.32)]);

  expect(row.taxDocument?.id).toBe("f48");
});

it("la nueva factura emitida tras la anulación ocupa la fila", async () => {
  const { row } = await rowFor([
    invoice("f49", 250.32),
    creditNote("nc1", 250.32),
    invoice("f48", 250.32),
  ]);

  expect(row.taxDocument?.id).toBe("f49");
  expect(row.cancelledDocuments?.map((document) => document.id)).toEqual(["f48"]);
});

it("una factura rechazada sin anular sigue mostrándose para resolverla", async () => {
  const { row } = await rowFor([invoice("f49", 250.32, "REJECTED")]);

  expect(row.taxDocument?.cdrStatus).toBe("REJECTED");
});
