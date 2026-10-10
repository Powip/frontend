/**
 * Tests: requests HTTP reales de solicitudes de partners
 *
 * Verifica, pasando por el cliente axios real con un adapter de prueba, que:
 * 1. Aprobar y rechazar envían el JWT administrativo de la sesión y la Idempotency-Key.
 * 2. Aprobar envía solo { reason }, sin authSubject.
 * 3. Enviar una solicitud pública no adjunta el JWT aunque haya sesión.
 */

import axios, { type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import partnersMutationsClient from "../partners-mutations.client";
import { tokenStore } from "@/lib/tokenStore";
import {
  approveAdminApplicationApi,
  rejectAdminApplicationApi,
  submitPartnerApplicationApi,
} from "../partner-applications.api";

jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.test/v1/partners" },
}));

const STAFF_JWT = "staff.jwt.token";

function captureRequests(responseData: unknown) {
  const requests: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    requests.push(config);
    return { data: responseData, status: 200, statusText: "OK", headers: {}, config };
  };
  return { requests, adapter };
}

const originalAuthAdapter = partnersMutationsClient.defaults.adapter;
const originalPublicAdapter = axios.defaults.adapter;

afterEach(() => {
  partnersMutationsClient.defaults.adapter = originalAuthAdapter;
  axios.defaults.adapter = originalPublicAdapter;
  tokenStore.set(null);
});

describe("requests de solicitudes de partners", () => {
  it("aprobar envía el JWT administrativo, la Idempotency-Key y solo reason", async () => {
    const { requests, adapter } = captureRequests({ status: "ACTIVE", code: "PARTNERDEMO" });
    partnersMutationsClient.defaults.adapter = adapter;
    tokenStore.set(STAFF_JWT);

    await approveAdminApplicationApi("app-1", { reason: "Validación completada" }, "key-1", STAFF_JWT);

    const [request] = requests;
    expect(request.method).toBe("post");
    expect(request.url).toBe("https://partners.test/v1/partners/admin/applications/app-1/approve");
    expect(request.headers.Authorization).toBe(`Bearer ${STAFF_JWT}`);
    expect(request.headers["Idempotency-Key"]).toBe("key-1");
    expect(JSON.parse(request.data as string)).toEqual({ reason: "Validación completada" });
  });

  it("rechazar envía el JWT administrativo y la Idempotency-Key", async () => {
    const { requests, adapter } = captureRequests({ status: "REJECTED" });
    partnersMutationsClient.defaults.adapter = adapter;
    tokenStore.set(STAFF_JWT);

    await rejectAdminApplicationApi("app-1", { reason: "Motivo del rechazo" }, "key-2", STAFF_JWT);

    const [request] = requests;
    expect(request.url).toBe("https://partners.test/v1/partners/admin/applications/app-1/reject");
    expect(request.headers.Authorization).toBe(`Bearer ${STAFF_JWT}`);
    expect(request.headers["Idempotency-Key"]).toBe("key-2");
    expect(JSON.parse(request.data as string)).toEqual({ reason: "Motivo del rechazo" });
  });

  it("la solicitud pública no adjunta el JWT de la sesión", async () => {
    const { requests, adapter } = captureRequests({ applicationReference: "APP-1" });
    axios.defaults.adapter = adapter;
    tokenStore.set(STAFF_JWT);

    await submitPartnerApplicationApi(
      {
        email: "partner@example.com",
        legalName: "Partner Demo SAC",
        contactName: "Andrea Partner",
        phone: "+51999999999",
        country: "PE",
      },
      "key-3",
    );

    const [request] = requests;
    expect(request.url).toBe("https://partners.test/v1/partners/applications");
    expect(request.headers.Authorization).toBeUndefined();
    expect(request.headers["Idempotency-Key"]).toBe("key-3");
  });
});
