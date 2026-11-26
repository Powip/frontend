import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  COEXISTENCE_CONFIRMATION_CODE,
  PHONE_MISMATCH_CODE,
  phoneMismatch,
} from "../connection-types";
import { ManualNumberDialog } from "../ManualNumberDialog";

/** Lo que responde ms-integrations cuando el número escrito no es el de Meta (caso real). */
const numeroDistinto = () =>
  Object.assign(new Error("Request failed with status code 409"), {
    response: {
      status: 409,
      data: {
        code: PHONE_MISMATCH_CODE,
        message: "El número que escribiste (+15551486305) no es el de este Phone number ID.",
        details: {
          phoneNumberId: "300000000000101",
          typedPhoneNumber: "15551486305",
          metaPhoneNumber: "51923101193",
        },
      },
    },
  });

const sinCoexistencia = () =>
  Object.assign(new Error("Request failed with status code 409"), {
    response: { status: 409, data: { code: COEXISTENCE_CONFIRMATION_CODE } },
  });

function fill(values: Partial<Record<string, string>> = {}) {
  const all: Record<string, string> = {
    "Número (opcional, con código de país)": "15551486305",
    "Phone number ID": "300000000000101",
    "WABA ID": "200000000000001",
    "Token de acceso": "token-de-prueba",
    ...values,
  };
  for (const [label, value] of Object.entries(all)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

function renderDialog(connectManual: jest.Mock, onClose = jest.fn()) {
  render(
    <ManualNumberDialog
      storeId="kunka"
      storeName="Kunka"
      connectManual={connectManual}
      onClose={onClose}
    />,
  );
  return onClose;
}

describe("phoneMismatch", () => {
  it("lee los dos números del 409 del backend", () => {
    expect(phoneMismatch(numeroDistinto())).toEqual({ typed: "15551486305", meta: "51923101193" });
  });

  it("devuelve null para otros errores", () => {
    expect(phoneMismatch(sinCoexistencia())).toBeNull();
    expect(phoneMismatch(new Error("x"))).toBeNull();
  });
});

describe("Alta manual: el número se lee de Meta", () => {
  it("el número es opcional: se puede agregar sin escribirlo", async () => {
    const connectManual = jest.fn().mockResolvedValue(undefined);
    renderDialog(connectManual);
    fill({ "Número (opcional, con código de país)": "" });

    const button = screen.getByRole("button", { name: "Agregar número" });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    await waitFor(() => expect(connectManual).toHaveBeenCalledTimes(1));
    expect(connectManual.mock.calls[0][0]).not.toHaveProperty("businessPhoneNumber");
  });

  it("si el número no coincide, muestra ambos y reenvía guardando el de Meta", async () => {
    const connectManual = jest
      .fn()
      .mockRejectedValueOnce(numeroDistinto())
      .mockResolvedValueOnce(undefined);
    const onClose = renderDialog(connectManual);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Agregar número" }));

    expect(await screen.findByText("El número no coincide con Meta")).toBeInTheDocument();
    expect(screen.getByText("+15551486305")).toBeInTheDocument();
    expect(screen.getByText("+51923101193")).toBeInTheDocument();
    expect(connectManual.mock.calls[0][0]).not.toHaveProperty("confirmPhoneFromMeta");

    fireEvent.click(screen.getByRole("button", { name: "Usar +51923101193" }));
    await waitFor(() => expect(connectManual).toHaveBeenCalledTimes(2));
    expect(connectManual.mock.calls[1][0]).toMatchObject({ confirmPhoneFromMeta: true });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("Cancelar no conecta nada", async () => {
    const connectManual = jest.fn().mockRejectedValueOnce(numeroDistinto());
    const onClose = renderDialog(connectManual);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Agregar número" }));

    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se conectó el número.");
    expect(connectManual).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("conserva la confirmación del número si después pregunta por la coexistencia", async () => {
    const connectManual = jest
      .fn()
      .mockRejectedValueOnce(numeroDistinto())
      .mockRejectedValueOnce(sinCoexistencia())
      .mockResolvedValueOnce(undefined);
    renderDialog(connectManual);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Agregar número" }));

    fireEvent.click(await screen.findByRole("button", { name: "Usar +51923101193" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sí, continuar" }));

    await waitFor(() => expect(connectManual).toHaveBeenCalledTimes(3));
    expect(connectManual.mock.calls[2][0]).toMatchObject({
      confirmPhoneFromMeta: true,
      confirmNoCoexistence: true,
    });
  });
});
