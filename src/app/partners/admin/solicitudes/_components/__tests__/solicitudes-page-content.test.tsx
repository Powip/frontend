/**
 * Tests: SolicitudesPageContent
 *
 * Comportamiento verificado:
 * 1. Lista las solicitudes reales y no mezcla partners simulados.
 * 2. Aprobar pide el motivo, usa el id real de la solicitud y actualiza la cola al terminar.
 * 3. Reintentar la misma acción con el mismo motivo conserva la Idempotency-Key; otro motivo genera otra.
 * 4. Evita envíos simultáneos.
 * 5. Rechazar pide el motivo y actualiza la cola.
 * 6. Sin PARTNERS_APPROVE no se ofrecen acciones.
 * 7. 429 informa la espera y bloquea el reintento; 401 pide volver a iniciar sesión.
 * 8. "Cargar más" pide la página siguiente por cursor; sin datos muestra el estado vacío.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_PARTNERS_MOCK } from "@/features/partners/mocks/admin-partners.mock";
import type { PartnerApplication } from "@/features/partners/models/partner-application";
import {
  approveAdminApplication,
  rejectAdminApplication,
} from "@/features/partners/services/decide-admin-application";
import { getAdminApplications } from "@/features/partners/services/get-admin-applications";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import { createIdempotencyKey } from "@/features/partners/utils/create-idempotency-key";
import { tokenStore } from "@/lib/tokenStore";
import { SolicitudesPageContent } from "../solicitudes-page-content";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));

jest.mock("@/features/partners/services/get-admin-applications", () => ({
  getAdminApplications: jest.fn(),
}));

jest.mock("@/features/partners/services/decide-admin-application", () => ({
  approveAdminApplication: jest.fn(),
  rejectAdminApplication: jest.fn(),
}));

jest.mock("@/features/partners/utils/create-idempotency-key", () => ({
  createIdempotencyKey: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const mockUseAuth = jest.mocked(useAuth);
const mockGetAdminApplications = jest.mocked(getAdminApplications);
const mockApprove = jest.mocked(approveAdminApplication);
const mockReject = jest.mocked(rejectAdminApplication);
const mockCreateIdempotencyKey = jest.mocked(createIdempotencyKey);

const APPLICATION: PartnerApplication = {
  id: "11111111-1111-4111-8111-111111111111",
  reference: "APP-2026-000001",
  email: "partner@example.com",
  displayName: "Partner Demo",
  country: "PE",
  status: "applied",
  rawStatus: "APPLIED",
  appliedAt: "2026-09-24T15:00:00Z",
};

const APPROVED = {
  applicationId: APPLICATION.id,
  partnerId: "22222222-2222-4222-8222-222222222222",
  partnerStatus: "ACTIVE",
  code: "PARTNERDEMO",
};

function mockPermissions(permissions: string[], email = "staff@example.com") {
  tokenStore.set("staff.jwt.test");
  mockUseAuth.mockReturnValue({
    auth: {
      accessToken: "staff.jwt.test",
      user: { id: "staff-user", email, permissions },
    },
    hasPermission: () => true,
  } as unknown as ReturnType<typeof useAuth>);
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 0 }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <SolicitudesPageContent />
    </QueryClientProvider>,
  );
}

async function openDecision(action: "Aprobar" | "Rechazar") {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", {
      name: `${action} solicitud de ${APPLICATION.displayName}`,
    }),
  );
  const dialog = await screen.findByRole("dialog");
  return { user, dialog };
}

beforeEach(() => {
  let counter = 0;
  mockCreateIdempotencyKey.mockReset();
  mockCreateIdempotencyKey.mockImplementation(() => `key-${++counter}`);
  mockGetAdminApplications.mockReset();
  mockGetAdminApplications.mockResolvedValue({ items: [APPLICATION], nextCursor: null });
  mockApprove.mockReset();
  mockReject.mockReset();
  mockPermissions(["PARTNERS_VIEW", "PARTNERS_APPROVE"]);
});

afterEach(() => {
  tokenStore.set(null);
});

describe("SolicitudesPageContent", () => {
  it("lista las solicitudes reales pendientes y no los partners simulados", async () => {
    renderPage();

    expect(await screen.findByText(APPLICATION.displayName)).toBeInTheDocument();
    expect(screen.getByText(APPLICATION.reference)).toBeInTheDocument();
    expect(mockGetAdminApplications).toHaveBeenCalledWith({ cursor: null, status: "APPLIED" });
    for (const partner of ADMIN_PARTNERS_MOCK) {
      expect(screen.queryByText(partner.name)).not.toBeInTheDocument();
    }
  });

  it("exige el motivo antes de aprobar", async () => {
    renderPage();
    const { user, dialog } = await openDecision("Aprobar");

    await user.click(within(dialog).getByRole("button", { name: /^aprobar$/i }));

    expect(await within(dialog).findByText(/el motivo es obligatorio/i)).toBeInTheDocument();
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it.each(["Aprobar", "Rechazar"] as const)(
    "%s muestra el límite mínimo del motivo antes de enviar al API",
    async (action) => {
      renderPage();
      const { user, dialog } = await openDecision(action);

      await user.type(within(dialog).getByLabelText(/motivo/i), "ok");
      await user.click(within(dialog).getByRole("button", { name: action }));

      expect(await within(dialog).findByText(/al menos 3 caracteres/i)).toBeInTheDocument();
      expect(mockApprove).not.toHaveBeenCalled();
      expect(mockReject).not.toHaveBeenCalled();
    },
  );

  it("aprueba con el id real de la solicitud y solo el motivo, y actualiza la cola", async () => {
    mockApprove.mockResolvedValue(APPROVED);
    renderPage();
    const { user, dialog } = await openDecision("Aprobar");

    await user.type(within(dialog).getByLabelText(/motivo/i), "Validación completada");
    await user.click(within(dialog).getByRole("button", { name: /^aprobar$/i }));

    await waitFor(() => expect(mockApprove).toHaveBeenCalledTimes(1));
    expect(mockApprove.mock.calls[0][0]).toEqual({
      applicationId: APPLICATION.id,
      reason: "Validación completada",
      idempotencyKey: "key-1",
    });
    await waitFor(() => expect(mockGetAdminApplications).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("al reintentar con el mismo motivo conserva la clave y con otro motivo genera una nueva", async () => {
    mockApprove.mockRejectedValue(
      buildAxiosError(503, {
        code: "PARTNER_IDENTITY_SERVICE_UNAVAILABLE",
        message: "",
        correlationId: "corr-503",
        details: {},
      }),
    );
    renderPage();
    const { user, dialog } = await openDecision("Aprobar");
    const reasonInput = within(dialog).getByLabelText(/motivo/i);
    const confirmButton = within(dialog).getByRole("button", { name: /^aprobar$/i });

    await user.type(reasonInput, "Validación completada");
    await user.click(confirmButton);
    expect(await within(dialog).findByText(/no se aprobó/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/corr-503/)).toBeInTheDocument();

    await user.click(confirmButton);
    await waitFor(() => expect(mockApprove).toHaveBeenCalledTimes(2));

    await user.type(reasonInput, " y documentos");
    await user.click(confirmButton);
    await waitFor(() => expect(mockApprove).toHaveBeenCalledTimes(3));

    const keys = mockApprove.mock.calls.map(([input]) => input.idempotencyKey);
    expect(keys).toEqual(["key-1", "key-1", "key-2"]);
  });

  it("conserva la clave al reabrir la misma aprobación tras perder su respuesta", async () => {
    mockApprove.mockRejectedValueOnce(buildAxiosError()).mockResolvedValueOnce(APPROVED);
    renderPage();
    const { user, dialog } = await openDecision("Aprobar");

    await user.type(within(dialog).getByLabelText(/motivo/i), "Validación completada");
    await user.click(within(dialog).getByRole("button", { name: /^aprobar$/i }));
    expect(await within(dialog).findByText(/no pudimos conectar/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /cancelar/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const reopened = await openDecision("Aprobar");
    await reopened.user.type(
      within(reopened.dialog).getByLabelText(/motivo/i),
      "Validación completada",
    );
    await reopened.user.click(within(reopened.dialog).getByRole("button", { name: /^aprobar$/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockApprove.mock.calls.map(([input]) => input.idempotencyKey)).toEqual([
      "key-1",
      "key-1",
    ]);
  });

  it("no envía dos aprobaciones simultáneas", async () => {
    let resolveApproval: (value: typeof APPROVED) => void = () => {};
    mockApprove.mockImplementation(() => new Promise((resolve) => (resolveApproval = resolve)));
    renderPage();
    const { user, dialog } = await openDecision("Aprobar");

    await user.type(within(dialog).getByLabelText(/motivo/i), "Validación completada");
    await user.click(within(dialog).getByRole("button", { name: /^aprobar$/i }));

    const pendingButton = await within(dialog).findByRole("button", { name: /aprobando/i });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(mockApprove).toHaveBeenCalledTimes(1);

    resolveApproval(APPROVED);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("rechaza con el motivo indicado y actualiza la cola", async () => {
    mockReject.mockResolvedValue({ applicationId: APPLICATION.id, status: "REJECTED" });
    renderPage();
    const { user, dialog } = await openDecision("Rechazar");

    await user.type(within(dialog).getByLabelText(/motivo/i), "Motivo del rechazo");
    await user.click(within(dialog).getByRole("button", { name: /^rechazar$/i }));

    await waitFor(() => expect(mockReject).toHaveBeenCalledTimes(1));
    expect(mockReject.mock.calls[0][0]).toEqual({
      applicationId: APPLICATION.id,
      reason: "Motivo del rechazo",
      idempotencyKey: "key-1",
    });
    expect(mockApprove).not.toHaveBeenCalled();
    await waitFor(() => expect(mockGetAdminApplications).toHaveBeenCalledTimes(2));
  });

  it("sin PARTNERS_APPROVE no ofrece aprobar ni rechazar", async () => {
    mockPermissions(["PARTNERS_VIEW"]);
    renderPage();

    expect(await screen.findByText(APPLICATION.displayName)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aprobar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /rechazar/i })).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/PARTNERS_APPROVE/);
  });

  it("un superadmin sin PARTNERS_APPROVE en el JWT tampoco puede decidir y ve cómo obtenerlo", async () => {
    mockPermissions(["PARTNERS_VIEW"], "tognolimauricio@gmail.com");
    renderPage();

    expect(await screen.findByText(APPLICATION.displayName)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aprobar/i })).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/volvé a iniciarla/i);
    expect(screen.getByRole("link", { name: /volver a iniciar sesión/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("con PARTNERS_APPROVE no muestra el aviso de permiso faltante", async () => {
    renderPage();

    expect(await screen.findByText(APPLICATION.displayName)).toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("ante un 429 informa la espera y bloquea el reintento", async () => {
    mockApprove.mockRejectedValue(buildAxiosError(429, undefined, { "Retry-After": "45" }));
    renderPage();
    const { user, dialog } = await openDecision("Aprobar");

    await user.type(within(dialog).getByLabelText(/motivo/i), "Validación completada");
    await user.click(within(dialog).getByRole("button", { name: /^aprobar$/i }));

    expect(await within(dialog).findByText(/volver a intentar en 45 s/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^aprobar$/i })).toBeDisabled();
    expect(mockApprove).toHaveBeenCalledTimes(1);
  });

  it("si el listado responde 401 sin body pide volver a iniciar sesión", async () => {
    mockGetAdminApplications.mockRejectedValue(buildAxiosError(401, ""));
    renderPage();

    expect(await screen.findByText(/volvé a iniciar sesión/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /volver a iniciar sesión/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("si el listado responde 403 explica que hay que renovar la sesión para recibir permisos", async () => {
    mockGetAdminApplications.mockRejectedValue(buildAxiosError(403));
    renderPage();

    expect(await screen.findByText(/iniciarla para recibirlos/i)).toBeInTheDocument();
  });

  it('"Cargar más" pide la página siguiente con el cursor', async () => {
    const second = { ...APPLICATION, id: "app-2", displayName: "Segundo Partner" };
    mockGetAdminApplications
      .mockResolvedValueOnce({ items: [APPLICATION], nextCursor: "cursor-2" })
      .mockResolvedValueOnce({ items: [second], nextCursor: null });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /cargar más/i }));

    expect(await screen.findByText("Segundo Partner")).toBeInTheDocument();
    expect(mockGetAdminApplications).toHaveBeenLastCalledWith({
      cursor: "cursor-2",
      status: "APPLIED",
    });
    expect(screen.queryByRole("button", { name: /cargar más/i })).not.toBeInTheDocument();
  });

  it("muestra el estado vacío cuando no hay solicitudes", async () => {
    mockGetAdminApplications.mockResolvedValue({ items: [], nextCursor: null });
    renderPage();

    expect(await screen.findByText(/no hay solicitudes/i)).toBeInTheDocument();
  });
});
