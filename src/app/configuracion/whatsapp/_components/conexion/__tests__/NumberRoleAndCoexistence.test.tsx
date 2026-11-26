import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConnectNumberDialog } from "../ConnectNumberDialog";
import { COEXISTENCE_CONFIRMATION_CODE } from "../connection-types";
import { ManualNumberDialog } from "../ManualNumberDialog";

const AVISO =
  /Este número no tiene coexistencia\. Si sigues, dejará de funcionar en la app WhatsApp Business del celular y solo se podrá usar desde Powip\. ¿Deseas continuar\?/;

/** Lo que responde ms-integrations cuando Meta dice que el número no está en la app. */
const sinCoexistencia = () =>
  Object.assign(new Error("Request failed with status code 409"), {
    response: { status: 409, data: { code: COEXISTENCE_CONFIRMATION_CODE } },
  });

function fillManual() {
  const values: Record<string, string> = {
    "Número (con código de país)": "51900000103",
    "Phone number ID": "300000000000103",
    "WABA ID": "200000000000001",
    "Token de acceso": "token-de-prueba",
  };
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

describe("Alta manual: tipo de número y aviso de coexistencia", () => {
  it("muestra el tipo de número (por defecto, principal de la tienda)", () => {
    render(
      <ManualNumberDialog storeId="kunka" storeName="Kunka" connectManual={jest.fn()} onClose={jest.fn()} />,
    );
    expect(screen.getByText("Tipo de número")).toBeInTheDocument();
    expect(screen.getByText("Número principal de la tienda (Kunka)")).toBeInTheDocument();
  });

  it("si Meta dice que no hay coexistencia, pregunta y reenvía con la confirmación", async () => {
    const connectManual = jest
      .fn()
      .mockRejectedValueOnce(sinCoexistencia())
      .mockResolvedValueOnce(undefined);
    const onClose = jest.fn();
    render(
      <ManualNumberDialog storeId="kunka" storeName="Kunka" connectManual={connectManual} onClose={onClose} />,
    );
    fillManual();
    fireEvent.click(screen.getByRole("button", { name: "Agregar número" }));

    expect(await screen.findByText(AVISO)).toBeInTheDocument();
    expect(connectManual).toHaveBeenCalledTimes(1);
    expect(connectManual.mock.calls[0][0]).not.toHaveProperty("confirmNoCoexistence");
    expect(connectManual.mock.calls[0][0]).toMatchObject({ role: "store", phoneNumberId: "300000000000103" });

    fireEvent.click(screen.getByRole("button", { name: "Sí, continuar" }));
    await waitFor(() => expect(connectManual).toHaveBeenCalledTimes(2));
    expect(connectManual.mock.calls[1][0]).toMatchObject({ confirmNoCoexistence: true, role: "store" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("Cancelar no conecta nada", async () => {
    const connectManual = jest.fn().mockRejectedValueOnce(sinCoexistencia());
    const onClose = jest.fn();
    render(
      <ManualNumberDialog storeId="kunka" storeName="Kunka" connectManual={connectManual} onClose={onClose} />,
    );
    fillManual();
    fireEvent.click(screen.getByRole("button", { name: "Agregar número" }));
    await screen.findByText(AVISO);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(await screen.findByText("No se conectó el número.")).toBeInTheDocument();
    expect(connectManual).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Alta por Facebook: aviso antes de abrir Meta", () => {
  const renderDialog = (mode: "api" | "coex", startSignup = jest.fn().mockResolvedValue(undefined)) => {
    render(
      <ConnectNumberDialog
        storeId="kunka"
        storeName="Kunka"
        mode={mode}
        blockedReason={null}
        startSignup={startSignup}
        onClose={jest.fn()}
      />,
    );
    return startSignup;
  };

  it("número dedicado: pregunta antes de abrir Meta y Cancelar no abre nada", async () => {
    const startSignup = renderDialog("api");
    expect(screen.getByText("Tipo de número")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar con Facebook" }));

    expect(await screen.findByText(AVISO)).toBeInTheDocument();
    expect(startSignup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(await screen.findByText("No se conectó ningún número.")).toBeInTheDocument();
    expect(startSignup).not.toHaveBeenCalled();
  });

  it("número dedicado: «Sí, continuar» abre Meta con la confirmación y el tipo", async () => {
    const startSignup = renderDialog("api");
    fireEvent.click(screen.getByRole("button", { name: "Continuar con Facebook" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sí, continuar" }));
    await waitFor(() => expect(startSignup).toHaveBeenCalledTimes(1));
    expect(startSignup.mock.calls[0][0]).toMatchObject({
      storeId: "kunka",
      mode: "api",
      role: "store",
      confirmNoCoexistence: true,
    });
  });

  it("coexistencia: abre Meta sin preguntar; si Meta dice que no la tiene, pregunta", async () => {
    const startSignup = jest
      .fn()
      .mockRejectedValueOnce(sinCoexistencia())
      .mockResolvedValueOnce(undefined);
    renderDialog("coex", startSignup);
    fireEvent.click(screen.getByRole("button", { name: "Continuar con Facebook" }));
    expect(await screen.findByText(AVISO)).toBeInTheDocument();
    expect(startSignup.mock.calls[0][0]).not.toHaveProperty("confirmNoCoexistence");

    fireEvent.click(screen.getByRole("button", { name: "Sí, continuar" }));
    await waitFor(() => expect(startSignup).toHaveBeenCalledTimes(2));
    expect(startSignup.mock.calls[1][0]).toMatchObject({ confirmNoCoexistence: true });
  });
});
