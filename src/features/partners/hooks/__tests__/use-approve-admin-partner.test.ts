/**
 * Tests: useApproveAdminPartner
 *
 * Comportamiento verificado:
 * 1. Al aprobar con éxito, invalida la lista de partners y escribe el partner actualizado
 *    en la cache de su detalle individual.
 * 2. Muestra un toast de éxito con el nombre y el código del partner.
 * 3. Si el service rechaza, expone isError y muestra un toast de error.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useApproveAdminPartner } from "../use-approve-admin-partner";
import { approveAdminPartner } from "../../services/approve-admin-partner";
import { partnersKeys } from "../../keys/partners.keys";
import type { AdminPartner } from "../../models/admin-partner";

jest.mock("../../services/approve-admin-partner", () => ({
  approveAdminPartner: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockApproveAdminPartner = jest.mocked(approveAdminPartner);

const APPROVED_PARTNER: AdminPartner = {
  id: "partner-carlos-ruiz",
  name: "Carlos Ruiz",
  handle: "@carlosecom",
  code: "CARLOS10",
  profile: "creador",
  commissionOptionCode: "C",
  status: "activo",
  tierLevel: "bronce",
  joinedAt: "2026-09-23",
  payoutMethodLabel: null,
  referralsCount: 0,
  activeReferralsCount: 0,
  mrr: 0,
  ticketPromedio: 0,
  conversionPct: 0,
  ltvEstimado: 0,
  recurringCommissionMonthly: 0,
};

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  const invalidateQueries = jest.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient, invalidateQueries };
}

describe("useApproveAdminPartner", () => {
  beforeEach(() => {
    mockApproveAdminPartner.mockReset();
    jest.mocked(toast.success).mockReset();
    jest.mocked(toast.error).mockReset();
  });

  it("invalida la lista y escribe el detalle en cache al aprobar con éxito", async () => {
    mockApproveAdminPartner.mockResolvedValue(APPROVED_PARTNER);
    const { wrapper, queryClient, invalidateQueries } = buildWrapper();
    const { result } = renderHook(() => useApproveAdminPartner(), { wrapper });

    result.current.mutate("partner-carlos-ruiz");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: partnersKeys.adminPartners() });
    expect(queryClient.getQueryData(partnersKeys.adminPartner("partner-carlos-ruiz"))).toEqual(
      APPROVED_PARTNER,
    );
  });

  it("muestra un toast de éxito con el nombre y el código", async () => {
    mockApproveAdminPartner.mockResolvedValue(APPROVED_PARTNER);
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useApproveAdminPartner(), { wrapper });

    result.current.mutate("partner-carlos-ruiz");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Carlos Ruiz"));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("CARLOS10"));
  });

  it("muestra un toast de error cuando el service rechaza", async () => {
    mockApproveAdminPartner.mockRejectedValue(new Error("network error"));
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useApproveAdminPartner(), { wrapper });

    result.current.mutate("partner-carlos-ruiz");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalled();
  });
});
