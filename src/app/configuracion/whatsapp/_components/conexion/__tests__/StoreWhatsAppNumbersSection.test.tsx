import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { WhatsAppAccount } from "@/features/whatsapp/models/connection.model";
import type { ConnectionMutations } from "../connection-types";
import { StoreWhatsAppNumbersSection } from "../StoreWhatsAppNumbersSection";

/** Kunka (Corporación Aranni): un número por vendedora; el principal envía los avisos. */
const account = (over: Partial<WhatsAppAccount>): WhatsAppAccount =>
  ({
    id: "acc-ana",
    storeId: "kunka",
    role: "principal",
    isPrimary: true,
    isCompanyDefault: false,
    assignedUserId: "u-ana",
    assignedUserName: "Ana",
    phone: "+51 900 000 001",
    phoneNumberId: "pn-ana",
    verifiedName: "Kunka",
    ...over,
  }) as WhatsAppAccount;

const ACCOUNTS = [
  account({}),
  account({
    id: "acc-bea",
    role: "secundario",
    isPrimary: false,
    assignedUserId: null,
    assignedUserName: null,
    phone: "+51 900 000 002",
    phoneNumberId: "pn-bea",
  }),
];

function setup(mutations: Partial<ConnectionMutations> = {}, onAdd = jest.fn()) {
  const all = {
    disconnect: jest.fn().mockResolvedValue(undefined),
    setPrimary: jest.fn().mockResolvedValue(undefined),
    assignNumber: jest.fn().mockResolvedValue(undefined),
    syncAppData: jest.fn().mockResolvedValue(undefined),
    ...mutations,
  } as unknown as ConnectionMutations;
  render(
    <StoreWhatsAppNumbersSection
      storeName="Kunka"
      accounts={{ kind: "ready", data: ACCOUNTS }}
      agents={{
        kind: "ready",
        data: [
          { id: "u-ana", name: "Ana" },
          { id: "u-bea", name: "Bea" },
        ] as never,
      }}
      coexistence={[
        {
          credentialId: "acc-bea",
          phoneNumberId: "pn-bea",
          onboardedAt: "2026-11-25T10:00:00.000Z",
          syncDeadline: "2026-11-26T10:00:00.000Z",
          canSync: true,
          historyStatus: null,
          historyProgress: null,
        } as never,
      ]}
      now={new Date("2026-11-25T12:00:00.000Z")}
      blockedReason={null}
      mutations={all}
      onAdd={onAdd}
    />,
  );
  return all;
}

describe("StoreWhatsAppNumbersSection", () => {
  it("lista los números de la tienda con su principal y su vendedora", () => {
    setup();
    expect(screen.getByText("Números de Kunka")).toBeInTheDocument();
    const ana = within(screen.getByTestId("wa-number-pn-ana"));
    expect(ana.getByText("Principal")).toBeInTheDocument();
    expect(ana.getByLabelText("Vendedora del número +51 900 000 001")).toHaveTextContent("Ana");
    const bea = within(screen.getByTestId("wa-number-pn-bea"));
    expect(bea.getByRole("button", { name: /Hacer principal/ })).toBeInTheDocument();
    expect(bea.getByLabelText("Vendedora del número +51 900 000 002")).toHaveTextContent(
      "Sin vendedora (de la tienda)",
    );
    expect(bea.getByText(/Sigue en la app del celular/)).toBeInTheDocument();
  });

  it("hacer principal llama solo a ese número", async () => {
    const m = setup();
    fireEvent.click(screen.getByRole("button", { name: /Hacer principal/ }));
    await waitFor(() => expect(m.setPrimary).toHaveBeenCalledWith("acc-bea"));
  });

  it("desconectar avisa que los otros números siguen y desconecta solo ese", async () => {
    const m = setup();
    fireEvent.click(
      within(screen.getByTestId("wa-number-pn-bea")).getByRole("button", { name: /Desconectar/ }),
    );
    expect(await screen.findByText(/Solo se desconecta este número/)).toBeInTheDocument();
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Desconectar" }));
    await waitFor(() => expect(m.disconnect).toHaveBeenCalledWith("acc-bea"));
    expect(m.disconnect).toHaveBeenCalledTimes(1);
  });

  it("traer historial solo aparece en el número con coexistencia dentro de 24 h", async () => {
    const m = setup();
    expect(
      within(screen.getByTestId("wa-number-pn-ana")).queryByText("Traer historial y contactos"),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Traer historial y contactos/ }));
    await waitFor(() => expect(m.syncAppData).toHaveBeenCalledWith("acc-bea"));
  });

  it("los tres botones de agregar eligen el modo", () => {
    const onAdd = jest.fn();
    setup({}, onAdd);
    fireEvent.click(screen.getByRole("button", { name: /Agregar número con Facebook/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Agregar número que ya usa en el celular/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Agregar manual/ }));
    expect(onAdd.mock.calls.map((c) => c[0])).toEqual(["api", "coex", "manual"]);
  });
});
