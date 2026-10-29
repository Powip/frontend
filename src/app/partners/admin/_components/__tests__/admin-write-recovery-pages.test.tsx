import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminResourceOperation } from "@/features/partners/hooks/use-admin-resources";
import type {
  AdminCommissionPolicyDraftCommand,
  AdminCommissionPolicyVersion,
} from "@/features/partners/models/admin-commission-policy";
import type { AdminResource } from "@/features/partners/models/admin-resource";
import {
  adminResource,
  POLICY_COMMAND,
  policyDraft,
  RESOURCE_COMMAND,
  WRITE_USER_A,
  WRITE_USER_B,
} from "@/features/partners/test-utils/admin-writes.fixture";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import { ReglasPageContent } from "../../reglas/_components/reglas-page-content";
import { ResourcesPageContent } from "../../resources/_components/resources-page-content";

function session() {
  return {
    userId: WRITE_USER_A,
    epoch: 1,
    canAccess: true,
    denied: null as unknown,
    enabled: true,
  };
}
function query<T>(items: T[]) {
  return {
    data: { pages: [{ items }] },
    isError: false,
    isPending: false,
    isSuccess: true,
    error: null as unknown,
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: jest.fn(),
    fetchNextPage: jest.fn(),
  };
}
function mutation() {
  return { isPending: false, isError: false, isSuccess: false, error: null as unknown };
}
let mockResources: {
  session: ReturnType<typeof session>;
  query: ReturnType<typeof query<AdminResource>>;
  mutation: ReturnType<typeof mutation> & {
    variables?: { input: AdminResourceOperation };
    data: AdminResource;
  };
  mutationForSession: boolean;
  write: jest.Mock;
};
let mockPolicies: {
  session: ReturnType<typeof session>;
  query: ReturnType<typeof query<AdminCommissionPolicyVersion>>;
  creation: ReturnType<typeof mutation> & {
    variables?: { command: AdminCommissionPolicyDraftCommand };
    data: AdminCommissionPolicyVersion;
  };
  creationForSession: boolean;
  createDraft: jest.Mock;
};
jest.mock("@/features/partners/hooks/use-admin-resources", () => ({
  useAdminResources: () => mockResources,
}));
jest.mock("@/features/partners/hooks/use-admin-commission-policies", () => ({
  useAdminCommissionPolicies: () => mockPolicies,
}));

beforeEach(() => {
  mockResources = {
    session: session(),
    query: query([
      adminResource({ version: 4, publicUrl: "https://resources.example.com/local.pdf" }),
    ]),
    mutation: { ...mutation(), data: adminResource() },
    mutationForSession: true,
    write: jest.fn(),
  };
  mockPolicies = {
    session: session(),
    query: query<AdminCommissionPolicyVersion>([]),
    creation: { ...mutation(), data: policyDraft() },
    creationForSession: true,
    createDraft: jest.fn(),
  };
});

