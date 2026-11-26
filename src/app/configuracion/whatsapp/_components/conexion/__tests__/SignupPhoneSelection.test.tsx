import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConnectNumberDialog } from "../ConnectNumberDialog";
import { PHONE_REASSIGN_CODE, PHONE_SELECTION_CODE } from "../connection-types";

const backend = (status: number, code: string, details: Record<string, unknown>, message = "x") =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { code, message, details } },
  });

const THREE = [
  { phoneNumberId: "ph-a", wabaId: "w1", displayPhoneNumber: "+51 900 000 001", verifiedName: "Kunka Lima", isOnBizApp: true },
  { phoneNumberId: "ph-b", wabaId: "w1", displayPhoneNumber: "+51 900 000 002", verifiedName: "Kunka Norte", isOnBizApp: true },
  { phoneNumberId: "ph-c", wabaId: "w2", displayPhoneNumber: "+51 900 000 003", verifiedName: "Otra marca", isOnBizApp: true },
];

const renderDialog = (startSignup: jest.Mock, selectSignupPhone?: jest.Mock) => {
  const onClose = jest.fn();
  render(
    <ConnectNumberDialog
      storeId="kunka"
      storeName="Kunka"
      mode="coex"
      blockedReason={null}
      startSignup={startSignup}
      selectSignupPhone={selectSignupPhone}
      onClose={onClose}
    />,
  );
  return onClose;
};

describe("Conectar con Facebook: el número correcto", () => {
  it("envía el número indicado por la persona", async () => {
    const startSignup = jest.fn().mockResolvedValue(undefined);
    renderDialog(startSignup);
    fireEvent.change(screen.getByLabelText("Número que vas a conectar (opcional)"), {
      target: { value: "+51 900 000 002" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar con Facebook" }));
    await waitFor(() => expect(startSignup).toHaveBeenCalledTimes(1));
    expect(startSignup.mock.calls[0][0]).toMatchObject({ expectedPhoneNumber: "+51 900 000 002" });
  });

  it("con varios números muestra la lista y conecta el elegido sin abrir Meta otra vez", async () => {
    const startSignup = jest
      .fn()
      .mockRejectedValueOnce(backend(409, PHONE_SELECTION_CODE, { selectionId: "sel-1", candidates: THREE }));
    const selectSignupPhone = jest.fn().mockResolvedValue(undefined);
    renderDialog(startSignup, selectSignupPhone);
    fireEvent.click(screen.getByRole("button", { name: "Continuar con Facebook" }));

    expect(await screen.findByText("¿Qué número quieres conectar?")).toBeInTheDocument();
    expect(screen.getByText("+51 900 000 001")).toBeInTheDocument();
    expect(screen.getByText(/Otra marca/)).toBeInTheDocument();
    const connectBtn = screen.getByRole("button", { name: "Conectar este número" });
    expect(connectBtn).toBeDisabled();

    fireEvent.click(screen.getByText("+51 900 000 003"));
    fireEvent.click(connectBtn);
    await waitFor(() => expect(selectSignupPhone).toHaveBeenCalledTimes(1));
    expect(selectSignupPhone.mock.calls[0][0]).toMatchObject({
      storeId: "kunka",
      selectionId: "sel-1",
      phoneNumberId: "ph-c",
    });
    expect(startSignup).toHaveBeenCalledTimes(1);
  });

  it("Cancelar en la lista no conecta nada", async () => {
    const startSignup = jest
      .fn()
      .mockRejectedValueOnce(backend(409, PHONE_SELECTION_CODE, { selectionId: "sel-1", candidates: THREE }));
    const selectSignupPhone = jest.fn();
    renderDialog(startSignup, selectSignupPhone);
    fireEvent.click(screen.getByRole("button", { name: "Continuar con Facebook" }));
    await screen.findByText("¿Qué número quieres conectar?");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(await screen.findByText("No se conectó ningún número.")).toBeInTheDocument();
    expect(selectSignupPhone).not.toHaveBeenCalled();
  });

  it("número indicado que no está en Meta: muestra el motivo y no conecta", async () => {
    const startSignup = jest
      .fn()
      .mockRejectedValueOnce(
        backend(422, "SIGNUP_PHONE_NOT_FOUND", { count: 3 }, "El número +51 999 no está entre los 3 que compartiste en Facebook. No se conectó ningún número."),
      );
    renderDialog(startSignup, jest.fn());
    fireEvent.click(screen.getByRole("button", { name: "Continuar con Facebook" }));
    expect(await screen.findByText(/no está entre los 3 que compartiste/)).toBeInTheDocument();
  });

  it("número en otra tienda: pregunta y solo mueve si confirma", async () => {
    const startSignup = jest
      .fn()
      .mockRejectedValueOnce(backend(409, PHONE_SELECTION_CODE, { selectionId: "sel-1", candidates: THREE }));
    const selectSignupPhone = jest
      .fn()
      .mockRejectedValueOnce(
        backend(409, PHONE_REASSIGN_CODE, {
          selectionId: "sel-2",
          reason: "other_store",
          displayPhoneNumber: "51900000002",
          phoneNumberId: "ph-b",
        }),
      )
      .mockResolvedValueOnce(undefined);
    renderDialog(startSignup, selectSignupPhone);
    fireEvent.click(screen.getByRole("button", { name: "Continuar con Facebook" }));
    await screen.findByText("¿Qué número quieres conectar?");
    fireEvent.click(screen.getByText("+51 900 000 002"));
    fireEvent.click(screen.getByRole("button", { name: "Conectar este número" }));

    expect(await screen.findByText(/\+51900000002 ya está conectado en otra tienda/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sí, mover" }));
    await waitFor(() => expect(selectSignupPhone).toHaveBeenCalledTimes(2));
    expect(selectSignupPhone.mock.calls[1][0]).toMatchObject({ selectionId: "sel-2", confirmReassign: true });
    expect(selectSignupPhone.mock.calls[1][0]).not.toHaveProperty("phoneNumberId");
  });
});
