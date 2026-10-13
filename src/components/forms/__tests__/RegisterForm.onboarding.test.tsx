import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("muestra el error del flujo y permite corregir el email para reintentar sin perder datos", async () => {
    const onNext = jest.fn<Promise<void>, [RegisterData]>().mockResolvedValue(undefined);
    const { rerender } = render(<RegisterForm isLoading={false} error={null} onNext={onNext} />);
    reachAccountStep();
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));

    rerender(
      <RegisterForm isLoading={false} error="Este email ya está registrado." onNext={onNext} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Este email ya está registrado.");
    expect(screen.getByLabelText(/^Contraseña$/)).toHaveValue(account.password);
    change(/^Correo electrónico$/, "nuevo@negocio.com");
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(2));
    expect(onNext).toHaveBeenLastCalledWith({ ...account, email: "nuevo@negocio.com" });
  });
});
