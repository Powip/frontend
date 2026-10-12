import { type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axiosAuth from "@/lib/axiosAuth";
import { useCompanyCouriers } from "../useCompanyCouriers";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
let mockCompany: string | undefined = "perspective";
let mockToken: string | undefined = "session-token";
let mockUser = "owner";
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: {
  company: mockCompany ? { id: mockCompany } : undefined,
  user: { id: mockUser }, accessToken: mockToken,
} }) }));

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { wrapper };
}

beforeEach(() => {
  jest.clearAllMocks(); mockCompany = "perspective"; mockUser = "owner"; mockToken = "session-token";
});

it("loads the company's real Shalom courier with authentication and cancellation", async () => {
  const courier = { id: "real-shalom-id", name: "Shalom", companyId: "perspective", isActive: true };
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: [courier] });
  const { result } = renderHook(() => useCompanyCouriers(), setup());
  await waitFor(() => expect(result.current.couriers).toEqual([courier]));
  expect(axiosAuth.get).toHaveBeenCalledWith(expect.stringContaining("/couriers/company/perspective"), expect.objectContaining({
    headers: { Authorization: "Bearer session-token" }, signal: expect.any(AbortSignal), timeout: 15_000,
  }));
});

it("distinguishes a failed catalogue request from an empty catalogue and recovers on retry", async () => {
  jest.mocked(axiosAuth.get).mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce({ data: [] });
  const { result } = renderHook(() => useCompanyCouriers(), setup());
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.couriers).toEqual([]);
  await act(async () => { await result.current.retry(); });
  await waitFor(() => expect(result.current.error).toBe(false));
  expect(result.current.couriers).toEqual([]);
  expect(axiosAuth.get).toHaveBeenCalledTimes(2);
});

it("does not reuse a previous company's couriers when identity changes", async () => {
  jest.mocked(axiosAuth.get).mockResolvedValueOnce({ data: [{ id: "a", name: "Shalom", companyId: "perspective" }] })
    .mockImplementationOnce(() => new Promise(() => {}));
  const { result, rerender } = renderHook(() => useCompanyCouriers(), setup());
  await waitFor(() => expect(result.current.couriers).toHaveLength(1));
  mockCompany = "another-company"; mockUser = "another-owner";
  rerender();
  expect(result.current.couriers).toEqual([]);
  expect(result.current.loading).toBe(true);
});

it.each([{ data: {} }, { data: [{ id: "foreign", name: "Shalom", companyId: "another-company" }] }])(
  "rejects an invalid or foreign-company catalogue response", async (response) => {
    jest.mocked(axiosAuth.get).mockResolvedValue(response);
    const { result } = renderHook(() => useCompanyCouriers(), setup());
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.couriers).toEqual([]);
  },
);

it("does not request company data without a session or when the modal is closed", () => {
  mockToken = undefined;
  const { result, rerender } = renderHook(({ enabled }) => useCompanyCouriers(enabled), { ...setup(), initialProps: { enabled: true } });
  expect(result.current.loading).toBe(false);
  mockToken = "session-token";
  rerender({ enabled: false });
  expect(axiosAuth.get).not.toHaveBeenCalled();
});
