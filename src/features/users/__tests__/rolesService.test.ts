import axiosAuth from "@/lib/axiosAuth";
import { deleteCompanyRole, getRoleAccess } from "../rolesService";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), delete: jest.fn() },
}));
beforeEach(() => jest.clearAllMocks());
test.each([
  { userId: "other", companyId: "company" },
  { userId: "actor", companyId: "other" },
])("rejects access snapshot for another identity or company: %j", async (snapshot) => {
  jest
    .mocked(axiosAuth.get)
    .mockResolvedValue({ data: { ...snapshot, canRead: true, canWrite: true } });
  await expect(getRoleAccess("actor", "company")).rejects.toThrow("sesión del negocio cambió");
});
test("does not interpret string capability values as permission", async () => {
  jest.mocked(axiosAuth.get).mockResolvedValue({
    data: { userId: "actor", companyId: "company", canRead: "true", canWrite: "true" },
  });
  await expect(getRoleAccess("actor", "company")).resolves.toMatchObject({
    canRead: false,
    canWrite: false,
  });
});
test("delete passes server version and never a caller company", async () => {
  jest.mocked(axiosAuth.delete).mockResolvedValue({ status: 204 });
  await deleteCompanyRole("role/id", 7);
  expect(axiosAuth.delete).toHaveBeenCalledWith(
    expect.stringContaining("/api/v1/auth/company/roles/role%2Fid"),
    { params: { version: 7 } },
  );
});
