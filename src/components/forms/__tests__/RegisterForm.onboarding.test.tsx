import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import type { RegisterData } from "@/hooks/useOnboardingFlow";
import RegisterForm from "../RegisterForm";

jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));

const account: RegisterData = {
  name: "Juan",
  surname: "Pérez",
  email: "juan@negocio.com",
  password: "segura1",
  phone: "987654321",
  identityDocument: "20123456789",
  district: "Miraflores",
  address: "Av. Larco 123",
};

const change = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

function continueStep() {
  const form = screen.getByRole("button", { name: "Continuar" }).closest("form");
  if (!form) throw new Error("El botón debe pertenecer al formulario de registro.");
  fireEvent.submit(form);
}

function fillPersonalData() {
  change(/^Nombre$/, account.name);
  change(/^Apellido$/, account.surname);
  change(/^WhatsApp/, account.phone);
  change(/^DNI \/ RUC$/, account.identityDocument);
}

function fillAccountStep() {
  change(/^Correo electrónico$/, account.email);
  change(/^Contraseña$/, account.password);
  change(/^Confirmar contraseña$/, account.password);
}

function reachAccountStep() {
  fillPersonalData();
  continueStep();
  change(/^Distrito$/, account.district);
  change(/^Dirección$/, account.address);
  continueStep();
  fillAccountStep();
}

