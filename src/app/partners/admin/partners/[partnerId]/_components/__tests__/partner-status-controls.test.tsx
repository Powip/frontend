import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminPartnerStatusInput } from "@/features/partners/hooks/use-admin-partner-status";
import {
  ADMIN_PARTNER_ID,
  ADMIN_USER_A,
  ADMIN_USER_B,
  buildAdminPartner,
} from "@/features/partners/test-utils/admin-partners.fixture";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import { PartnerStatusControls } from "../partner-status-controls";

let mockAuth: { user: { id: string; permissions: string[]; email?: string } } | null;
let mockSession = {
  userId: ADMIN_USER_A,
  epoch: 1,
  canAccess: true,
  denied: null as unknown,
  enabled: true,
};
let mockMutation = {
  isPending: false,
  isError: false,
  isSuccess: false,
  error: null as unknown,
  variables: undefined as undefined | { input: AdminPartnerStatusInput },
};
const mockWrite = jest.fn();
const mockHook = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("@/features/partners/hooks/use-admin-partner-status", () => ({
  useAdminPartnerStatus: () => mockHook(),
}));
beforeEach(() => {
  mockAuth = {
    user: { id: ADMIN_USER_A, permissions: ["PARTNERS_VIEW", "PARTNERS_MANAGE_PARTNERS"] },
  };
  mockSession = { userId: ADMIN_USER_A, epoch: 1, canAccess: true, denied: null, enabled: true };
  mockMutation = {
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    variables: undefined,
  };
  mockWrite.mockReset();
  mockHook.mockReset().mockImplementation(() => ({
    session: mockSession,
    mutation: mockMutation,
    mutationForSession: true,
    write: mockWrite,
  }));
});

it.each([
  null,
  {
    user: {
      id: ADMIN_USER_A,
      permissions: ["PARTNERS_VIEW", "PARTNERS_APPROVE"],
      email: "staff@example.test",
    },
  },
])("hides mutation controls without explicit current management permission: %#", (auth) => {
  mockAuth = auth;
  const { container } = render(<PartnerStatusControls partner={buildAdminPartner()} />);
  expect(container).toBeEmptyDOMElement();
  expect(mockHook).not.toHaveBeenCalled();
});

it.each(["APPLIED", "REJECTED"] as const)("does not expose approval or resume for %s", (status) => {
  render(<PartnerStatusControls partner={buildAdminPartner({ status })} />);
  expect(screen.getByText(/ya aprobados/)).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(mockWrite).not.toHaveBeenCalled();
});

it.each([
  { status: "ACTIVE" as const, label: "Suspender partner", operation: "suspend" },
  { status: "SUSPENDED" as const, label: "Reactivar partner", operation: "resume" },
])(
  "submits $operation with the actual persisted version and required reason",
  async ({ status, label, operation }) => {
    render(<PartnerStatusControls partner={buildAdminPartner({ status, version: 7 })} />);
    await userEvent.type(screen.getByLabelText("Motivo del cambio"), " Motivo del operador ");
    await userEvent.click(screen.getByRole("button", { name: label }));
    expect(mockWrite).toHaveBeenCalledWith({
      partnerId: ADMIN_PARTNER_ID,
      operation,
      command: { expectedVersion: 7, reason: "Motivo del operador" },
    });
  },
);

