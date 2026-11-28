import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useCreateSunatDocuments } from "../use-create-sunat-documents";
import { createSunatDocuments } from "../../services/create-sunat-documents.service";

jest.mock("../../services/create-sunat-documents.service", () => ({
  createSunatDocuments: jest.fn(),
}));

describe("useCreateSunatDocuments", () => {
  it("invalida la lista de comprobantes de ventas tras emitir", async () => {
    (createSunatDocuments as jest.Mock).mockResolvedValue({
      documents: [{ id: "doc-1" }],
    });
    const queryClient = new QueryClient();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCreateSunatDocuments(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({} as never);
    });

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["business-tax-documents"] }),
    );
  });
});