describe("RegisterForm — integración con onboarding", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it("identifica el primer campo inválido, lo enfoca sin scroll y actualiza su error al editar", () => {
    const focus = jest.spyOn(HTMLElement.prototype, "focus");
    const onNext = jest.fn<Promise<void>, [RegisterData]>().mockResolvedValue(undefined);
    render(<RegisterForm isLoading={false} error={null} onNext={onNext} />);

    continueStep();

    const name = screen.getByLabelText(/^Nombre$/);
    expect(name).toHaveFocus();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(name).toHaveAccessibleDescription("Este campo es obligatorio.");
    expect(toast.error).toHaveBeenCalledWith(
      "Revisa tus datos",
      expect.objectContaining({
        description: "Nombre: Este campo es obligatorio.",
      }),
    );

    change(/^Nombre$/, "A");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Mínimo 2 caracteres.");
    change(/^Nombre$/, account.name);
    expect(name).toHaveAttribute("aria-invalid", "false");
    expect(name).not.toHaveAttribute("aria-describedby");
    expect(document.getElementById("register-name-error")).toBeNull();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it("vuelve al paso del primer error pendiente y enfoca su input antes de registrar", () => {
    const onNext = jest.fn<Promise<void>, [RegisterData]>().mockResolvedValue(undefined);
    render(<RegisterForm isLoading={false} error={null} onNext={onNext} />);
    reachAccountStep();
    fireEvent.click(screen.getByRole("button", { name: "Datos personales" }));
    change(/^Apellido$/, "");
    fireEvent.click(screen.getByRole("button", { name: "Acceso a tu cuenta" }));

    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(screen.getByRole("button", { name: "Datos personales" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByLabelText(/^Apellido$/)).toHaveFocus();
    expect(toast.error).toHaveBeenCalledWith(
      "Revisa tus datos",
      expect.objectContaining({
        description: "Apellido: Este campo es obligatorio.",
      }),
    );
    expect(onNext).not.toHaveBeenCalled();
  });

  it("presenta la regla de contraseña compacta y corrige también una confirmación ya inválida", () => {
    const onNext = jest.fn<Promise<void>, [RegisterData]>().mockResolvedValue(undefined);
    render(<RegisterForm isLoading={false} error={null} onNext={onNext} />);
    reachAccountStep();
    change(/^Contraseña$/, "a1");
    change(/^Confirmar contraseña$/, "otra123");

    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(screen.getByLabelText(/^Contraseña$/)).toHaveFocus();
    expect(screen.getByLabelText(/^Contraseña$/)).toHaveAccessibleDescription(
      "Usa 6 caracteres o más, una minúscula y un número.",
    );
    expect(screen.getByLabelText(/^Confirmar contraseña$/)).toHaveAccessibleDescription(
      "Las contraseñas no coinciden.",
    );
    change(/^Contraseña$/, "otra123");
    expect(screen.getByLabelText(/^Contraseña$/)).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByLabelText(/^Confirmar contraseña$/)).toHaveAttribute(
      "aria-invalid",
      "false",
    );
    expect(document.getElementById("register-confirm-error")).toBeNull();
    expect(onNext).not.toHaveBeenCalled();
  });
  it("bloquea el avance con teléfono o documento no numéricos y acepta un DNI de 8 dígitos", () => {
    const onNext = jest.fn<Promise<void>, [RegisterData]>().mockResolvedValue(undefined);
    render(<RegisterForm isLoading={false} error={null} onNext={onNext} />);
    fillPersonalData();
    change(/^WhatsApp/, "98765a321");
    change(/^DNI \/ RUC$/, "1234abcd");

    continueStep();

    expect(screen.getByRole("button", { name: "Datos personales" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByRole("button", { name: "Ubicación" })).toBeDisabled();
    expect(screen.getByLabelText(/^WhatsApp/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/^DNI \/ RUC$/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByLabelText(/^Distrito$/)).not.toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();

    change(/^WhatsApp/, account.phone);
    change(/^DNI \/ RUC$/, "12345678");
    continueStep();

    expect(screen.getByRole("button", { name: "Ubicación" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(onNext).not.toHaveBeenCalled();
  });

  it("conserva los datos al retroceder y entrega exactamente los 8 campos del onboarding", async () => {
    const onNext = jest.fn<Promise<void>, [RegisterData]>().mockResolvedValue(undefined);
    render(<RegisterForm isLoading={false} error={null} onNext={onNext} />);
    reachAccountStep();
    expect(onNext).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
    expect(screen.getByLabelText(/^Distrito$/)).toHaveValue(account.district);
    expect(screen.getByLabelText(/^Dirección$/)).toHaveValue(account.address);
    fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
    expect(screen.getByLabelText(/^Nombre$/)).toHaveValue(account.name);
    expect(screen.getByLabelText(/^WhatsApp/)).toHaveValue(account.phone);
    expect(screen.getByLabelText(/^DNI \/ RUC$/)).toHaveValue(account.identityDocument);
    fireEvent.click(screen.getByRole("button", { name: "Acceso a tu cuenta" }));
    expect(screen.getByLabelText(/^Correo electrónico$/)).toHaveValue(account.email);
    expect(screen.getByLabelText(/^Confirmar contraseña$/)).toHaveValue(account.password);

    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
    expect(onNext).toHaveBeenCalledWith(account);
    expect(Object.keys(onNext.mock.calls[0][0])).toHaveLength(8);
    expect(onNext.mock.calls[0][0]).not.toHaveProperty("confirmPassword");
    expect(onNext.mock.calls[0][0]).not.toHaveProperty("phoneNumber");
  });

  it.each([
    { status: 409, error: "Este email ya está registrado." },
    { status: 400, error: "El correo electrónico ya existe." },
  ])(
    "muestra el error de email duplicado ($status) y conserva los datos para reintentar",
    async ({ error }) => {
      const onNext = jest.fn<Promise<void>, [RegisterData]>().mockResolvedValue(undefined);
      const { rerender } = render(<RegisterForm isLoading={false} error={null} onNext={onNext} />);
      reachAccountStep();
      fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
      await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));

      rerender(<RegisterForm isLoading={false} error={error} onNext={onNext} />);
      expect(screen.getByRole("alert")).toHaveTextContent("No pudimos continuar");
      expect(screen.getByRole("alert")).toHaveTextContent(error);
      expect(toast.error).not.toHaveBeenCalled();
      expect(screen.getByLabelText(/^Contraseña$/)).toHaveValue(account.password);
      change(/^Correo electrónico$/, "nuevo@negocio.com");
      fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

      await waitFor(() => expect(onNext).toHaveBeenCalledTimes(2));
      expect(onNext).toHaveBeenLastCalledWith({ ...account, email: "nuevo@negocio.com" });
    },
  );

  it("prioriza los errores de campo sobre un aviso anterior del servidor", () => {
    const onNext = jest.fn<Promise<void>, [RegisterData]>().mockResolvedValue(undefined);
    const error = "El correo electrónico ya existe.";
    render(<RegisterForm isLoading={false} error={error} onNext={onNext} />);
    reachAccountStep();
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos continuar");
    expect(toast.error).not.toHaveBeenCalled();
    change(/^Correo electrónico$/, "correo-inválido");

    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Correo electrónico$/)).toHaveAccessibleDescription(
      "El correo electrónico no es válido.",
    );
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it("marca el formulario ocupado mientras el flujo procesa el registro", () => {
    const onNext = jest.fn<Promise<void>, [RegisterData]>().mockResolvedValue(undefined);
    const { rerender } = render(<RegisterForm isLoading={false} error={null} onNext={onNext} />);
    const form = screen.getByRole("button", { name: "Continuar" }).closest("form");
    expect(form).toHaveAttribute("aria-busy", "false");

    rerender(<RegisterForm isLoading={true} error={null} onNext={onNext} />);

    expect(form).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Creando cuenta..." })).toBeDisabled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it("abre los documentos legales oficiales sin abandonar el formulario ni crear una cuenta", () => {
    const onNext = jest.fn<Promise<void>, [RegisterData]>().mockResolvedValue(undefined);
    render(<RegisterForm isLoading={false} error={null} onNext={onNext} />);
    expect(screen.queryByRole("link", { name: /^Términos de Servicio/ })).not.toBeInTheDocument();
    fillPersonalData();
    continueStep();
    expect(screen.queryByRole("link", { name: /^Términos de Servicio/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Política de Privacidad/ })).not.toBeInTheDocument();
    change(/^Distrito$/, account.district);
    change(/^Dirección$/, account.address);
    continueStep();
    fillAccountStep();

    const terms = screen.getByRole("link", { name: /^Términos de Servicio/ });
    const privacy = screen.getByRole("link", { name: /^Política de Privacidad/ });
    expect(terms).toHaveAttribute("href", "https://www.powip.lat/terminos");
    expect(privacy).toHaveAttribute("href", "https://www.powip.lat/privacidad");
    for (const link of [terms, privacy]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAccessibleName(/se abre en una nueva pestaña/);
    }
    expect(onNext).not.toHaveBeenCalled();
  });
});
