import { act, renderHook, waitFor } from "@testing-library/react";
import { getCompanyRoles, getRoleAccess } from "../rolesService";
import { useCompanyRoles } from "../useCompanyRoles";

let mockCompany = "company-a";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { user: { id: "actor" }, company: { id: mockCompany }, accessToken: "token" },
  }),
}));
jest.mock("../rolesService", () => ({
  getCompanyRoles: jest.fn(),
  getRoleAccess: jest.fn(),
  userError: (cause: Error) => cause.message,
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockCompany = "company-a";
  jest.mocked(getCompanyRoles).mockResolvedValue([]);
});
test("denied access does not request role data", async () => {
  jest.mocked(getRoleAccess).mockResolvedValue({
    userId: "actor",
    companyId: "company-a",
    canRead: false,
    canWrite: false,
  });
  const { result } = renderHook(() => useCompanyRoles());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(getCompanyRoles).not.toHaveBeenCalled();
  expect(result.current.roles).toEqual([]);
});
test("late access from previous company cannot fetch or populate new company roles", async () => {
  let resolve!: (value: Awaited<ReturnType<typeof getRoleAccess>>) => void;
  jest.mocked(getRoleAccess).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { result, rerender } = renderHook(() => useCompanyRoles());
  mockCompany = "company-b";
  jest.mocked(getRoleAccess).mockResolvedValue({
    userId: "actor",
    companyId: "company-b",
    canRead: false,
    canWrite: false,
  });
  rerender();
  await waitFor(() => expect(result.current.access?.companyId).toBe("company-b"));
  await act(async () =>
    resolve({ userId: "actor", companyId: "company-a", canRead: true, canWrite: true }),
  );
  expect(getCompanyRoles).not.toHaveBeenCalled();
  expect(result.current.access?.companyId).toBe("company-b");
});
