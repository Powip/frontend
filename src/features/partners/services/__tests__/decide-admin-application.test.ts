import {
  approveAdminApplicationApi,
  rejectAdminApplicationApi,
} from "../../api/partner-applications.api";
import { approveAdminApplication, rejectAdminApplication } from "../decide-admin-application";

jest.mock("../../api/partner-applications.api", () => ({
  approveAdminApplicationApi: jest.fn(),
  rejectAdminApplicationApi: jest.fn(),
}));

const mockApproveApi = jest.mocked(approveAdminApplicationApi);
const mockRejectApi = jest.mocked(rejectAdminApplicationApi);

describe("approveAdminApplication", () => {
  beforeEach(() => mockApproveApi.mockReset());

  it("envía el id real de la solicitud y solo el motivo, sin authSubject", async () => {
    mockApproveApi.mockResolvedValue({
      applicationId: "app-1",
      partnerId: "partner-1",
      status: "ACTIVE",
      code: "PARTNERDEMO",
    });

    const result = await approveAdminApplication({
      applicationId: "app-1",
      reason: "  Validación completada  ",
      idempotencyKey: "key-1",
    }, "fixture-token");

    expect(mockApproveApi).toHaveBeenCalledWith(
      "app-1",
      { reason: "Validación completada" },
      "key-1",
      "fixture-token",
    );
    expect(Object.keys(mockApproveApi.mock.calls[0][1])).toEqual(["reason"]);
    expect(result).toEqual({
      applicationId: "app-1",
      partnerId: "partner-1",
      partnerStatus: "ACTIVE",
      code: "PARTNERDEMO",
    });
  });
});

describe("rejectAdminApplication", () => {
  beforeEach(() => mockRejectApi.mockReset());

  it("envía el motivo del rechazo con la Idempotency-Key", async () => {
    mockRejectApi.mockResolvedValue({ applicationId: "app-1", status: "REJECTED" });

    const result = await rejectAdminApplication({
      applicationId: "app-1",
      reason: "Motivo del rechazo",
      idempotencyKey: "key-2",
    }, "fixture-token");

    expect(mockRejectApi).toHaveBeenCalledWith("app-1", { reason: "Motivo del rechazo" }, "key-2", "fixture-token");
    expect(result).toEqual({ applicationId: "app-1", status: "REJECTED" });
  });
});
