import axios from "axios";

jest.mock("axios");
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

let service: typeof import("../onboardingService");
const previousUsersApi = process.env.NEXT_PUBLIC_API_USERS;
const usersApi = "https://auth.fixture.invalid/api/v1";

beforeAll(() => {
  process.env.NEXT_PUBLIC_API_USERS = usersApi;
  jest.isolateModules(() => { service = require("../onboardingService"); });
});

afterAll(() => {
  if (previousUsersApi === undefined) delete process.env.NEXT_PUBLIC_API_USERS;
  else process.env.NEXT_PUBLIC_API_USERS = previousUsersApi;
});

beforeEach(() => { jest.mocked(axios.post).mockReset(); });

it("onboarding login establishes the same-origin session and returns only its access token", async () => {
  jest.mocked(axios.post).mockResolvedValueOnce({ data: { accessToken: "fixture-access-token" } });

  await expect(service.loginAccount("onboarding@fixture.invalid", "fixture-password"))
    .resolves.toEqual({ accessToken: "fixture-access-token" });

  expect(axios.post).toHaveBeenCalledWith("/api/auth/login", {
    email: "onboarding@fixture.invalid", password: "fixture-password",
  }, { withCredentials: true });
});

it("account registration stays on ms-auth before the same-origin login", async () => {
  const account = {
    name: "Fixture", surname: "Account", email: "onboarding@fixture.invalid",
    password: "fixture-password", phoneNumber: "+51900000000", identityDocument: "00000000",
    address: "Fixture address", district: "Fixture district",
  };
  jest.mocked(axios.post).mockResolvedValueOnce({ data: { userId: "fixture-user" } });

  await expect(service.registerAccount(account)).resolves.toEqual({ userId: "fixture-user" });

  expect(axios.post).toHaveBeenCalledWith(`${usersApi}/auth/register`, account);
});
