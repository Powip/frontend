/**
 * Tests: PartnerApplicationForm
 *
 * Comportamiento verificado:
 * 1. Valida los campos del contrato antes de enviar.
 * 2. Envía el payload del contrato (teléfono normalizado) con Idempotency-Key.
 * 3. Reintentar el mismo payload conserva la clave.
 * 4. Al recibir 202 muestra la referencia devuelta por el backend.
 * 5. Precarga el correo de la sesión cuando existe.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import { submitPartnerApplicationApi } from "@/features/partners/api/partner-applications.api";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import { createIdempotencyKey } from "@/features/partners/utils/create-idempotency-key";
import { PartnerApplicationForm } from "../partner-application-form";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));

jest.mock("@/features/partners/api/partner-applications.api", () => ({
  submitPartnerApplicationApi: jest.fn(),
}));

jest.mock("@/features/partners/utils/create-idempotency-key", () => ({
  createIdempotencyKey: jest.fn(),
}));

const mockUseAuth = jest.mocked(useAuth);
const mockSubmitApi = jest.mocked(submitPartnerApplicationApi);
const mockCreateIdempotencyKey = jest.mocked(createIdempotencyKey);

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PartnerApplicationForm />
    </QueryClientProvider>,
  );
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^correo$/i), "partner@example.com");
  await user.type(screen.getByLabelText(/razón social/i), "Partner Demo SAC");
  await user.type(screen.getByLabelText(/nombre de contacto/i), "Andrea Partner");
  await user.type(screen.getByLabelText(/teléfono/i), "+51 999 999 999");
  await user.type(screen.getByLabelText(/^país$/i), "pe");
}

beforeEach(() => {
  let counter = 0;
  mockCreateIdempotencyKey.mockReset();
  mockCreateIdempotencyKey.mockImplementation(() => `key-${++counter}`);
  mockSubmitApi.mockReset();
  mockUseAuth.mockReturnValue({ auth: null } as unknown as ReturnType<typeof useAuth>);
});

describe("PartnerApplicationForm", () => {
  it("valida los campos obligatorios antes de enviar", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /enviar solicitud/i }));

    expect(await screen.findByText(/el correo es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/la razón social es obligatoria/i)).toBeInTheDocument();
    expect(screen.getByText(/el nombre de contacto es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/el teléfono es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/el país es obligatorio/i)).toBeInTheDocument();
    expect(mockSubmitApi).not.toHaveBeenCalled();
  });

  it("rechaza un teléfono con caracteres que no son de un número", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/teléfono/i), "llamame");
    await user.click(screen.getByRole("button", { name: /enviar solicitud/i }));

    expect(await screen.findByText(/usá solo números/i)).toBeInTheDocument();
  });

  it("no exige código de país en el teléfono: esa regla la decide el backend", async () => {
    mockSubmitApi.mockResolvedValue({ applicationReference: "APP-1", status: "APPLIED" });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/^correo$/i), "partner@example.com");
    await user.type(screen.getByLabelText(/razón social/i), "Partner Demo SAC");
    await user.type(screen.getByLabelText(/nombre de contacto/i), "Andrea Partner");
    await user.type(screen.getByLabelText(/teléfono/i), "999 999 999");
    await user.type(screen.getByLabelText(/^país$/i), "PE");
    await user.click(screen.getByRole("button", { name: /enviar solicitud/i }));

    await waitFor(() => expect(mockSubmitApi).toHaveBeenCalledTimes(1));
    expect(mockSubmitApi.mock.calls[0][0].phone).toBe("999999999");
  });

  it.each([
    ["CL", "CL"],
    ["mx", "MX"],
    ["Ar", "AR"],
  ])(
    "acepta cualquier código ISO de dos letras (%s) y lo envía en mayúsculas",
    async (typed, sent) => {
      mockSubmitApi.mockResolvedValue({ applicationReference: "APP-1", status: "APPLIED" });
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText(/^correo$/i), "partner@example.com");
      await user.type(screen.getByLabelText(/razón social/i), "Partner Demo SAC");
      await user.type(screen.getByLabelText(/nombre de contacto/i), "Andrea Partner");
      await user.type(screen.getByLabelText(/teléfono/i), "+56 9 1234 5678");
      await user.type(screen.getByLabelText(/^país$/i), typed);
      await user.click(screen.getByRole("button", { name: /enviar solicitud/i }));

      await waitFor(() => expect(mockSubmitApi).toHaveBeenCalledTimes(1));
      expect(mockSubmitApi.mock.calls[0][0].country).toBe(sent);
    },
  );

  it("rechaza un país que no es un código de dos letras", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/^país$/i), "P1");
    await user.click(screen.getByRole("button", { name: /enviar solicitud/i }));

    expect(await screen.findByText(/código de país de dos letras/i)).toBeInTheDocument();
  });

  it("muestra las validaciones que devuelve la API en el campo y el detalle del servicio", async () => {
    mockSubmitApi.mockRejectedValue(
      buildAxiosError(400, {
        code: "VALIDATION_FAILED",
        message: "phone must be a valid E.164 number",
        correlationId: "corr-400",
        details: { phone: "must be a valid E.164 number" },
      }),
    );
    const user = userEvent.setup();
    renderForm();

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /enviar solicitud/i }));

    expect(await screen.findByText("must be a valid E.164 number")).toBeInTheDocument();
    expect(
      screen.getByText(/detalle del servicio: phone must be a valid E.164 number/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/corr-400/)).toBeInTheDocument();
  });

  it("envía el payload del contrato y muestra la referencia devuelta", async () => {
    mockSubmitApi.mockResolvedValue({ applicationReference: "APP-2026-000001", status: "APPLIED" });
    const user = userEvent.setup();
    renderForm();

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /enviar solicitud/i }));

    await waitFor(() => expect(mockSubmitApi).toHaveBeenCalledTimes(1));
    expect(mockSubmitApi).toHaveBeenCalledWith(
      {
        email: "partner@example.com",
        legalName: "Partner Demo SAC",
        contactName: "Andrea Partner",
        phone: "+51999999999",
        country: "PE",
      },
      "key-1",
    );
    expect(await screen.findByText("APP-2026-000001")).toBeInTheDocument();
  });

  it("al reintentar el mismo payload conserva la Idempotency-Key", async () => {
    mockSubmitApi.mockRejectedValueOnce(buildAxiosError()).mockResolvedValueOnce({
      applicationReference: "APP-2026-000002",
      status: "APPLIED",
    });
    const user = userEvent.setup();
    renderForm();

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /enviar solicitud/i }));
    expect(await screen.findByText(/no pudimos conectar/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /enviar solicitud/i }));

    expect(await screen.findByText("APP-2026-000002")).toBeInTheDocument();
    expect(mockSubmitApi.mock.calls.map(([, key]) => key)).toEqual(["key-1", "key-1"]);
  });

  it("precarga el correo de la cuenta en sesión", async () => {
    mockUseAuth.mockReturnValue({
      auth: { user: { email: "cuenta@powip.com", name: "Andrea", surname: "Partner" } },
    } as unknown as ReturnType<typeof useAuth>);
    renderForm();

    expect(screen.getByLabelText(/^correo$/i)).toHaveValue("cuenta@powip.com");
    expect(screen.getByLabelText(/nombre de contacto/i)).toHaveValue("Andrea Partner");
  });
});
