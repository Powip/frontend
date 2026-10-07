import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { toast } from "sonner";
import { partnersKeys } from "../../keys/partners.keys";
import {
  approveAdminApplication,
  rejectAdminApplication,
} from "../../services/decide-admin-application";
import { buildAxiosError } from "../../test-utils/axios-error";
import {
  useApproveAdminApplication,
  useRejectAdminApplication,
} from "../use-decide-admin-application";

jest.mock("../../services/decide-admin-application", () => ({
  approveAdminApplication: jest.fn(),
  rejectAdminApplication: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockApprove = jest.mocked(approveAdminApplication);
const mockReject = jest.mocked(rejectAdminApplication);

const INPUT = { applicationId: "app-1", reason: "Validación completada", idempotencyKey: "key-1" };

function buildWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateQueries = jest.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, invalidateQueries };
}

beforeEach(() => {
  mockApprove.mockReset();
  mockReject.mockReset();
  jest.mocked(toast.success).mockReset();
});

describe("useApproveAdminApplication", () => {
  it("al aprobar actualiza la cola de solicitudes y muestra el código devuelto por el backend", async () => {
    mockApprove.mockResolvedValue({
      applicationId: "app-1",
      partnerId: "partner-1",
      partnerStatus: "ACTIVE",
      code: "PARTNERDEMO",
    });
    const { wrapper, invalidateQueries } = buildWrapper();
    const { result } = renderHook(() => useApproveAdminApplication(), { wrapper });

    result.current.mutate(INPUT);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApprove.mock.calls[0][0]).toEqual(INPUT);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: partnersKeys.adminApplicationsAll(),
    });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("PARTNERDEMO"));
  });

  it("no reintenta la mutación automáticamente", async () => {
    mockApprove.mockRejectedValue(buildAxiosError(503));
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useApproveAdminApplication(), { wrapper });

    result.current.mutate(INPUT);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockApprove).toHaveBeenCalledTimes(1);
  });

  it("ante APPLICATION_STATE_CONFLICT refresca la cola", async () => {
    mockApprove.mockRejectedValue(
      buildAxiosError(409, {
        code: "APPLICATION_STATE_CONFLICT",
        message: "",
        correlationId: "corr",
        details: {},
      }),
    );
    const { wrapper, invalidateQueries } = buildWrapper();
    const { result } = renderHook(() => useApproveAdminApplication(), { wrapper });

    result.current.mutate(INPUT);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: partnersKeys.adminApplicationsAll(),
    });
  });

  it("ante otros errores no toca la cola", async () => {
    mockApprove.mockRejectedValue(buildAxiosError(403));
    const { wrapper, invalidateQueries } = buildWrapper();
    const { result } = renderHook(() => useApproveAdminApplication(), { wrapper });

    result.current.mutate(INPUT);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});

describe("useRejectAdminApplication", () => {
  it("al rechazar actualiza la cola de solicitudes", async () => {
    mockReject.mockResolvedValue({ applicationId: "app-1", status: "REJECTED" });
    const { wrapper, invalidateQueries } = buildWrapper();
    const { result } = renderHook(() => useRejectAdminApplication(), { wrapper });

    result.current.mutate({ ...INPUT, reason: "Motivo del rechazo" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: partnersKeys.adminApplicationsAll(),
    });
  });

  it("no reintenta la mutación automáticamente", async () => {
    mockReject.mockRejectedValue(buildAxiosError());
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useRejectAdminApplication(), { wrapper });

    result.current.mutate(INPUT);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockReject).toHaveBeenCalledTimes(1);
  });
});
