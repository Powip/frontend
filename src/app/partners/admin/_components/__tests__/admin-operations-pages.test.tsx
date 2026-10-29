import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenStore } from "@/lib/tokenStore";
import { adminCommissionPolicyClient } from "@/features/partners/api/admin-commission-policy.api";
import { adminResourcesClient } from "@/features/partners/api/admin-resources.api";
import { adminPartnersClient } from "@/features/partners/api/admin-partners.api";
import { adminInvitationsClient } from "@/features/partners/api/admin-invitations.api";
import { policyDraft, adminResource, WRITE_USER_A, POLICY_COMMAND } from "@/features/partners/test-utils/admin-writes.fixture";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import { clearAdminCapabilityDenials } from "@/features/partners/utils/admin-capability-session-state";
import { clearAdminReadDenial } from "@/features/partners/utils/admin-read-session-state";
import { ReglasPageContent } from "../../reglas/_components/reglas-page-content";
import { ResourcesPageContent } from "../../resources/_components/resources-page-content";
import { ColaPageContent } from "../../cola/_components/cola-page-content";

let mockAuth: { user: { id: string; permissions: string[] }; accessToken: string };
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("@/lib/api", () => ({ API: { partners: "https://partners.review.invalid/v1/partners" } }));
jest.mock("@/features/partners/utils/admin-command-idempotency", () => ({ resolveAdminCommandIdempotencyKey: () => Promise.resolve("stable-ui-retry-key") }));
let client: QueryClient;
function mount(component: React.ReactNode) { client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300_000 } } }); return render(<QueryClientProvider client={client}>{component}</QueryClientProvider>); }
beforeEach(() => {
  mockAuth = { user: { id: WRITE_USER_A, permissions: ["PARTNERS_VIEW", "PARTNERS_CONFIGURE_POLICY", "PARTNERS_MANAGE_RESOURCES"] }, accessToken: "UI-private-bearer" };
  tokenStore.set(mockAuth.accessToken); clearAdminReadDenial(); clearAdminCapabilityDenials();
  jest.spyOn(adminInvitationsClient, "get").mockResolvedValue({ data: { items: [], nextCursor: null } });
});
afterEach(() => { cleanup(); client?.clear(); jest.restoreAllMocks(); tokenStore.set(null); clearAdminReadDenial(); clearAdminCapabilityDenials(); });

it("renders actual DRAFTs and a blank form, never tiers/plans/activation or invented default rates", async () => {
  jest.spyOn(adminCommissionPolicyClient, "get").mockResolvedValue({ data: { items: [policyDraft()], nextCursor: null } });
  mount(<ReglasPageContent />);
  await screen.findByRole("button", { name: "Guardar DRAFT" });
  expect(screen.getByText(/TEST_DRAFT · PEN · DRAFT/)).toBeInTheDocument();
  expect(screen.getByText(/Primer pago: 0.1234567890/)).toBeInTheDocument();
  expect(screen.getByLabelText("Tasa del primer pago")).toHaveValue("");
  expect(screen.getByLabelText("Moneda ISO")).toHaveValue("");
  expect(screen.queryByText(/Bronce|Standard|Perfil|S\/ 0/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /activar/i })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Gestionar recursos/ })).toHaveAttribute("href", "/partners/admin/resources");
});