it("rejects blank reasons and safely retries the original proposal after an unknown result", async () => {
  const { rerender } = render(<PartnerStatusControls partner={buildAdminPartner()} />);
  await userEvent.type(screen.getByLabelText("Motivo del cambio"), " ");
  const form = screen.getByRole("button", { name: "Suspender partner" }).closest("form");
  if (!form) throw new Error("Expected the status proposal form");
  fireEvent.submit(form);
  expect(screen.getByRole("alert")).toHaveTextContent("motivo válido");
  expect(mockWrite).not.toHaveBeenCalled();
  await userEvent.clear(screen.getByLabelText("Motivo del cambio"));
  await userEvent.type(screen.getByLabelText("Motivo del cambio"), "Revisar acceso");
  await userEvent.click(screen.getByRole("button", { name: "Suspender partner" }));
  mockMutation.variables = { input: mockWrite.mock.calls[0][0] };
  mockMutation.isError = true;
  mockMutation.error = new Error("private upstream data");
  rerender(<PartnerStatusControls partner={buildAdminPartner()} />);
  expect(screen.getByLabelText("Motivo de la solicitud original")).toHaveValue("Revisar acceso");
  expect(screen.queryByText("private upstream data")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Reintentar misma solicitud" }));
  expect(mockWrite).toHaveBeenLastCalledWith({
    partnerId: ADMIN_PARTNER_ID,
    operation: "suspend",
    command: { expectedVersion: 4, reason: "Revisar acceso" },
  });
});

it("disables a pending or stale proposal and resets the form when actual refreshed version changes", async () => {
  const { rerender } = render(<PartnerStatusControls partner={buildAdminPartner()} />);
  await userEvent.type(screen.getByLabelText("Motivo del cambio"), "Draft reason");
  mockMutation.isPending = true;
  mockMutation.variables = {
    input: {
      partnerId: ADMIN_PARTNER_ID,
      operation: "suspend",
      command: { expectedVersion: 4, reason: "Draft reason" },
    },
  };
  rerender(<PartnerStatusControls partner={buildAdminPartner()} />);
  expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
  expect(screen.getByLabelText("Motivo de la solicitud original")).toBeDisabled();
  mockMutation.isPending = false;
  mockMutation.isError = true;
  mockMutation.error = buildAxiosError(409);
  rerender(<PartnerStatusControls partner={buildAdminPartner()} />);
  expect(screen.getByRole("button", { name: "Suspender partner" })).toBeDisabled();
  rerender(
    <PartnerStatusControls partner={buildAdminPartner({ status: "SUSPENDED", version: 5 })} />,
  );
  expect(screen.getByRole("button", { name: "Reactivar partner" })).toBeEnabled();
  expect(screen.getByLabelText("Motivo del cambio")).toHaveValue("");
});

it.each([
  { initial: "ACTIVE" as const, refreshed: "SUSPENDED" as const, operation: "suspend" as const },
  { initial: "SUSPENDED" as const, refreshed: "ACTIVE" as const, operation: "resume" as const },
])(
  "preserves lost $operation and its literal version/reason after background GET changes the status",
  async ({ initial, refreshed, operation }) => {
    const original: AdminPartnerStatusInput = {
      partnerId: ADMIN_PARTNER_ID,
      operation,
      command: { expectedVersion: 4, reason: "Original protected proposal" },
    };
    const { rerender } = render(
      <PartnerStatusControls partner={buildAdminPartner({ status: initial })} />,
    );
    mockMutation.variables = { input: original };
    mockMutation.isPending = true;
    rerender(
      <PartnerStatusControls partner={buildAdminPartner({ status: refreshed, version: 5 })} />,
    );
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    expect(
      screen.queryByRole("button", {
        name: refreshed === "ACTIVE" ? "Suspender partner" : "Reactivar partner",
      }),
    ).not.toBeInTheDocument();
    mockMutation.isPending = false;
    mockMutation.isError = true;
    mockMutation.error = new Error("Lost committed response");
    rerender(
      <PartnerStatusControls partner={buildAdminPartner({ status: refreshed, version: 5 })} />,
    );
    expect(screen.getByLabelText("Motivo de la solicitud original")).toHaveValue(
      original.command.reason,
    );
    expect(screen.getByLabelText("Motivo de la solicitud original")).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar misma solicitud" }));
    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(mockWrite.mock.calls[0][0]).toBe(original);
  },
);

it.each([500, 502, 503, 504])(
  "preserves the original proposal after unknown HTTP %i even when GET reaches the maximum version",
  async (status) => {
    const original: AdminPartnerStatusInput = {
      partnerId: ADMIN_PARTNER_ID,
      operation: "suspend",
      command: {
        expectedVersion: Number.MAX_SAFE_INTEGER - 1,
        reason: "Last supported transition",
      },
    };
    mockMutation.variables = { input: original };
    mockMutation.isError = true;
    mockMutation.error = buildAxiosError(status);
    render(
      <PartnerStatusControls
        partner={buildAdminPartner({ status: "SUSPENDED", version: Number.MAX_SAFE_INTEGER })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Reintentar misma solicitud" }));
    expect(mockWrite.mock.calls[0][0]).toBe(original);
  },
);

it.each(["ACTIVE", "SUSPENDED"] as const)(
  "disables new %s changes at the terminal supported version",
  (status) => {
    render(
      <PartnerStatusControls
        partner={buildAdminPartner({ status, version: Number.MAX_SAFE_INTEGER })}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: status === "ACTIVE" ? "Suspender partner" : "Reactivar partner",
      }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Motivo del cambio")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("recargar no restablece ese límite");
    expect(mockWrite).not.toHaveBeenCalled();
  },
);

it.each(["session", "actor"])(
  "does not carry an unresolved private proposal into another %s or live denial",
  (change) => {
    mockMutation.variables = {
      input: {
        partnerId: ADMIN_PARTNER_ID,
        operation: "suspend",
        command: { expectedVersion: 4, reason: "Prior actor private reason" },
      },
    };
    mockMutation.isError = true;
    mockMutation.error = new Error("Lost response");
    const { rerender } = render(
      <PartnerStatusControls partner={buildAdminPartner({ status: "SUSPENDED", version: 5 })} />,
    );
    expect(screen.getByRole("button", { name: "Reintentar misma solicitud" })).toBeEnabled();
    mockSession.epoch = 2;
    if (change === "actor") {
      mockSession.userId = ADMIN_USER_B;
      mockAuth = {
        user: { id: ADMIN_USER_B, permissions: ["PARTNERS_VIEW", "PARTNERS_MANAGE_PARTNERS"] },
      };
    }
    mockHook.mockImplementation(() => ({
      session: mockSession,
      mutation: mockMutation,
      mutationForSession: false,
      write: mockWrite,
    }));
    rerender(
      <PartnerStatusControls partner={buildAdminPartner({ status: "SUSPENDED", version: 5 })} />,
    );
    expect(
      screen.queryByRole("button", { name: "Reintentar misma solicitud" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Prior actor private reason")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Motivo del cambio")).toHaveValue("");
    mockSession.denied = buildAxiosError(403);
    mockSession.enabled = false;
    rerender(
      <PartnerStatusControls partner={buildAdminPartner({ status: "SUSPENDED", version: 5 })} />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(mockWrite).not.toHaveBeenCalled();
  },
);

it("removes the draft on a new session and hides controls after live denial", async () => {
  const { rerender } = render(<PartnerStatusControls partner={buildAdminPartner()} />);
  await userEvent.type(screen.getByLabelText("Motivo del cambio"), "Private draft");
  mockSession.epoch = 2;
  rerender(<PartnerStatusControls partner={buildAdminPartner()} />);
  expect(screen.getByLabelText("Motivo del cambio")).toHaveValue("");
  mockSession.denied = buildAxiosError(403);
  mockSession.enabled = false;
  rerender(<PartnerStatusControls partner={buildAdminPartner()} />);
  expect(screen.queryByRole("button", { name: "Suspender partner" })).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(/No tenés permiso/);
});
