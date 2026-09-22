/**
 * Tests: useRegisterReferral
 *
 * Comportamiento verificado:
 * 1. Al mutar con éxito, invalida la query de referidos (para que la lista se actualice).
 * 2. Al mutar con éxito, muestra un toast de éxito con el nombre del negocio.
 * 3. Si el service rechaza, expone isError y muestra un toast de error.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useRegisterReferral } from "../use-register-referral";
import { registerReferral } from "../../services/register-referral";
import { partnersKeys } from "../../keys/partners.keys";
import type { PartnerReferral } from "../../models/partner-referral";

jest.mock("../../services/register-referral", () => ({
  registerReferral: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockRegisterReferral = jest.mocked(registerReferral);

const NEW_REFERRAL: PartnerReferral = {
  id: "ref-new",
  businessName: "Café Norte",
  origin: "manual",
  status: "correo_enviado",
  registeredAt: "2026-08-17",
  planName: "Standard",
  firstMonthCommission: null,
  recurringCommission: null,
};

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  const invalidateQueries = jest.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, invalidateQueries };
}

describe("useRegisterReferral", () => {
  beforeEach(() => {
    mockRegisterReferral.mockReset();
    jest.mocked(toast.success).mockReset();
    jest.mocked(toast.error).mockReset();
  });

  it("invalida la query de referidos al mutar con éxito", async () => {
    mockRegisterReferral.mockResolvedValue(NEW_REFERRAL);
    const { wrapper, invalidateQueries } = buildWrapper();
    const { result } = renderHook(() => useRegisterReferral(), { wrapper });

    result.current.mutate({
      businessName: "Café Norte",
      email: "cafe@norte.com",
      phone: "",
      planValue: "standard",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: partnersKeys.referrals() });
  });

  it("muestra un toast de éxito con el nombre del negocio", async () => {
    mockRegisterReferral.mockResolvedValue(NEW_REFERRAL);
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useRegisterReferral(), { wrapper });

    result.current.mutate({
      businessName: "Café Norte",
      email: "cafe@norte.com",
      phone: "",
      planValue: "standard",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Café Norte"));
  });

  it("muestra un toast de error cuando el service rechaza", async () => {
    mockRegisterReferral.mockRejectedValue(new Error("network error"));
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useRegisterReferral(), { wrapper });

    result.current.mutate({
      businessName: "Café Norte",
      email: "cafe@norte.com",
      phone: "",
      planValue: "standard",
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalled();
  });
});
