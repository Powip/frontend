import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CrearClienteDialog from "@/components/ventas-chat/CrearClienteDialog";
import { createClient } from "@/services/clients.service";
import { createConversationClient } from "@/services/crmService";

jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/services/clients.service", () => ({ createClient: jest.fn() }));
jest.mock("@/services/crmService", () => ({ createConversationClient: jest.fn() }));

const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

function openDialog(phone: string) {
  const onCreated = jest.fn();
  render(
    <CrearClienteDialog
      open
      onOpenChange={jest.fn()}
      companyId="co1"
      conversationId="c1"
      phone={phone}
      name="Ana Pérez"
      onCreated={onCreated}
    />,
  );
  type(/Departamento/, "Lima");
  type(/Provincia/, "Lima");
  type(/Distrito/, "Surco");
  type(/Dirección/, "Av. 1");
  fireEvent.click(screen.getByRole("button", { name: "Crear cliente" }));
  return onCreated;
}

const data = { fullName: "Ana Pérez", city: "Lima", province: "Lima", district: "Surco", address: "Av. 1" };

describe("crear cliente desde el chat", () => {
  beforeEach(() => jest.clearAllMocks());

  it("con el teléfono oculto lo crea el CRM y no se puede editar el número", async () => {
    (createConversationClient as jest.Mock).mockResolvedValue({ id: "cli1" });
    const onCreated = openDialog("+51 951 *** 245");
    expect(screen.getByLabelText(/Teléfono/)).toBeDisabled();
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: "cli1" }));
    expect(createConversationClient).toHaveBeenCalledWith("c1", data);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("con el teléfono visible lo crea en Clientes", async () => {
    (createClient as jest.Mock).mockResolvedValue({ id: "cli2" });
    const onCreated = openDialog("51951111245");
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: "cli2" }));
    expect(createClient).toHaveBeenCalledWith({
      ...data,
      companyId: "co1",
      clientType: "TRADICIONAL",
      phoneNumber: "951111245",
    });
  });
});