it("submits exact string rates/nulls and keeps the same retry key after an unknown HTTP outcome", async () => {
  jest.spyOn(adminCommissionPolicyClient, "get").mockResolvedValue({ data: { items: [], nextCursor: null } });
  const post = jest.spyOn(adminCommissionPolicyClient, "post").mockRejectedValueOnce(buildAxiosError()).mockResolvedValueOnce({ data: policyDraft() });
  mount(<ReglasPageContent />);
  const submit = await screen.findByRole("button", { name: "Guardar DRAFT" });
  for (const [label, value] of [["Código", POLICY_COMMAND.code], ["Moneda ISO", "PEN"], ["Tasa del primer pago", "0.1234567890"], ["Tasa de pagos recurrentes", "0.01"], ["Motivo", POLICY_COMMAND.reason]]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  await userEvent.click(submit);
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  const retry = await screen.findByRole("button", { name: "Reintentar misma solicitud" });
  expect(screen.queryByRole("button", { name: "Guardar DRAFT" })).not.toBeInTheDocument();
  await waitFor(() => expect(retry).toBeEnabled());
  await userEvent.click(retry);
  await screen.findByText(/Borrador DRAFT guardado/);
  expect(post).toHaveBeenCalledTimes(2);
  for (const [, command, options] of post.mock.calls) {
    expect(command).toEqual(POLICY_COMMAND);
    expect(options?.headers).toEqual({ Authorization: "Bearer UI-private-bearer", "Idempotency-Key": "stable-ui-retry-key" });
  }
});

it.each([401, 403, 503])("handles actual list HTTP%i without showing a create form or successful mock cache", async (status) => {
  jest.spyOn(adminCommissionPolicyClient, "get").mockRejectedValue(buildAxiosError(status));
  mount(<ReglasPageContent />);
  await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  expect(screen.queryByRole("button", { name: "Guardar DRAFT" })).not.toBeInTheDocument();
  expect(screen.queryByText("TEST_DRAFT")).not.toBeInTheDocument();
});

it("shows actual resource state, blanks new metadata and uses explicit version/reason publish commands", async () => {
  const resource = adminResource({ publicUrl: "https://resources.review.invalid/guide.pdf" });
  jest.spyOn(adminResourcesClient, "get").mockResolvedValue({ data: { items: [resource], nextCursor: null, hasMore: false, limit: 20 } });
  const post = jest.spyOn(adminResourcesClient, "post").mockResolvedValue({ data: adminResource({ state: "PUBLISHED", version: 1, publicUrl: resource.publicUrl }) });
  mount(<ResourcesPageContent />);
  await screen.findByRole("button", { name: "Crear DRAFT" });
  expect(screen.getByLabelText("País ISO")).toHaveValue("");
  expect(screen.getByLabelText("Orden")).toHaveValue("");
  expect(screen.queryByLabelText(/upload|archivo/i)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Gestionar Test-only resource" }));
  fireEvent.change(screen.getByLabelText("Motivo del cambio"), { target: { value: "Test-only publish reason" } });
  await userEvent.click(screen.getByRole("button", { name: "Publicar recurso" }));
  await waitFor(() => expect(post).toHaveBeenCalledWith(expect.stringContaining(`/${resource.id}/publish`), { expectedVersion: 0, reason: "Test-only publish reason" }, expect.objectContaining({ headers: { Authorization: "Bearer UI-private-bearer", "Idempotency-Key": "stable-ui-retry-key" } })));
});

it("keeps archived resources terminal and nullable links unavailable", async () => {
  const resource = adminResource({ state: "ARCHIVED", version: 3, archivedAt: "2026-10-10T12:00:00Z", publicUrl: null });
  jest.spyOn(adminResourcesClient, "get").mockResolvedValue({ data: { items: [resource], nextCursor: null, hasMore: false, limit: 20 } });
  mount(<ResourcesPageContent />);
  await userEvent.click(await screen.findByRole("button", { name: "Gestionar Test-only resource" }));
  expect(screen.getByText(/No admite cambios/)).toBeInTheDocument();
  expect(screen.getByText("Enlace no disponible.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Publicar recurso|Retirar publicación|Archivar recurso|Guardar revisión/ })).not.toBeInTheDocument();
});

it("requires dedicated resource authority rather than VIEW", () => {
  mockAuth.user.permissions = ["PARTNERS_VIEW"];
  const get = jest.spyOn(adminResourcesClient, "get");
  mount(<ResourcesPageContent />);
  expect(screen.getByRole("alert")).toHaveTextContent("PARTNERS_MANAGE_RESOURCES");
  expect(get).not.toHaveBeenCalled();
});

it("renders persisted queue records with pagination/filter, no PII or decision/payment controls", async () => {
  const item = { id: "33333333-3333-4333-8333-333333333333", partnerId: WRITE_USER_A, partnerDisplayName: "Actual test partner", partnerStatus: "SUSPENDED", origin: "MANUAL", state: "UNDER_REVIEW", version: 0, businessName: "Actual test business", capturedAt: "2026-10-10T12:00:00Z", expiresAt: null };
  const get = jest.spyOn(adminPartnersClient, "get").mockResolvedValueOnce({ data: { items: [item], nextCursor: "queue-next", hasMore: true, limit: 20 } }).mockResolvedValueOnce({ data: { items: [], nextCursor: null, hasMore: false, limit: 20 } }).mockResolvedValueOnce({ data: { items: [{ ...item, origin: "CODE", businessName: "Actual CODE business" }], nextCursor: null, hasMore: false, limit: 20 } });
  mount(<ColaPageContent />);
  await screen.findByText("Actual test business");
  expect(screen.queryByRole("button", { name: /Aprobar|Rechazar|Invitar|Confirmar pago|Bloquear|Asignar/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/@|teléfono|nota/i)).not.toBeInTheDocument();
  expect(within(screen.getByRole("article")).getByText(/SUSPENDED/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Cargar más referidos" }));
  await waitFor(() => expect(get).toHaveBeenLastCalledWith(expect.stringContaining("/admin/review-queue"), expect.objectContaining({ params: { cursor: "queue-next", limit: 20 } })));
  await userEvent.selectOptions(screen.getByLabelText("Origen"), "CODE");
  await screen.findByText("Actual CODE business");
  expect(screen.queryByText("Actual test business")).not.toBeInTheDocument();
  expect(get).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ params: { origin: "CODE", limit: 20 } }));
});
