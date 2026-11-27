import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddIssuerModal } from "@/app/facturacion/components/modals/AddIssuerModal";

// La verificación consulta SUNAT con react-query: aquí solo interesa que el botón entregue el resultado.
jest.mock("@/app/facturacion/components/VerifyIdentityButton", () => ({
  VerifyIdentityButton: ({
    onVerified,
  }: {
    onVerified: (result: { fullName: string }) => void;
  }) => (
    <button type="button" onClick={() => onVerified({ fullName: "EMPRESA VERIFICADA S.A.C." })}>
      Verificar en SUNAT
    </button>
  ),
}));

function renderModal(overrides: Partial<React.ComponentProps<typeof AddIssuerModal>> = {}) {
  const onConfirm = jest.fn();
  const onClose = jest.fn();

  render(
    <AddIssuerModal
      isOpen
      onClose={onClose}
      onConfirm={onConfirm}
      pricePerRuc={15}
      requiresPayment
      renewingRucs={2}
      existingRucs={["20111111111"]}
      {...overrides}
    />,
  );

  return { onConfirm, onClose };
}

describe("AddIssuerModal", () => {
  it("avisa que es un add-on de S/ 15/mes que se paga por adelantado y cuánto pasaría a pagar", () => {
    renderModal();

    expect(screen.getByText("Agregar RUC emisor")).toBeInTheDocument();
    expect(screen.getByText(/add-on de S\/ 15\/mes/)).toBeInTheDocument();
    expect(
      screen.getByText(/S\/ 45\/mes por RUC adicionales \(3 adicionales\)/),
    ).toBeInTheDocument();
    expect(screen.getByText(/por adelantado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar RUC (+S/ 15/mes)" })).toBeInTheDocument();
  });

  it("si hay un RUC incluido libre no habla de pago", () => {
    renderModal({ requiresPayment: false });

    expect(screen.queryByText(/add-on de S\//)).not.toBeInTheDocument();
    expect(screen.getByText(/Tu plan incluye este RUC/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar RUC (incluido)" })).toBeInTheDocument();
  });

  it("completa la razón social al verificar y confirma con el RUC y la razón social", async () => {
    const { onConfirm } = renderModal();

    await userEvent.type(screen.getByLabelText("RUC"), "20999999999");
    await userEvent.click(screen.getByRole("button", { name: "Verificar en SUNAT" }));

    expect(screen.getByLabelText("Razón social")).toHaveValue("EMPRESA VERIFICADA S.A.C.");

    await userEvent.click(screen.getByRole("button", { name: "Agregar RUC (+S/ 15/mes)" }));

    expect(onConfirm).toHaveBeenCalledWith({
      ruc: "20999999999",
      razonSocial: "EMPRESA VERIFICADA S.A.C.",
    });
  });

  it("rechaza un RUC que no tiene 11 dígitos o no empieza con 10 o 20", async () => {
    const { onConfirm } = renderModal();

    await userEvent.type(screen.getByLabelText("RUC"), "30123456789");
    await userEvent.click(screen.getByRole("button", { name: "Agregar RUC (+S/ 15/mes)" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "El RUC debe tener 11 dígitos y empezar con 10 o 20.",
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("avisa que el RUC ya está conectado", async () => {
    const { onConfirm } = renderModal();

    await userEvent.type(screen.getByLabelText("RUC"), "20111111111");
    await userEvent.type(screen.getByLabelText("Razón social"), "OTRA SAC");
    await userEvent.click(screen.getByRole("button", { name: "Agregar RUC (+S/ 15/mes)" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Ese RUC ya está conectado");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("pide verificar el RUC si falta la razón social", async () => {
    const { onConfirm } = renderModal();

    await userEvent.type(screen.getByLabelText("RUC"), "20999999999");
    await userEvent.click(screen.getByRole("button", { name: "Agregar RUC (+S/ 15/mes)" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Verifica el RUC");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("para activar un RUC que ya existe carga sus datos y no deja cambiarlos", () => {
    renderModal({ initialValues: { ruc: "20111111111", razonSocial: "EXISTENTE SAC" } });

    expect(screen.getByLabelText("RUC")).toHaveValue("20111111111");
    expect(screen.getByLabelText("RUC")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Razón social")).toHaveValue("EXISTENTE SAC");
    expect(screen.queryByRole("button", { name: "Verificar en SUNAT" })).not.toBeInTheDocument();
  });

  it("con un RUC que ya existe y se cobra, habla de pagar su cupo y no de agregarlo", () => {
    renderModal({ initialValues: { ruc: "20111111111", razonSocial: "EXISTENTE SAC" } });

    expect(screen.getByText("Pagar cupo del RUC")).toBeInTheDocument();
    expect(screen.queryByText("Agregar RUC emisor")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pagar cupo (+S/ 15/mes)" })).toBeInTheDocument();
  });

  it("con un RUC que ya existe y entra gratis, habla de activarlo", () => {
    renderModal({
      requiresPayment: false,
      initialValues: { ruc: "20111111111", razonSocial: "EXISTENTE SAC" },
    });

    expect(screen.getByText("Activar RUC emisor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activar RUC (incluido)" })).toBeInTheDocument();
  });

  it("mientras va a la pasarela no se puede cancelar ni confirmar de nuevo", () => {
    renderModal({ isSubmitting: true });

    expect(screen.getByRole("button", { name: /Yendo a la pasarela/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});