it.each(["publish", "unpublish", "revise", "archive"] as const)(
  "retries the exact lost resource %s despite refreshed state/version and list errors",
  async (operation) => {
    const existing = adminResource({
      version: 4,
      state: operation === "unpublish" ? "PUBLISHED" : "DRAFT",
      publicUrl: "https://resources.example.com/local.pdf",
    });
    mockResources.query.data.pages[0].items = [existing];
    const original: AdminResourceOperation =
      operation === "revise"
        ? {
            operation,
            resourceId: existing.id,
            command: {
              ...RESOURCE_COMMAND,
              title: "Original revision",
              expectedVersion: 4,
              reason: "Original protected reason",
            },
          }
        : {
            operation,
            resourceId: existing.id,
            command: { expectedVersion: 4, reason: "Original protected reason" },
          };
    const { rerender, container } = render(<ResourcesPageContent />);
    await userEvent.click(screen.getByRole("button", { name: `Gestionar ${existing.title}` }));
    mockResources.mutation.variables = { input: original };
    mockResources.mutation.isPending = true;
    const refreshed = adminResource({
      ...existing,
      version: 5,
      state: operation === "publish" ? "PUBLISHED" : operation === "archive" ? "ARCHIVED" : "DRAFT",
    });
    mockResources.query.data.pages[0].items = [refreshed];
    rerender(<ResourcesPageContent />);
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    expect(container.querySelector("form")).not.toBeInTheDocument();
    mockResources.mutation.isPending = false;
    mockResources.mutation.isError = true;
    mockResources.mutation.error = new Error("Lost committed response");
    mockResources.query.isError = true;
    mockResources.query.isSuccess = false;
    mockResources.query.error = buildAxiosError(503);
    rerender(<ResourcesPageContent />);
    expect(screen.getByLabelText("Motivo de la solicitud original")).toHaveValue(
      original.command.reason,
    );
    expect(screen.getByLabelText("Motivo de la solicitud original")).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar misma solicitud" }));
    expect(mockResources.write.mock.calls[0][0]).toBe(original);
    mockResources.query.isError = false;
    mockResources.query.isSuccess = true;
    rerender(<ResourcesPageContent />);
    expect(container.querySelector("form")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar misma solicitud" }));
    expect(mockResources.write).toHaveBeenCalledTimes(2);
    expect(mockResources.write.mock.calls[1][0]).toBe(original);
  },
);

it("preserves an unknown resource creation body when the list fails and later reveals its committed row", async () => {
  const original: AdminResourceOperation = {
    operation: "create",
    command: { ...RESOURCE_COMMAND, reason: "Original creation reason" },
  };
  mockResources.mutation.variables = { input: original };
  mockResources.mutation.isError = true;
  mockResources.mutation.error = buildAxiosError(502);
  mockResources.query.isError = true;
  mockResources.query.isSuccess = false;
  mockResources.query.error = buildAxiosError(503);
  const { rerender, container } = render(<ResourcesPageContent />);
  expect(screen.getByLabelText("Motivo de la solicitud original")).toHaveValue(
    original.command.reason,
  );
  mockResources.query.isError = false;
  mockResources.query.isSuccess = true;
  mockResources.query.data.pages[0].items = [adminResource()];
  rerender(<ResourcesPageContent />);
  expect(container.querySelector("form")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Reintentar misma solicitud" }));
  expect(mockResources.write).toHaveBeenCalledTimes(1);
  expect(mockResources.write.mock.calls[0][0]).toBe(original);
});

it.each([new Error("Lost response"), buildAxiosError(503)])(
  "preserves the exact unknown DRAFT body across failed and healthy list reads %#",
  async (error) => {
    const original = { ...POLICY_COMMAND, reason: "Original DRAFT protected reason" };
    mockPolicies.creation.variables = { command: original };
    mockPolicies.creation.isPending = true;
    mockPolicies.query.isError = true;
    mockPolicies.query.isSuccess = false;
    mockPolicies.query.error = buildAxiosError(503);
    const { rerender, container } = render(<ReglasPageContent />);
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    expect(container.querySelector("form")).not.toBeInTheDocument();
    mockPolicies.creation.isPending = false;
    mockPolicies.creation.isError = true;
    mockPolicies.creation.error = error;
    rerender(<ReglasPageContent />);
    expect(screen.getByLabelText("Motivo de la solicitud original")).toHaveValue(original.reason);
    await userEvent.click(screen.getByRole("button", { name: "Reintentar misma solicitud" }));
    expect(mockPolicies.createDraft.mock.calls[0][0]).toBe(original);
    mockPolicies.query.isError = false;
    mockPolicies.query.isSuccess = true;
    mockPolicies.query.data.pages[0].items = [policyDraft()];
    rerender(<ReglasPageContent />);
    expect(container.querySelector("form")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar misma solicitud" }));
    expect(mockPolicies.createDraft).toHaveBeenCalledTimes(2);
    expect(mockPolicies.createDraft.mock.calls[1][0]).toBe(original);
  },
);

it.each(["resources", "policy"] as const)(
  "clears private recovery after %s actor/session switch and prioritizes current denial",
  (family) => {
    const Component = family === "resources" ? ResourcesPageContent : ReglasPageContent;
    const active = family === "resources" ? mockResources : mockPolicies;
    if (family === "resources") {
      mockResources.mutation.variables = {
        input: {
          operation: "create",
          command: { ...RESOURCE_COMMAND, reason: "Prior actor reason" },
        },
      };
      mockResources.mutation.isError = true;
      mockResources.mutation.error = new Error("Lost response");
    } else {
      mockPolicies.creation.variables = {
        command: { ...POLICY_COMMAND, reason: "Prior actor reason" },
      };
      mockPolicies.creation.isError = true;
      mockPolicies.creation.error = new Error("Lost response");
    }
    const { rerender } = render(<Component />);
    expect(screen.getByRole("button", { name: "Reintentar misma solicitud" })).toBeEnabled();
    active.session.userId = WRITE_USER_B;
    active.session.epoch = 2;
    mockResources.mutationForSession = false;
    mockPolicies.creationForSession = false;
    rerender(<Component />);
    expect(screen.queryByDisplayValue("Prior actor reason")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reintentar misma solicitud" }),
    ).not.toBeInTheDocument();
    active.session.denied = buildAxiosError(403);
    active.session.enabled = false;
    mockResources.mutationForSession = true;
    mockPolicies.creationForSession = true;
    rerender(<Component />);
    expect(screen.queryByDisplayValue("Prior actor reason")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reintentar misma solicitud" }),
    ).not.toBeInTheDocument();
  },
);

it.each(["DRAFT", "PUBLISHED"] as const)(
  "does not offer new selected resource writes at the terminal %s version",
  async (state) => {
    const existing = adminResource({ state, version: Number.MAX_SAFE_INTEGER });
    mockResources.query.data.pages[0].items = [existing];
    render(<ResourcesPageContent />);
    await userEvent.click(screen.getByRole("button", { name: `Gestionar ${existing.title}` }));
    for (const label of [
      "Guardar revisión DRAFT",
      "Publicar recurso",
      "Retirar publicación",
      "Archivar recurso",
    ])
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
    expect(screen.getByText(/recargar no restablece ese límite/)).toBeInTheDocument();
    expect(mockResources.write).not.toHaveBeenCalled();
  },
);

it("still permits original receipt recovery when a committed last supported resource revision is visible", async () => {
  const existing = adminResource({ version: Number.MAX_SAFE_INTEGER });
  const original: AdminResourceOperation = {
    operation: "revise",
    resourceId: existing.id,
    command: { ...RESOURCE_COMMAND, expectedVersion: Number.MAX_SAFE_INTEGER - 1 },
  };
  mockResources.query.data.pages[0].items = [existing];
  mockResources.mutation.variables = { input: original };
  mockResources.mutation.isError = true;
  mockResources.mutation.error = new Error("Lost committed last revision");
  render(<ResourcesPageContent />);
  await userEvent.click(screen.getByRole("button", { name: "Reintentar misma solicitud" }));
  expect(mockResources.write.mock.calls[0][0]).toBe(original);
});
