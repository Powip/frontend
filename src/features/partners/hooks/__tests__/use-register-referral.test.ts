import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { toast } from "sonner";
import { partnersKeys } from "../../keys/partners.keys";
import type { RegisteredReferral } from "../../models/registered-referral";
import { registerReferral } from "../../services/register-referral";
import { useRegisterReferral } from "../use-register-referral";

jest.mock("../../services/register-referral", () => ({
  registerReferral: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockRegisterReferral = jest.mocked(registerReferral);

const REGISTERED_REFERRAL: RegisteredReferral = {
  id: "ref-new",
  origin: "manual",
  status: "en_revision",
  registeredAt: "2026-09-24T15:00:00Z",
  expiresAt: "2026-11-23T15:00:00Z",
};

const INPUT = {
  values: { businessName: "Café Norte", email: "cafe@norte.com", phone: "" },
  idempotencyKey: "key-abc",
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

  it("pasa los valores y la Idempotency-Key al service", async () => {
    mockRegisterReferral.mockResolvedValue(REGISTERED_REFERRAL);
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useRegisterReferral(), { wrapper });

    result.current.mutate(INPUT);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRegisterReferral.mock.calls[0][0]).toEqual(INPUT);
  });

  it("invalida todas las queries de referidos (listado y últimos) al mutar con éxito", async () => {
    mockRegisterReferral.mockResolvedValue(REGISTERED_REFERRAL);
    const { wrapper, invalidateQueries } = buildWrapper();
    const { result } = renderHook(() => useRegisterReferral(), { wrapper });

    result.current.mutate(INPUT);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: partnersKeys.referralsAll() });
  });

  it("el toast de éxito nombra al negocio y no afirma que la invitación fue enviada", async () => {
    mockRegisterReferral.mockResolvedValue(REGISTERED_REFERRAL);
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useRegisterReferral(), { wrapper });

    result.current.mutate(INPUT);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const message = jest.mocked(toast.success).mock.calls[0][0] as string;
    expect(message).toContain("Café Norte");
    expect(message).toMatch(/revisión/i);
    expect(message).not.toMatch(/invitación enviada/i);
  });

  it("muestra un toast de error cuando el service rechaza", async () => {
    mockRegisterReferral.mockRejectedValue(new Error("network error"));
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useRegisterReferral(), { wrapper });

    result.current.mutate(INPUT);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalled();
  });
});
