import axios from "axios";
import { type UpdateUserRequest, updateUser, updateUserStatus } from "@/services/userService";

jest.mock("axios");

beforeEach(() => jest.clearAllMocks());

test("profile updates strip passwords from callers built before the edit form fix", async () => {
  jest.mocked(axios.put).mockResolvedValue({ data: {} });
  const legacyRequest = { name: "Ana", roleName: "CUSTOM_SALES", password: "autofilled123" };
  await updateUser("colleague", legacyRequest as UpdateUserRequest, "token");
  const [, payload] = jest.mocked(axios.put).mock.calls[0];
  expect(payload).toEqual(expect.objectContaining({ name: "Ana", roleName: "CUSTOM_SALES" }));
  expect(payload).not.toHaveProperty("password");
});

test("status changes use authenticated PATCH with the expected prior state", async () => {
  jest.mocked(axios.patch).mockResolvedValue({
    data: { userId: "colleague", status: false, unrelated: "not exposed" },
  });
  await expect(
    updateUserStatus("colleague", { status: false, expectedStatus: true }, "token"),
  ).resolves.toEqual({ userId: "colleague", status: false });
  expect(axios.patch).toHaveBeenCalledWith(
    expect.stringMatching(/\/api\/v1\/auth\/user\/colleague\/status$/),
    { status: false, expectedStatus: true },
    { headers: { Authorization: "Bearer token", "Content-Type": "application/json" } },
  );
});

test.each([
  null,
  { userId: "another-user", status: false },
  { userId: "colleague", status: true },
  { userId: "colleague", status: "false" },
])("does not report success for an unconfirmed status response: %j", async (data) => {
  jest.mocked(axios.patch).mockResolvedValue({ data });
  await expect(
    updateUserStatus("colleague", { status: false, expectedStatus: true }, "token"),
  ).rejects.toThrow("El servidor no confirmó el estado del usuario");
});
