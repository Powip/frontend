import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { AuthContext } from "@/contexts/AuthContext";
import { sendToOlvaHandlers } from "@/mocks/handlers/send-to-olva.handlers";
import SendToOlvaModal from "../SendToOlvaModal";
import { buildGuide, buildOrderDetail } from "../test-utils/send-to-olva.fixtures";

const firstOrder = buildOrderDetail();
const secondOrder = buildOrderDetail({
  id: "order-2",
  orderNumber: "PED-1002",
  customer: { ...firstOrder.customer, fullName: "Ana Ruiz", dni: "87654321" },
});

// The modal prints with the signed-in company, so the stories sign one in
const session = {
  auth: {
    accessToken: "storybook-token",
    user: { id: "user-1", email: "demo@powip.test", role: "ADMINISTRADOR", permissions: [] },
    company: { id: "company-1", name: "Powip Demo" },
  },
} as never;

const meta = {
  title: "Components/Olva/SendToOlvaModal",
  component: SendToOlvaModal,
  decorators: [
    (Story) => (
      <AuthContext.Provider value={session}>
        <Story />
      </AuthContext.Provider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    msw: { handlers: sendToOlvaHandlers.default },
  },
  args: {
    open: true,
    orders: [firstOrder, secondOrder],
    guideId: "guide-1",
    companyId: "company-1",
    guide: buildGuide({ orderIds: ["order-1", "order-2"] }),
    onClose: fn(),
    onSuccess: fn(),
  },
} satisfies Meta<typeof SendToOlvaModal>;

export default meta;

type Story = StoryObj<typeof meta>;

// The modal renders in a portal, so queries go through `screen`
async function choosePayer() {
  await userEvent.click(await screen.findByRole("combobox", { name: /Quién paga/ }));
  await userEvent.click(await screen.findByRole("option", { name: "Pago en tienda" }));
}

// The closing select leaves the modal unclickable for a moment (it animates out): retry the click
const clickWhenReady = (element: HTMLElement) => waitFor(() => userEvent.click(element));

// A combobox takes its name from the author, not from its text, so it is found by that text.
// The place is guessed level by level (department, province, district), each one a request.
async function chooseAgency(position = 0) {
  const triggers = await screen.findAllByText("Elige una agencia", {}, { timeout: 5000 });

  await clickWhenReady(triggers[position]);

  const options = await screen.findAllByText("Agencia Lima Centro — Jr. de la Unión 100");

  await userEvent.click(options[options.length - 1]);
}

async function fillLot(orders: 1 | 2) {
  // While the select closes (it animates) the rest of the modal is still hidden from queries
  await choosePayer();
  for (let order = 0; order < orders; order += 1) await chooseAgency(0);
}

/** Two orders of the guide, each preloaded from its customer. */
export const Default: Story = {
  play: async () => {
    await expect(await screen.findByText("Pedido PED-1001")).toBeInTheDocument();
    await expect(screen.getByText("Pedido PED-1002")).toBeInTheDocument();
    await expect(screen.getByRole("button", { name: "Registrar 2 envíos en Olva" })).toBeDisabled();
  },
};

export const SingleOrder: Story = {
  args: { orders: [firstOrder] },
};

export const NoSender: Story = {
  parameters: { msw: { handlers: sendToOlvaHandlers.noSender } },
  play: async () => {
    await expect(await screen.findByText("Aún no tienes un remitente")).toBeInTheDocument();
  },
};

/** One order already has a shipment: it is left out and listed with its tracking number. */
export const SomeAlreadyShipped: Story = {
  parameters: { msw: { handlers: sendToOlvaHandlers.withShipped(["order-1"]) } },
  play: async () => {
    await expect(await screen.findByText("1 pedido ya tiene envío en Olva")).toBeInTheDocument();
    await expect(screen.getByText(/seguimiento TRK-order-1/)).toBeInTheDocument();
    await expect(
      screen.getByRole("button", { name: "Registrar 1 envío en Olva" }),
    ).toBeInTheDocument();
  },
};

export const AllAlreadyShipped: Story = {
  parameters: { msw: { handlers: sendToOlvaHandlers.withShipped(["order-1", "order-2"]) } },
  play: async () => {
    await expect(
      await screen.findByText("Todos los pedidos seleccionados ya tienen un envío activo en Olva."),
    ).toBeInTheDocument();
  },
};

export const ValidationErrors: Story = {
  args: { orders: [firstOrder] },
  play: async () => {
    await choosePayer();
    await clickWhenReady(await screen.findByRole("button", { name: "Registrar 1 envío en Olva" }));

    await expect(await screen.findByText("Elige la agencia de destino")).toBeInTheDocument();
  },
};

/** Once the agency is chosen, the order shows its price and the lot its estimated total. */
export const LiveQuote: Story = {
  args: { orders: [firstOrder] },
  play: async () => {
    await fillLot(1);

    await expect(await screen.findByText(/Costo estimado:/)).toBeInTheDocument();
    await expect(await screen.findByText(/Total estimado:/)).toBeInTheDocument();
  },
};

export const Submitting: Story = {
  args: { orders: [firstOrder] },
  parameters: { msw: { handlers: sendToOlvaHandlers.submitting } },
  play: async () => {
    await fillLot(1);
    await clickWhenReady(await screen.findByRole("button", { name: "Registrar 1 envío en Olva" }));

    await expect(await screen.findByRole("button", { name: "Registrando…" })).toBeDisabled();
  },
};

export const RegistersLot: Story = {
  play: async ({ args }) => {
    await fillLot(2);
    await clickWhenReady(await screen.findByRole("button", { name: "Registrar 2 envíos en Olva" }));

    await expect(await screen.findAllByRole("button", { name: /Rótulo Olva/ })).toHaveLength(2);
    await expect(screen.getByRole("button", { name: /Imprimir etiquetas/ })).toBeEnabled();
    await waitFor(() => expect(args.onSuccess).toHaveBeenCalled());
  },
};

// The customer lives in San Isidro: the district is guessed from the ubigeo catalog
const homeOrder = buildOrderDetail({
  customer: { ...firstOrder.customer, district: "San Isidro" },
});

async function chooseHomeDelivery(position: number) {
  const selects = await screen.findAllByRole("combobox", { name: "Tipo de entrega" });

  await userEvent.click(selects[position]);
  await userEvent.click(await screen.findByRole("option", { name: "Entrega a domicilio" }));
}

/** Home delivery asks for a district, address and reference (no agency, no PIN, no lot payer). */
export const HomeDelivery: Story = {
  args: { orders: [homeOrder] },
  play: async () => {
    await chooseHomeDelivery(0);

    await expect(await screen.findByText("Distrito de entrega")).toBeInTheDocument();
    await expect(await screen.findByText("SAN ISIDRO")).toBeInTheDocument();
    await expect(screen.queryByText("Agencia de destino")).not.toBeInTheDocument();
    await expect(screen.getByText(/Todo el lote es entrega a domicilio/)).toBeInTheDocument();
  },
};

/** A pickup and a home delivery in one lot: the payer only governs the pickup. */
export const MixedLot: Story = {
  args: { orders: [homeOrder, secondOrder] },
  play: async () => {
    await chooseHomeDelivery(1);

    await expect(await screen.findByRole("combobox", { name: /Quién paga/ })).toBeInTheDocument();
    await expect(await screen.findByText("Distrito de entrega")).toBeInTheDocument();
  },
};

/** Olva rejected one order: only that one can be fixed and sent again. */
export const PartialFailure: Story = {
  parameters: { msw: { handlers: sendToOlvaHandlers.partialFailure } },
  play: async () => {
    await fillLot(2);
    await clickWhenReady(await screen.findByRole("button", { name: "Registrar 2 envíos en Olva" }));

    await expect(await screen.findByText("Rechazado")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Corregir y reintentar (1)" }));

    await expect(await screen.findByText("Pedido PED-1002")).toBeInTheDocument();
    await expect(screen.queryByText("Pedido PED-1001")).not.toBeInTheDocument();
  },
};

/** Registered at Olva but not saved: it must never be offered for resending. */
export const RegisteredNotSaved: Story = {
  args: { orders: [firstOrder] },
  parameters: { msw: { handlers: sendToOlvaHandlers.registeredNotSaved } },
  play: async () => {
    await fillLot(1);
    await clickWhenReady(await screen.findByRole("button", { name: "Registrar 1 envío en Olva" }));

    const alert = await screen.findAllByRole("alert");

    await expect(within(alert[0]).getByText(/No lo envíes de nuevo/)).toBeInTheDocument();
    await expect(
      screen.queryByRole("button", { name: /Corregir y reintentar/ }),
    ).not.toBeInTheDocument();
  },
};

/** The whole call fails: nothing was registered, so the form stays as the user left it. */
export const WholeCallFails: Story = {
  args: { orders: [firstOrder] },
  parameters: { msw: { handlers: sendToOlvaHandlers.wholeCallFails } },
  play: async () => {
    await fillLot(1);
    await clickWhenReady(await screen.findByRole("button", { name: "Registrar 1 envío en Olva" }));

    await expect(await screen.findByText(/Olva no está disponible/)).toBeInTheDocument();
    await expect(screen.getByRole("button", { name: "Registrar 1 envío en Olva" })).toBeEnabled();
  },
};
