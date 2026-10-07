import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import {
  approveAdminApplicationApi,
  getAdminApplicationsApi,
  rejectAdminApplicationApi,
  submitPartnerApplicationApi,
} from "../partner-applications.api";

jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.test/v1/partners" },
}));

jest.mock("axios", () => {
  const actual = jest.requireActual("axios");
  return { ...actual, __esModule: true, default: { ...actual.default, post: jest.fn() } };
});

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const mockPublicPost = jest.mocked(axios.post);
const mockGet = jest.mocked(axiosAuth.get);
const mockPost = jest.mocked(axiosAuth.post);

const APPLICATION_BODY = {
  email: "partner@example.com",
  legalName: "Partner Demo SAC",
  contactName: "Andrea Partner",
  phone: "+51999999999",
  country: "PE",
};

beforeEach(() => {
  mockPublicPost.mockReset();
  mockGet.mockReset();
  mockPost.mockReset();
});

describe("submitPartnerApplicationApi", () => {
  it("hace POST /applications sin barra final, con el contrato y la Idempotency-Key", async () => {
    const response = { applicationReference: "APP-2026-000001", status: "APPLIED" };
    mockPublicPost.mockResolvedValue({ data: response });

    const result = await submitPartnerApplicationApi(APPLICATION_BODY, "key-app");

    expect(mockPublicPost).toHaveBeenCalledWith(
      "https://partners.test/v1/partners/applications",
      APPLICATION_BODY,
      { headers: { "Idempotency-Key": "key-app" } },
    );
    expect(result).toBe(response);
  });

  it("usa el cliente público: la operación no requiere sesión", async () => {
    mockPublicPost.mockResolvedValue({ data: {} });

    await submitPartnerApplicationApi(APPLICATION_BODY, "key-app");

    expect(mockPost).not.toHaveBeenCalled();
    expect(JSON.stringify(mockPublicPost.mock.calls[0][2])).not.toContain("Authorization");
  });
});

describe("getAdminApplicationsApi", () => {
  it("pide GET /admin/applications con el cliente autenticado y sin params en la primera página", async () => {
    const page = { items: [], nextCursor: null };
    mockGet.mockResolvedValue({ data: page });

    const result = await getAdminApplicationsApi({ cursor: null, status: null });

    expect(mockGet).toHaveBeenCalledWith("https://partners.test/v1/partners/admin/applications", {
      params: undefined,
    });
    expect(result).toBe(page);
  });

  it("envía cursor y status como query params", async () => {
    mockGet.mockResolvedValue({ data: { items: [], nextCursor: null } });

    await getAdminApplicationsApi({ cursor: "cursor-2", status: "APPLIED" });

    expect(mockGet).toHaveBeenCalledWith("https://partners.test/v1/partners/admin/applications", {
      params: { cursor: "cursor-2", status: "APPLIED" },
    });
  });
});

describe("approveAdminApplicationApi", () => {
  it("hace POST /admin/applications/{id}/approve solo con reason y la Idempotency-Key", async () => {
    const response = {
      applicationId: "app-1",
      partnerId: "partner-1",
      status: "ACTIVE",
      code: "PARTNERDEMO",
    };
    mockPost.mockResolvedValue({ data: response });

    const result = await approveAdminApplicationApi(
      "app-1",
      { reason: "Validación completada" },
      "key-approve",
    );

    expect(mockPost).toHaveBeenCalledWith(
      "https://partners.test/v1/partners/admin/applications/app-1/approve",
      { reason: "Validación completada" },
      { headers: { "Idempotency-Key": "key-approve" } },
    );
    expect(JSON.stringify(mockPost.mock.calls[0][1])).not.toContain("authSubject");
    expect(result).toBe(response);
  });

  it("codifica el id de la solicitud en la URL", async () => {
    mockPost.mockResolvedValue({ data: {} });

    await approveAdminApplicationApi("a/b", { reason: "ok" }, "key");

    expect(mockPost.mock.calls[0][0]).toBe(
      "https://partners.test/v1/partners/admin/applications/a%2Fb/approve",
    );
  });
});

describe("rejectAdminApplicationApi", () => {
  it("hace POST /admin/applications/{id}/reject con reason y la Idempotency-Key", async () => {
    const response = { applicationId: "app-1", status: "REJECTED" };
    mockPost.mockResolvedValue({ data: response });

    const result = await rejectAdminApplicationApi(
      "app-1",
      { reason: "Motivo del rechazo" },
      "key-reject",
    );

    expect(mockPost).toHaveBeenCalledWith(
      "https://partners.test/v1/partners/admin/applications/app-1/reject",
      { reason: "Motivo del rechazo" },
      { headers: { "Idempotency-Key": "key-reject" } },
    );
    expect(result).toBe(response);
  });
});
